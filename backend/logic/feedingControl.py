import json
import time
import datetime
import sys
import os
import logging
import threading
from pathlib import Path

# Logging konfigurieren
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Basisverzeichnis = Ordner, in dem diese feedingControl.py liegt (also "logic")
BASE_DIR = Path(__file__).resolve().parent

# Für den Zugriff auf SensorAktor/Motor und SensorAktor/Gewichtssensor gehen wir
# eine Ebene höher (-> .../backend), dann in SensorAktor.
sensor_aktor_path = BASE_DIR.parent / "SensorAktor"
motor_path = sensor_aktor_path / "Motor"
gewichts_path = sensor_aktor_path / "Gewichtssensor"

# Diese Verzeichnisse in den Python-Suchpfad aufnehmen
sys.path.append(str(motor_path))
sys.path.append(str(gewichts_path))

# Jetzt importieren wir aus motor_control.py und gewichtssensor.py
from SensorAktor.Motor.motor_control import MotorController
from SensorAktor.Gewichtssensor.gewichtssensor import Gewichtssensor

# Import ConsumptionManager für Tracking (aus services/).
# Breiter Exception-Guard: ein Fehler bei der Modul-Initialisierung (z. B. OSError
# auf vollem/read-only Dateisystem) darf die Fütterungslogik nicht mitreißen -
# Tracking degradiert dann einfach zu einem geloggten Warning.
consumption_manager = None
try:
    sys.path.append(str(BASE_DIR.parent))
    from services.consumption_manager import consumption_manager
except Exception as e:
    logging.error(f"ConsumptionManager nicht verfügbar - Tracking deaktiviert: {e}")

# Optionaler Notifier für Realtime-Events (wird von main.py verdrahtet, damit
# Plan-Fütterungen live im Frontend erscheinen - kein socketio-Import hier,
# das hielte die Logik testbar und zirkularfrei)
_feeding_notifier = None

def set_feeding_notifier(notifier):
    """notifier: Objekt mit started(source, target), progress(source, fed, target, elapsed),
    completed(source, success, aborted, fed, target, message) - alle optional best-effort."""
    global _feeding_notifier
    _feeding_notifier = notifier

# FeedingPlan liegt in backend/feedingPlan
FEEDING_PLAN_DIR = BASE_DIR.parent / "feedingPlan"
FEEDING_PLAN_FILE = FEEDING_PLAN_DIR / "feedingPlans.json"

# Thread-Sicherheit für Feeding-Operationen: EIN gemeinsamer Lock für
# Plan-Scheduler UND manuelle Fütterung (aus core.locks; Fallback für
# Standalone-Ausführung ohne Paketkontext)
try:
    from core.locks import feeding_lock
except ImportError:
    feeding_lock = threading.Lock()

# Maximale Fütterungsversuche pro geplanter Fütterung (verhindert Überfütterung
# durch endlose Retries im 10-Minuten-Fenster)
MAX_FEEDING_ATTEMPTS = 2

# In-Memory-Backstop für den Retry-Schutz: Schlägt das Speichern der Plan-JSON fehl
# (SD-Karte voll/read-only), stünde beim nächsten Scheduler-Tick wieder attempts=0
# in der Datei - dieses Dict hält Versuche und gefütterte Mengen zusätzlich im RAM.
# Key: (plan_name, fütterungszeit, datum)
_attempts_memory = {}

def _memory_key(plan_name, feeding_time):
    return (plan_name, feeding_time, datetime.date.today().isoformat())

def _prune_attempts_memory():
    """Entfernt Einträge vergangener Tage"""
    today = datetime.date.today().isoformat()
    for key in [k for k in _attempts_memory if k[2] != today]:
        del _attempts_memory[key]

# Hardware kommt aus der EINEN gemeinsamen Quelle (services.hardware) -
# vorher existierten zwei MotorController auf denselben GPIO-Pins.
# Fallback für Standalone-Ausführung (python feedingControl.py) bleibt erhalten.
_gewichtssensor = None
_motor_controller = None

