"""Manuelle Fütterung über denselben geregelten Pfad wie der Fütterungsplan.

Läuft als Background-Task (eventlet-Greenlet); Fortschritt geht als
Socket.IO-Events raus. feeding_lock serialisiert gegen den Plan-Scheduler.
Enthält auch den Anti-Schling-Modus (chunked_feed), den Plan- UND
Manuell-Pfad gemeinsam nutzen.
"""
import logging
import threading
import time

from core.config import MIN_MANUAL_GRAMS, MAX_MANUAL_GRAMS, FEED_TIMEOUT_SECONDS
from core.locks import feeding_lock
from services import hardware, realtime
from services.consumption_manager import consumption_manager

MAX_SLOW_MINUTES = 15

# Adaptives Anti-Schling: ab diesem Fresstempo wird die Pause gedehnt
FAST_EATING_G_PER_MIN = 20.0

# Just-in-Time-Dosierung (pro Katze, ohne Kamera)
JIT_CHUNK_G = 3.0            # Nachdosier-Häppchen
JIT_SESSION_MAX_S = 600      # Deckel pro Fütterung
JIT_IDLE_END_S = 180         # so lange frisst niemand -> Sitzung beenden
JIT_POLL_S = 5
# "Kürzlich gefressen": so lange nach dem letzten Fress-Signal wird bei leerem
# Napf nachdosiert. WICHTIG: nicht act.eating verwenden - die Episode endet
# genau im Moment des Leerfressens (Sensor-Deadband pinnt < 3 g auf 0),
# act.eating wäre dann immer False -> Deadlock (Review-Finding).
JIT_RECENT_EATING_S = 90
# Fürs SPERREN braucht es mehr Sicherheit als für die Anzeige
JIT_GATE_CONFIDENCE = 0.75


def _safe_weight(motor):
    """Napfgewicht best-effort (None bei Fehler) - nur ausserhalb von Motorläufen."""
    try:
        if motor.gewichtssensor is None:
            return None
        return motor.gewichtssensor.get_weight()
    except Exception:
        return None

# Zustand der aktuell laufenden Fütterung (für GET /motor/status)
_state_lock = threading.Lock()
_active = None  # None oder {"source", "target_grams", "fed_grams"}

# Plan-Dosierung läuft (von feedingControl.execute_feeding gesetzt) - _active
# meldet bewusst NUR manuelle Feeds (MotorStatus-Vertrag), der Fress-Tracker
# braucht aber ein Signal für JEDE Dosierung inkl. Anti-Schling-Pausen
_plan_dosing = False


def set_plan_dosing(value):
    global _plan_dosing
    with _state_lock:
        _plan_dosing = bool(value)
    # Dosier-Signal DIREKT beim Tracker stempeln: kurze Motorläufe können
    # sonst komplett zwischen zwei 5-s-Poll-Ticks liegen (Phantom-Hand-Buchung)
    try:
        from services import eating_tracker
        eating_tracker.note_dosing()
    except Exception:
        pass


def is_dosing():
    """Läuft gerade irgendeine Dosierung (manuell ODER Plan)?"""
    with _state_lock:
        return _active is not None or _plan_dosing

# Abbruch-Flag für die Pausen des Anti-Schling-Modus (feed_until_weight setzt
# sein eigenes Abort-Flag bei jedem Aufruf zurück - die Pausen brauchen ein
# Service-eigenes)
_abort_slow = False


