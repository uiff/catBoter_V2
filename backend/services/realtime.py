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


def emit_weight_update(weight: float):
    """Schneller Nur-Gewicht-Kanal (0.5 s Takt) - hält die Napf-Anzeige flüssig,
    ohne den vollen sensor_update (Tank-Distanzmessung!) zu beschleunigen."""
    try:
        socketio.emit("weight_update", {"weight": round(float(weight), 1)})
    except Exception as e:
        logging.debug(f"emit weight_update fehlgeschlagen: {e}")


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
    # Zentrale Stelle für Ereignis-Verlauf, Fehl-Push, Gesundheits-Monitor und
    # MQTT-Event: beide Pfade (Plan + manuell) laufen hier durch
    try:
        from services import event_log
        label = "manuell" if source == "manual" else "Plan"
        event_log.log_event(
            "feeding_completed" if success else "feeding_failed",
            f"{label}: {message}",
            grams=fed_grams,
        )
    except Exception as e:
        logging.debug(f"Event-Log feeding fehlgeschlagen: {e}")

    if not success and not aborted:
        try:
            from services import push_service
            push_service.notify("CatBoter - Fütterung fehlgeschlagen", message, tag="feeding")
        except Exception as e:
            logging.debug(f"Fehl-Push fehlgeschlagen: {e}")

    if success and fed_grams > 0:
        try:
            from services import health_monitor
            health_monitor.on_feeding_completed(fed_grams)
        except Exception as e:
            logging.debug(f"Health-Hook fehlgeschlagen: {e}")

    try:
        from services import mqtt_service
        mqtt_service.publish_event({
            "type": "feeding_completed" if success else "feeding_failed",
            "source": source,
            "fed_grams": round(float(fed_grams), 1),
            "message": message,
        })
    except Exception as e:
        logging.debug(f"MQTT-Event fehlgeschlagen: {e}")


def emit_plans_updated():
    try:
        socketio.emit("plans_updated", {})
    except Exception as e:
        logging.debug(f"emit plans_updated fehlgeschlagen: {e}")