def get_sensor_instances():
    """Singleton-Instanzen für Sensoren (delegiert an services.hardware)"""
    global _gewichtssensor, _motor_controller

    try:
        from services import hardware
        return hardware.get_weight_sensor(), hardware.get_motor()
    except ImportError:
        # Standalone-Betrieb ohne Paketkontext
        if _gewichtssensor is None:
            _gewichtssensor = Gewichtssensor()
        if _motor_controller is None:
            _motor_controller = MotorController(_gewichtssensor)
        return _gewichtssensor, _motor_controller

# Funktion zur Übersetzung der Wochentage ins Deutsche
def translate_day_to_german(day):
    days = {
        "Monday": "Montag",
        "Tuesday": "Dienstag", 
        "Wednesday": "Mittwoch",
        "Thursday": "Donnerstag",
        "Friday": "Freitag",
        "Saturday": "Samstag",
        "Sunday": "Sonntag"
    }
    return days.get(day, "")

def load_feeding_plans():
    """Lädt Fütterungspläne thread-safe"""
    try:
        with open(FEEDING_PLAN_FILE, 'r') as file:
            fütterungspläne = json.load(file)
        logging.info("JSON-Daten erfolgreich geladen (FeedingPlan).")
        return fütterungspläne
    except FileNotFoundError:
        logging.error("Die Datei mit dem Fütterungsplan wurde nicht gefunden.")
        return []
    except json.JSONDecodeError:
        logging.error("Fehler beim Lesen der JSON-Datei.")
        return []
    except Exception as e:
        logging.error(f"Fehler beim Laden der Fütterungspläne: {e}")
        return []

def save_feeding_plans(fütterungspläne):
    """Speichert Fütterungspläne thread-safe"""
    try:
        # Stelle sicher, dass das Verzeichnis existiert
        FEEDING_PLAN_DIR.mkdir(parents=True, exist_ok=True)
        
        with open(FEEDING_PLAN_FILE, 'w') as file:
            json.dump(fütterungspläne, file, ensure_ascii=False, indent=2)
        logging.info("Fütterungspläne erfolgreich gespeichert.")
        return True
    except Exception as e:
        logging.error(f"Fehler beim Speichern der Fütterungspläne: {e}")
        return False

def execute_feeding(target_weight, timeout_seconds=300):
    """
    Führt eine einzelne Fütterung aus - thread-safe
    
    Args:
        target_weight (float): Zielgewicht in Gramm
        timeout_seconds (int): Timeout in Sekunden
    
    Returns:
        tuple: (success: bool, message: str, fed_amount: float)
    """
    gewichtssensor, motor_controller = get_sensor_instances()
    logging.info(f"[execute_feeding] Starte Fütterung: Zielgewicht={target_weight}g, Timeout={timeout_seconds}s")
    
    # Prüfe Sensor-Bereitschaft
    if not gewichtssensor.is_ready():
        logging.error("[execute_feeding] Gewichtssensor nicht bereit!")
        return False, "Gewichtssensor nicht bereit", 0.0
    
    try:
        # Realtime-Events (best-effort, ohne die Fütterung zu gefährden)
        notifier = _feeding_notifier
        progress_cb = None
        if notifier is not None:
            try:
                notifier.started("plan", target_weight)
            except Exception:
                pass

            def progress_cb(fed_grams, target_grams, elapsed_s):
                try:
                    notifier.progress("plan", fed_grams, target_grams, elapsed_s)
                except Exception:
                    pass

        # feed_until_weight liefert die gefütterte Menge direkt numerisch zurück
        success, message, fed_amount = motor_controller.feed_until_weight(
            target_weight_grams=target_weight,
            timeout_seconds=timeout_seconds,
            progress_cb=progress_cb
        )
        logging.info(f"[execute_feeding] Ergebnis: success={success}, message={message}, fed_amount={fed_amount:.1f}g")

        if notifier is not None:
            try:
                notifier.completed("plan", success, "gestoppt" in message.lower(),
                                   max(fed_amount, 0.0), target_weight, message)
            except Exception:
                pass

        return success, message, fed_amount
        
    except Exception as e:
        error_msg = f"Fehler beim Ausführen der Fütterung: {e}"
        logging.error(error_msg)
        return False, error_msg, 0.0

