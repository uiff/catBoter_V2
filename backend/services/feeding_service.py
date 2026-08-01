"""Manuelle Fütterung über denselben geregelten Pfad wie der Fütterungsplan.

Läuft als Background-Task (eventlet-Greenlet); Fortschritt geht als
Socket.IO-Events raus. feeding_lock serialisiert gegen den Plan-Scheduler.
"""
import logging
import threading

from core.config import MIN_MANUAL_GRAMS, MAX_MANUAL_GRAMS, FEED_TIMEOUT_SECONDS
from core.locks import feeding_lock
from services import hardware, realtime
from services.consumption_manager import consumption_manager

# Zustand der aktuell laufenden Fütterung (für GET /motor/status)
_state_lock = threading.Lock()
_active = None  # None oder {"source", "target_grams", "fed_grams"}


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


def start_manual_feed(amount):
    """Startet eine manuelle Fütterung asynchron.

    Returns:
        (ok: bool, error: str|None) - ok=False mit Grund, wenn nicht gestartet
    """
    try:
        amount = round(float(amount), 1)
    except (TypeError, ValueError):
        return False, "Ungültige Menge"
    if not (MIN_MANUAL_GRAMS <= amount <= MAX_MANUAL_GRAMS):
        return False, f"Menge muss zwischen {MIN_MANUAL_GRAMS:g} und {MAX_MANUAL_GRAMS:g} g liegen"

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
    realtime.socketio.start_background_task(_run_manual_feed, motor, amount)
    return True, None


def _run_manual_feed(motor, amount):
    realtime.emit_feeding_started("manual", amount)
    success, message, fed = False, "Unbekannter Fehler", 0.0
    try:
        def progress_cb(fed_grams, target_grams, elapsed_s):
            _update_progress(fed_grams)
            realtime.emit_feeding_progress("manual", fed_grams, target_grams, elapsed_s)

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
    motor = hardware.get_motor()
    if motor is None:
        return False, "Motor nicht verfügbar"
    motor.stop_motor()
    return True, None
