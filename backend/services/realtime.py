"""Socket.IO-Instanz und Emit-Helper.

Die socketio-Instanz wird hier OHNE App erzeugt und in main.py per
init_app(app) verdrahtet - so können Services und Blueprints emitten,
ohne main.py zu importieren (keine Zirkular-Imports).

logger/engineio_logger MÜSSEN False bleiben: True loggt jedes Event an
jeden Client auf INFO-Level und hat so eine 946-MB-Logdatei erzeugt.
"""
import logging

from flask_socketio import SocketIO

socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=False,
    engineio_logger=False,
)


def emit_sensor_update(payload: dict):
    try:
        socketio.emit("sensor_update", payload)
    except Exception as e:
        logging.debug(f"emit sensor_update fehlgeschlagen: {e}")


def emit_feeding_started(source: str, target_grams: float):
    try:
        socketio.emit("feeding_started", {
            "source": source,
            "target_grams": round(float(target_grams), 1),
        })
    except Exception as e:
        logging.debug(f"emit feeding_started fehlgeschlagen: {e}")


def emit_feeding_progress(source: str, fed_grams: float, target_grams: float, elapsed_s: float):
    try:
        socketio.emit("feeding_progress", {
            "source": source,
            "fed_grams": round(float(fed_grams), 1),
            "target_grams": round(float(target_grams), 1),
            "elapsed_s": round(float(elapsed_s), 1),
        })
    except Exception as e:
        logging.debug(f"emit feeding_progress fehlgeschlagen: {e}")


def emit_feeding_completed(source: str, success: bool, aborted: bool,
                           fed_grams: float, target_grams: float, message: str):
    try:
        socketio.emit("feeding_completed", {
            "source": source,
            "success": bool(success),
            "aborted": bool(aborted),
            "fed_grams": round(float(fed_grams), 1),
            "target_grams": round(float(target_grams), 1),
            "message": message,
        })
    except Exception as e:
        logging.debug(f"emit feeding_completed fehlgeschlagen: {e}")


def emit_plans_updated():
    try:
        socketio.emit("plans_updated", {})
    except Exception as e:
        logging.debug(f"emit plans_updated fehlgeschlagen: {e}")