def reset_feeding_status_for_today(fütterungspläne, current_day_german, today_date):
    """
    Setzt den Status aller Fütterungen für den aktuellen Tag zurück,
    wenn sie nicht heute durchgeführt wurden.

    Returns:
        bool: True wenn Änderungen aufgetreten sind (müssen gespeichert werden)
    """
    modified = False
    for plan in fütterungspläne:
        if not plan.get("active", False):
            continue
        if current_day_german not in plan["selectedDays"]:
            continue
        if current_day_german in plan["feedingSchedule"]:
            for fütterung in plan["feedingSchedule"][current_day_german]:
                last_attempt = fütterung.get("last_attempt")
                # Status auf None (Ausstehend) zurücksetzen, wenn keine Fütterung heute
                if not last_attempt or last_attempt[:10] != today_date:
                    if (fütterung.get("status") is not None
                            or fütterung.get("attempts") or fütterung.get("fed_amount")):
                        modified = True
                    fütterung["status"] = None
                    fütterung["attempts"] = 0
                    fütterung["fed_amount"] = 0.0
    return modified

def aktualisiere_fütterungsstatus():
    """
    Überarbeitete, thread-sichere Hauptfunktion für Fütterungsstatus-Updates
    """
    # Nur ein Thread darf gleichzeitig füttern
    if not feeding_lock.acquire(blocking=False):
        logging.warning("Fütterung bereits in Bearbeitung - überspringe")
        return False

    try:
        logging.info("Starte Fütterungsstatus-Update...")
        
        # Lade aktuelle Fütterungspläne
        fütterungspläne = load_feeding_plans()
        if not fütterungspläne:
            logging.warning("Keine Fütterungspläne verfügbar")
            return False

        # Aktuelle Zeit ermitteln
        now = datetime.datetime.now()
        current_day_german = translate_day_to_german(now.strftime("%A"))
        current_time = now.time()
        today_date = now.strftime("%Y-%m-%d")
        
        logging.info(f"Aktueller Tag: {current_day_german}, Aktuelle Zeit: {current_time}")

        # Alte In-Memory-Einträge vergangener Tage aufräumen
        _prune_attempts_memory()

        # Status aller Fütterungen für heute zurücksetzen, falls nicht heute durchgeführt
        # (Änderungen mitspeichern, sonst zeigt das Frontend gestrige Werte für heute an)
        plans_modified = reset_feeding_status_for_today(fütterungspläne, current_day_german, today_date)
        for plan in fütterungspläne:
            if not plan.get("active", False):
                logging.debug(f"Plan {plan['planName']} ist nicht aktiv - überspringe")
                continue

            if current_day_german not in plan["selectedDays"]:
                logging.debug(f"Plan {plan['planName']} ist nicht für heute vorgesehen - überspringe")
                continue

            logging.info(f"Verarbeite aktiven Plan: {plan['planName']}")

            # Verarbeite Fütterungen für den aktuellen Tag
            if current_day_german in plan["feedingSchedule"]:
                fütterungen = plan["feedingSchedule"][current_day_german]
                
                for fütterung in fütterungen:
                    if process_single_feeding(fütterung, current_time, plan.get("planName", "?")):
                        plans_modified = True

        # Speichere Updates falls Änderungen aufgetreten sind
        if plans_modified:
            if save_feeding_plans(fütterungspläne):
                logging.info("Fütterungsstatus erfolgreich aktualisiert.")
            else:
                # Nicht kritisch für den Überfütterungsschutz: _attempts_memory
                # hält Versuche/Mengen zusätzlich im RAM
                logging.error("Fütterungsstatus konnte NICHT gespeichert werden - "
                              "Retry-Schutz läuft über den In-Memory-Backstop weiter")
        else:
            logging.info("Keine Fütterungen zu verarbeiten.")
        
        return True

    except Exception as e:
        logging.error(f"Fehler beim Aktualisieren des Fütterungsstatus: {e}")
        return False
    finally:
        feeding_lock.release()

