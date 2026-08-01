# WICHTIG: eventlet monkey patching MUSS vor allen anderen Imports sein!
import eventlet
eventlet.monkey_patch()

import datetime
import logging
import sys
from pathlib import Path

from flask import Flask, request
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Basisverzeichnis in den Suchpfad (Paket-Imports: core/, services/, api/, logic/, SensorAktor/)
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from core.config import DATA_DIR
from services import realtime
from services.realtime import socketio
from services.sensor_service import get_cached_weight, motor_running
from services import tank_service, feeding_service, hardware
from services.consumption_manager import consumption_manager
from logic import feedingControl
from api import register_blueprints


def _sensor_snapshot():
    """Aktueller Sensor-Zustand - identische Struktur für /dashboard und sensor_update."""
    return {
        'weight': get_cached_weight(),
        'tank': tank_service.read_tank(),
        'motor_running': motor_running(),
        'today_total': consumption_manager.get_today_total(),
        'timestamp': datetime.datetime.now().isoformat(),
    }


def create_app():
    app = Flask(__name__)
    CORS(app)
    register_blueprints(app)
    socketio.init_app(app)
    return app


app = create_app()


@socketio.on('connect')
def handle_connect():
    logging.info(f"WebSocket: Client verbunden - {request.sid}")


@socketio.on('disconnect')
def handle_disconnect():
    logging.info(f"WebSocket: Client getrennt - {request.sid}")


@socketio.on('request_update')
def handle_request_update():
    """Client fordert sofortiges Update an."""
    try:
        from flask_socketio import emit
        emit('sensor_update', _sensor_snapshot())
    except Exception as e:
        logging.error(f"request_update error: {e}")


def background_sensor_polling():
    """Pusht alle 5 s den Sensor-Zustand an alle Clients."""
    logging.info("Background Sensor Polling gestartet (5 s Intervall)")
    while True:
        try:
            realtime.emit_sensor_update(_sensor_snapshot())
        except Exception as e:
            logging.error(f"Sensor-Polling Fehler: {e}")
        eventlet.sleep(5)


def feeding_status_scheduler():
    """Prüft jede Minute, ob eine geplante Fütterung fällig ist."""
    logging.info("Fütterungs-Scheduler gestartet (60 s Intervall)")
    while True:
        try:
            feedingControl.aktualisiere_fütterungsstatus()
        except Exception as e:
            logging.error(f"Feeding Scheduler Fehler: {e}")
        eventlet.sleep(60)


class _FeedingNotifier:
    """Verdrahtet Plan-Fütterungen mit den Realtime-Events."""
    started = staticmethod(realtime.emit_feeding_started)
    progress = staticmethod(realtime.emit_feeding_progress)
    completed = staticmethod(realtime.emit_feeding_completed)


if __name__ == '__main__':
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        logging.info(f"CatBoter V3.1 startet - Daten-Verzeichnis: {DATA_DIR}")

        # Plan-Fütterungen senden Realtime-Events
        feedingControl.set_feeding_notifier(_FeedingNotifier())

        # Hintergrund-Tasks (explizit hier, nicht als Import-Nebenwirkung)
        eventlet.spawn(background_sensor_polling)
        eventlet.spawn(feeding_status_scheduler)

        socketio.run(
            app,
            host='0.0.0.0',
            port=5000,
            debug=False,
            use_reloader=False,
        )
    except KeyboardInterrupt:
        logging.info("Server wird heruntergefahren...")
    finally:
        try:
            hardware.cleanup()
            logging.info("Cleanup abgeschlossen")
        except Exception as e:
            logging.error(f"Cleanup-Fehler: {e}")
