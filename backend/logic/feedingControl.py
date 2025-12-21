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

# Import ConsumptionManager für Tracking
try:
    from backend.data.consumption_manager import consumption_manager
except ImportError:
    # Fallback für direkte Ausführung
    sys.path.append(str(BASE_DIR.parent))
    from data.consumption_manager import consumption_manager

# FeedingPlan liegt in backend/feedingPlan
FEEDING_PLAN_DIR = BASE_DIR.parent / "feedingPlan"
FEEDING_PLAN_FILE = FEEDING_PLAN_DIR / "feedingPlans.json"

# Thread-Sicherheit für Feeding-Operationen
feeding_lock = threading.Lock()

# Globale Instanzen (werden thread-safe initialisiert)
_gewichtssensor = None
_motor_controller = None

def get_sensor_instances():
    """Thread-sichere Singleton-Instanzen für Sensoren"""
    global _gewichtssensor, _motor_controller
    
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
        # Verwende die neue synchrone Fütterungsmethode
        success, message = motor_controller.feed_until_weight(
            target_weight_grams=target_weight,
            timeout_seconds=timeout_seconds
        )
        logging.info(f"[execute_feeding] Ergebnis: success={success}, message={message}")
        
        # Extrahiere gefütterte Menge aus der Nachricht
        fed_amount = 0.0
        if "gefüttert" in message:
            try:
                # Extrahiere Zahl vor "g gefüttert"
                parts = message.split("g gefüttert")[0].split(":")
                if len(parts) > 1:
                    fed_amount = float(parts[-1].strip().replace("g", ""))
            except Exception as e:
                logging.warning(f"[execute_feeding] Fehler beim Extrahieren der gefütterten Menge: {e}")
        
        return success, message, fed_amount
        
    except Exception as e:
        error_msg = f"Fehler beim Ausführen der Fütterung: {e}"
        logging.error(error_msg)
        return False, error_msg, 0.0

def reset_feeding_status_for_today(fütterungspläne, current_day_german, today_date):
    """
    Setzt den Status aller Fütterungen für den aktuellen Tag zurück, 
    wenn sie nicht heute durchgeführt wurden.
    """
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
                    fütterung["status"] = None

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

        # Status aller Fütterungen für heute zurücksetzen, falls nicht heute durchgeführt
        reset_feeding_status_for_today(fütterungspläne, current_day_german, today_date)

        # Verarbeite alle aktiven Pläne
        plans_modified = False
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
                    if process_single_feeding(fütterung, current_time):
                        plans_modified = True

        # Speichere Updates falls Änderungen aufgetreten sind
        if plans_modified:
            save_feeding_plans(fütterungspläne)
            logging.info("Fütterungsstatus erfolgreich aktualisiert.")
        else:
            logging.info("Keine Fütterungen zu verarbeiten.")
        
        return True

    except Exception as e:
        logging.error(f"Fehler beim Aktualisieren des Fütterungsstatus: {e}")
        return False
    finally:
        feeding_lock.release()

def process_single_feeding(fütterung, current_time):
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

        # Führe Fütterung aus
        target_weight = round(float(fütterung["weight"]), 2)
        logging.info(f"[process_single_feeding] Starte Fütterung um {fütterung['time']} mit Zielgewicht: {target_weight}g")

        success, message, fed_amount = execute_feeding(
            target_weight=target_weight,
            timeout_seconds=300
        )

        # Update Status
        fütterung["status"] = success
        fütterung["last_attempt"] = datetime.datetime.now().isoformat()
        fütterung["message"] = message
        fütterung["fed_amount"] = fed_amount

        if success:
            # Füge Fütterung zum Tracking hinzu
            try:
                consumption_manager.add_feeding(fed_amount)
                logging.info(f"[process_single_feeding] Fütterung erfolgreich getrackt: {fed_amount}g")
            except Exception as e:
                logging.warning(f"[process_single_feeding] Fehler beim Tracking: {e}")
            logging.info(f"[process_single_feeding] Fütterung erfolgreich: {message}")
        else:
            logging.warning(f"[process_single_feeding] Fütterung fehlgeschlagen: {message}")

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