def process_single_feeding(fütterung, current_time, plan_name="?"):
    """
    Verarbeitet eine einzelne Fütterung

    Returns:
        bool: True wenn Änderungen aufgetreten sind
    """
    try:
        fütterungszeit = datetime.datetime.strptime(fütterung["time"], "%H:%M").time()

        # Prüfe Zeitbedingungen: Fütterung ist fällig, wenn Zeit <= jetzt und nicht länger als 10 Minuten her
        now_dt = datetime.datetime.combine(datetime.date.today(), current_time)
        fütterung_dt = datetime.datetime.combine(datetime.date.today(), fütterungszeit)
        delta_minutes = (now_dt - fütterung_dt).total_seconds() / 60.0
        if delta_minutes < 0 or delta_minutes > 10:
            logging.debug(f"Überspringe Fütterungszeit: {fütterung['time']} (delta_minutes={delta_minutes:.1f})")
            return False

        # Bereits erfolgreich abgeschlossen?
        if fütterung.get("status") is True:
            logging.debug(f"Überspringe bereits abgeschlossene Fütterung: {fütterung['time']}")
            return False

        # Fehlversuche begrenzen: sonst wird im 10-Minuten-Fenster bei jedem
        # Scheduler-Tick erneut die VOLLE Menge gefüttert (Überfütterung!)
        # Zähler = Maximum aus Plan-JSON und In-Memory-Backstop, damit der Schutz
        # auch greift, wenn die JSON nicht gespeichert werden konnte (SD voll/read-only)
        mem_key = _memory_key(plan_name, fütterung["time"])
        mem = _attempts_memory.get(mem_key, {})
        attempts = max(int(fütterung.get("attempts", 0) or 0), int(mem.get("attempts", 0)))
        if attempts >= MAX_FEEDING_ATTEMPTS:
            logging.warning(f"[process_single_feeding] Fütterung {fütterung['time']}: "
                            f"Maximale Versuche ({MAX_FEEDING_ATTEMPTS}) erreicht - kein weiterer Retry")
            return False

        # Bereits gefütterte Teilmenge aus früheren Versuchen anrechnen
        # (auch hier: Maximum aus JSON und RAM-Backstop)
        target_weight = round(float(fütterung["weight"]), 2)
        already_fed = max(0.0, float(fütterung.get("fed_amount", 0.0) or 0.0),
                          float(mem.get("fed_amount", 0.0)))
        remaining = round(target_weight - already_fed, 2)
        if remaining <= 0:
            fütterung["status"] = True
            fütterung["last_attempt"] = datetime.datetime.now().isoformat()
            logging.info(f"[process_single_feeding] Zielmenge bereits erreicht ({already_fed}g) - markiere als erledigt")
            return True

        logging.info(f"[process_single_feeding] Starte Fütterung um {fütterung['time']}: "
                     f"Restmenge {remaining}g (Soll {target_weight}g, bereits {already_fed}g), Versuch {attempts + 1}")

        success, message, fed_amount = execute_feeding(
            target_weight=remaining,
            timeout_seconds=300
        )
        fed_amount = max(0.0, fed_amount)

        # Update Status (fed_amount wird über Versuche hinweg kumuliert)
        fütterung["status"] = success
        fütterung["attempts"] = attempts + 1
        fütterung["last_attempt"] = datetime.datetime.now().isoformat()
        fütterung["message"] = message
        fütterung["fed_amount"] = round(already_fed + fed_amount, 2)

        # In-Memory-Backstop aktualisieren (übersteht fehlgeschlagene JSON-Saves)
        _attempts_memory[mem_key] = {
            "attempts": attempts + 1,
            "fed_amount": round(already_fed + fed_amount, 2),
        }

        # Tracking: jede tatsächlich geförderte Menge zählt - auch bei Teilerfolg,
        # das Futter ist ja im Napf gelandet
        try:
            if fed_amount > 0 and consumption_manager is not None:
                consumption_manager.add_feeding(fed_amount, source="plan")
                logging.info(f"[process_single_feeding] Fütterung getrackt: {fed_amount}g")
            else:
                logging.warning(f"[process_single_feeding] Fütterung NICHT getrackt - Gewichtsmessung ergab 0g")
        except Exception as e:
            logging.warning(f"[process_single_feeding] Fehler beim Tracking: {e}")

        if success:
            logging.info(f"[process_single_feeding] Fütterung erfolgreich: {message}")
        else:
            logging.warning(f"[process_single_feeding] Fütterung fehlgeschlagen "
                            f"(Versuch {attempts + 1}/{MAX_FEEDING_ATTEMPTS}): {message}")

        return True  # Änderung aufgetreten

    except Exception as e:
        logging.error(f"Fehler beim Verarbeiten der Fütterung {fütterung.get('time', 'unbekannt')}: {e}")
        fütterung["status"] = False
        fütterung["message"] = f"Fehler: {e}"
        fütterung["last_attempt"] = datetime.datetime.now().isoformat()
        return True  # Änderung aufgetreten (Fehlerstatus)