def chunked_feed(motor, amount, slow_minutes, progress_cb=None):
    """Anti-Schling: Portion in kleinen Schüben über slow_minutes verteilen.

    Jeder Schub dosiert sein eigenes Netto-Inkrement über den normalen
    Regelkreis; zwischen den Schüben wird pausiert (abbruchfähig).
    Returns (success, message, fed_total).
    """
    global _abort_slow
    _abort_slow = False

    chunks = int(max(2, min(6, amount // 2)))
    pause_s = (float(slow_minutes) * 60.0) / max(1, chunks - 1)
    fed_total = 0.0

    for i in range(chunks):
        if _abort_slow:
            return False, (f"Fütterung gestoppt: Nur {fed_total:.1f}g gefüttert "
                           f"(Soll: {amount}g)"), fed_total

        remaining = round(amount - fed_total, 1)
        if remaining <= 0:
            break
        chunk_target = round(min(amount / chunks, remaining), 1) if i < chunks - 1 else remaining

        def cb(fed, _target, elapsed, _base=fed_total):
            if progress_cb:
                progress_cb(round(_base + fed, 1), amount, elapsed)

        ok, message, fed = motor.feed_until_weight(
            target_weight_grams=chunk_target,
            timeout_seconds=120,
            progress_cb=cb,
        )
        fed_total = round(fed_total + max(0.0, fed), 1)
        if progress_cb:
            progress_cb(fed_total, amount, 0.0)
        if not ok:
            return False, f"{message} (gesamt {fed_total:.1f}g)", fed_total

        if i < chunks - 1 and fed_total < amount:
            # Adaptive Pause: wird gerade GESCHLUNGEN (Waage sinkt schnell),
            # dehnt sich die Pause einmalig auf das Doppelte - gemessen über
            # die ersten 10 s der Pause (Motor steht, die Waage gehört uns)
            slept = 0.0
            pause_target = pause_s
            pause_start_weight = _safe_weight(motor)
            extended = False
            while slept < pause_target:
                if _abort_slow:
                    return False, (f"Fütterung gestoppt: Nur {fed_total:.1f}g gefüttert "
                                   f"(Soll: {amount}g)"), fed_total
                time.sleep(1)
                slept += 1
                if not extended and slept == 10 and pause_start_weight is not None:
                    now_weight = _safe_weight(motor)
                    if now_weight is not None:
                        eaten = max(0.0, pause_start_weight - now_weight)
                        if eaten * 6 >= FAST_EATING_G_PER_MIN:  # g/10s -> g/min
                            pause_target = pause_s * 2
                            extended = True
                            logging.info(f"Anti-Schling: Fresstempo {eaten * 6:.0f} g/min - "
                                         f"Pause auf {pause_target:.0f} s gedehnt")

    return True, f"{fed_total:.1f}g gefüttert in {chunks} Schüben (Soll: {amount}g)", fed_total


def jit_feed(motor, total_grams, progress_cb=None):
    """Just-in-Time-Dosierung: Starter-Häppchen, dann nur nachdosieren,
    solange die live erkannte Katze noch Tagesbudget hat.

    - Bias: im Zweifel WIRD dosiert (unbekannt/unsicher = kein Gate).
    - Der Fress-Tracker läuft zwischen den Häppchen WEITER: plan_dosing wird
      nur um die Motorläufe gelegt, nicht um die Wartezeiten - das Fressen
      zwischen den Häppchen IST das Erkennungssignal.
    - Sitzung endet bei Soll erreicht, Budget-Gate ohne weitere Esser,
      3 min Fress-Stille oder 10-min-Deckel. Rest übernimmt Smart-Feed.
    Returns (success, message, dispensed).
    """
    from services import eating_tracker, settings_service

    jit = settings_service.get_settings().get("jit") or {}
    starter = max(2.0, min(5.0, float(jit.get("starter_grams") or 3)))
    profiles = settings_service.get_settings().get("cat_profiles") or {}
    cats = {c.get("name"): c for c in profiles.get("cats", []) if c.get("name")}

    global _abort_slow
    _abort_slow = False
    dispensed = 0.0
    gate_triggered = False
    gated_now = False
    gated_cat = None
    probes_used = 0

    def remaining():
        return round(total_grams - dispensed, 1)

    def dispense(chunk_grams):
        """Ein Häppchen dosieren; meldet die Menge EXAKT an den Tracker."""
        nonlocal dispensed
        if _abort_slow:
            return False, "Fütterung gestoppt"
        if chunk_grams < 0.5:
            return True, ""
        set_plan_dosing(True)
        try:
            base = dispensed

            def cb(fed, _target, elapsed):
                if progress_cb:
                    progress_cb(round(base + fed, 1), total_grams, elapsed)

            ok, message, fed = motor.feed_until_weight(
                target_weight_grams=chunk_grams, timeout_seconds=300, progress_cb=cb)
        finally:
            set_plan_dosing(False)
        fed = max(0.0, fed)
        dispensed = round(dispensed + fed, 1)
        from services import eating_tracker as tracker
        tracker.note_dispensed(fed)
        if progress_cb:
            progress_cb(dispensed, total_grams, 0.0)
        return ok, message

    def withhold_result():
        """Gate hat zugeschlagen und niemand Berechtigtes kam: Rest bewusst
        zurückhalten - das ist das Feature. Der Nutzer wird informiert."""
        rest = remaining()
        try:
            from services import event_log
            event_log.log_event("jit_withheld",
                                f"{rest:g} g zurückgehalten - {gated_cat or '?'} über Budget",
                                grams=rest)
        except Exception:
            pass
        try:
            from services import push_service
            push_service.notify("CatBoter - Pro-Katze-Fütterung",
                                f"{rest:g} g zurückgehalten - {gated_cat or 'Katze'} "
                                f"war über dem Tagesbudget", tag="jit")
        except Exception:
            pass
        return True, (f"JIT: {dispensed:.1f}g ausgegeben, {rest:g}g zurückgehalten "
                      f"({gated_cat or '?'} über Budget)"), dispensed

    ok, message = dispense(min(starter, total_grams))
    if not ok:
        return False, f"{message} (JIT, {dispensed:.1f}g ausgegeben)", dispensed

    start = time.time()
    last_eating = time.time()

    # Rest-Schwelle 0.05: Soll kommt mit 2 Dezimalen, dispensed mit 1 -
    # sonst kann ein 0.03-g-Rest die Sitzung bis zum Deckel festhalten
    while remaining() >= 0.1 and time.time() - start < JIT_SESSION_MAX_S:
        if _abort_slow:
            return False, f"Fütterung gestoppt (JIT): {dispensed:.1f}g ausgegeben", dispensed
        time.sleep(JIT_POLL_S)
        if _abort_slow:
            return False, f"Fütterung gestoppt (JIT): {dispensed:.1f}g ausgegeben", dispensed

        act = eating_tracker.current_activity()
        if act["eating"]:
            last_eating = time.time()

        guess, confidence = act.get("guess"), act.get("confidence")
        if guess is not None:
            cat = cats.get(guess) or {}
            # Konto = abgeschlossene Episoden heute + die LAUFENDE Mahlzeit
            intake = round(eating_tracker.per_cat_today().get(guess, 0.0)
                           + (act.get("consumed") or 0.0), 1)
            # Fürs SPERREN gilt eine höhere Konfidenz-Schwelle als für die Anzeige
            gated_now = ((confidence or 0) >= JIT_GATE_CONFIDENCE
                         and eating_tracker.jit_gate(guess, confidence, intake,
                                                     cat.get("budget_g"), cat.get("min_g")))
            if gated_now and gated_cat != guess:
                gate_triggered = True
                gated_cat = guess
                logging.info(f"JIT: {guess} über Tagesbudget ({intake:.1f}g) - "
                             f"Dosierung pausiert, solange {guess} frisst")
                try:
                    from services import event_log
                    event_log.log_event("jit_gate",
                                        f"{guess} über Budget ({intake:.1f} g) - "
                                        f"Dosierung pausiert", grams=intake)
                except Exception:
                    pass
        # guess None lässt gated_now bewusst STEHEN: die Episode der gesperrten
        # Katze endet genau beim Leerfressen - erst neues Fressen entscheidet neu
        elif act["eating"] and (act.get("duration_s") or 0) >= 30:
            # ABER: frisst jemand seit 30 s, ohne dass die gesperrte Katze
            # sicher erkannt wird, löst sich das Gate - im Zweifel dosieren
            gated_now = False

        # Niemand frisst seit 3 Minuten: Sitzung auflösen
        if time.time() - last_eating >= JIT_IDLE_END_S:
            if not gate_triggered:
                # Gate hat NIE zugeschlagen -> Erkennung spielte keine Rolle.
                # Rest normal in den Napf (Invariante: nie Mahlzeiten kosten)
                ok, message = dispense(remaining())
                if not ok:
                    return False, f"{message} (JIT, {dispensed:.1f}g ausgegeben)", dispensed
                return True, (f"JIT: niemand mehr am Napf - Rest normal ausgegeben "
                              f"({dispensed:.1f}g von {total_grams}g)"), dispensed
            if probes_used == 0:
                # Zweite Chance für die andere Katze: kleines Probe-Häppchen
                probes_used = 1
                gated_now = False
                ok, message = dispense(min(starter, remaining()))
                if not ok:
                    return False, f"{message} (JIT, {dispensed:.1f}g ausgegeben)", dispensed
                last_eating = time.time()
                continue
            return withhold_result()

        # Nachdosieren: Napf leer + KÜRZLICH gefressen + kein aktives Gate.
        # (Nicht act.eating: die Episode stirbt exakt beim Leerfressen)
        if not gated_now and time.time() - last_eating < JIT_RECENT_EATING_S:
            weight = _safe_weight(motor)
            if weight is not None and weight <= 1.0:
                ok, message = dispense(min(JIT_CHUNK_G, remaining()))
                if not ok:
                    return False, f"{message} (JIT, {dispensed:.1f}g ausgegeben)", dispensed

    if remaining() < 0.1:
        return True, f"JIT: {dispensed:.1f}g ausgegeben (Soll {total_grams}g)", dispensed
    # Zeitdeckel erreicht
    if not gate_triggered:
        # Langsame Fresser nicht kürzen: Rest normal ausgeben
        ok, message = dispense(remaining())
        if not ok:
            return False, f"{message} (JIT, {dispensed:.1f}g ausgegeben)", dispensed
        return True, (f"JIT: Zeitdeckel - Rest normal ausgegeben "
                      f"({dispensed:.1f}g von {total_grams}g)"), dispensed
    return withhold_result()


def get_active_feeding():
    with _state_lock:
        return dict(_active) if _active else None


def _set_active(source, target_grams):
    global _active
    with _state_lock:
        _active = {"source": source, "target_grams": round(target_grams, 1), "fed_grams": 0.0}
    try:
        from services import eating_tracker
        eating_tracker.note_dosing()
    except Exception:
        pass


def _update_progress(fed_grams):
    with _state_lock:
        if _active is not None:
            _active["fed_grams"] = round(fed_grams, 1)


def _clear_active():
    global _active
    with _state_lock:
        _active = None
    try:
        from services import eating_tracker
        eating_tracker.note_dosing()
    except Exception:
        pass


def start_manual_feed(amount, slow_minutes=0):
    """Startet eine manuelle Fütterung asynchron (optional Anti-Schling).

    Returns:
        (ok: bool, error: str|None) - ok=False mit Grund, wenn nicht gestartet
    """
    try:
        amount = round(float(amount), 1)
    except (TypeError, ValueError):
        return False, "Ungültige Menge"
    if not (MIN_MANUAL_GRAMS <= amount <= MAX_MANUAL_GRAMS):
        return False, f"Menge muss zwischen {MIN_MANUAL_GRAMS:g} und {MAX_MANUAL_GRAMS:g} g liegen"
    try:
        slow_minutes = max(0, min(MAX_SLOW_MINUTES, int(slow_minutes or 0)))
    except (TypeError, ValueError):
        slow_minutes = 0

    motor = hardware.get_motor()
    weight_sensor = hardware.get_weight_sensor()
    if motor is None or weight_sensor is None:
        return False, "Hardware nicht verfügbar"
    if not weight_sensor.is_ready():
        return False, "Gewichtssensor nicht bereit"

    # Nur eine Fütterung gleichzeitig (Plan ODER manuell)
    if not feeding_lock.acquire(blocking=False):
        return False, "Es läuft bereits eine Fütterung"

    _set_active("manual", amount)
    realtime.socketio.start_background_task(_run_manual_feed, motor, amount, slow_minutes)
    return True, None


def _run_manual_feed(motor, amount, slow_minutes=0):
    realtime.emit_feeding_started("manual", amount)
    success, message, fed = False, "Unbekannter Fehler", 0.0
    try:
        def progress_cb(fed_grams, target_grams, elapsed_s):
            _update_progress(fed_grams)
            realtime.emit_feeding_progress("manual", fed_grams, target_grams, elapsed_s)

        if slow_minutes > 0:
            success, message, fed = chunked_feed(motor, amount, slow_minutes, progress_cb)
        else:
            success, message, fed = motor.feed_until_weight(
                target_weight_grams=amount,
                timeout_seconds=FEED_TIMEOUT_SECONDS,
                progress_cb=progress_cb,
            )

        if fed > 0:
            try:
                consumption_manager.add_feeding(fed, source="manual")
            except Exception as e:
                logging.warning(f"Manuelle Fütterung: Tracking fehlgeschlagen: {e}")

        logging.info(f"Manuelle Fütterung beendet: success={success}, fed={fed:.1f}g, message={message}")
    except Exception as e:
        message = f"Fehler bei manueller Fütterung: {e}"
        logging.error(message)
    finally:
        _clear_active()
        try:
            feeding_lock.release()
        except RuntimeError:
            pass
        aborted = "gestoppt" in message.lower()
        realtime.emit_feeding_completed("manual", success, aborted, fed, amount, message)


def stop_feeding():
    """Stoppt jede laufende Fütterung (manuell UND Plan) sowie den Motor."""
    global _abort_slow
    _abort_slow = True  # beendet auch Anti-Schling-Pausen
    motor = hardware.get_motor()
    if motor is None:
        return False, "Motor nicht verfügbar"
    motor.stop_motor()
    return True, None
