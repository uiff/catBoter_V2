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
            slept = 0.0
            while slept < pause_s:
                if _abort_slow:
                    return False, (f"Fütterung gestoppt: Nur {fed_total:.1f}g gefüttert "
                                   f"(Soll: {amount}g)"), fed_total
                time.sleep(1)
                slept += 1

    return True, f"{fed_total:.1f}g gefüttert in {chunks} Schüben (Soll: {amount}g)", fed_total


def get_active_feeding():
    with _state_lock:
        return dict(_active) if _active else None


def _set_active(source, target_grams):
    global _active
    with _state_lock:
        _active = {"source": source, "target_grams": round(target_grams, 1), "fed_grams": 0.0}


def _update_progress(fed_grams):
    with _state_lock:
        if _active is not None:
            _active["fed_grams"] = round(fed_grams, 1)


def _clear_active():
    global _active
    with _state_lock:
        _active = None


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