def test_motor_immediate(target_weight=200.0):
    """
    Überarbeitete Test-Funktion für sofortige Motorsteuerung
    """
    logging.info(f"Starte Motor-Test mit Zielgewicht: {target_weight}g")
    
    try:
        success, message, fed_amount = execute_feeding(
            target_weight=target_weight,
            timeout_seconds=300
        )
        
        if success:
            logging.info(f"Motor-Test erfolgreich: {fed_amount}g gefüttert")
        else:
            logging.warning(f"Motor-Test fehlgeschlagen: {message}")
        
        return success, message
        
    except Exception as e:
        error_msg = f"Fehler beim Motor-Test: {e}"
        logging.error(error_msg)
        return False, error_msg

def get_feeding_status():
    """
    Gibt den aktuellen Status aller Fütterungspläne zurück
    """
    fütterungspläne = load_feeding_plans()
    if not fütterungspläne:
        return {"error": "Keine Fütterungspläne gefunden"}
    
    status = {
        "total_plans": len(fütterungspläne),
        "active_plans": len([p for p in fütterungspläne if p.get("active", False)]),
        "last_update": datetime.datetime.now().isoformat(),
        "plans": []
    }
    
    for plan in fütterungspläne:
        plan_status = {
            "name": plan["planName"],
            "active": plan.get("active", False),
            "selected_days": plan["selectedDays"],
            "total_feedings": 0,
            "completed_feedings": 0,
            "failed_feedings": 0
        }
        
        # Zähle Fütterungen
        for day, feedings in plan["feedingSchedule"].items():
            for feeding in feedings:
                plan_status["total_feedings"] += 1
                if feeding.get("status") is True:
                    plan_status["completed_feedings"] += 1
                elif feeding.get("status") is False:
                    plan_status["failed_feedings"] += 1
        
        status["plans"].append(plan_status)
    
    return status

def cleanup_resources():
    """Bereinigt alle Ressourcen"""
    global _gewichtssensor, _motor_controller

    try:
        from services import hardware
        hardware.cleanup()
        return
    except ImportError:
        pass

    try:
        if _motor_controller:
            _motor_controller.cleanup()
        if _gewichtssensor:
            _gewichtssensor.cleanup()
    except Exception as e:
        logging.warning(f"Fehler beim Cleanup: {e}")
    finally:
        _gewichtssensor = None
        _motor_controller = None

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="CatBot Feeding Control")
    parser.add_argument("--mode", choices=["plan", "test", "status"], default="plan",
                      help="Betriebsmodus: plan (Fütterungsplan), test (Motor-Test), status (Status anzeigen)")
    parser.add_argument("--weight", type=float, default=200.0,
                      help="Zielgewicht für Test-Modus (Standard: 200g)")
    
    args = parser.parse_args()
    
    try:
        if args.mode == "plan":
            print("Aktualisiere Fütterungsstatus...")
            success = aktualisiere_fütterungsstatus()
            print(f"Update {'erfolgreich' if success else 'fehlgeschlagen'}")
            
        elif args.mode == "test":
            print(f"Starte Motor-Test mit {args.weight}g...")
            success, message = test_motor_immediate(args.weight)
            print(f"Test-Ergebnis: {message}")
            
        elif args.mode == "status":
            print("Fütterungsstatus:")
            status = get_feeding_status()
            print(json.dumps(status, indent=2, ensure_ascii=False))
            
    except KeyboardInterrupt:
        print("\nVorgang abgebrochen durch Benutzer")
    except Exception as e:
        print(f"Unerwarteter Fehler: {e}")
        logging.error(f"Hauptprogramm-Fehler: {e}")
    finally:
        cleanup_resources()
        print("Cleanup abgeschlossen")
