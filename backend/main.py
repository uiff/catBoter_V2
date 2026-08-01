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


# Verbundene Clients (fürs Weight-Streaming: ohne Zuschauer keine Messungen)
_clients = {"count": 0}


@socketio.on('connect')
def handle_connect():
    _clients["count"] += 1
    logging.info(f"WebSocket: Client verbunden - {request.sid} ({_clients['count']} aktiv)")


@socketio.on('disconnect')
def handle_disconnect():
    _clients["count"] = max(0, _clients["count"] - 1)
    logging.info(f"WebSocket: Client getrennt - {request.sid} ({_clients['count']} aktiv)")


@socketio.on('request_update')
def handle_request_update():
    """Client fordert sofortiges Update an."""
    try:
        from flask_socketio import emit
        emit('sensor_update', _sensor_snapshot())
    except Exception as e:
        logging.error(f"request_update error: {e}")


def background_sensor_polling():
    """Pusht alle 5 s den Sensor-Zustand; zusätzlich: Tank-Tages-Snapshot,
    Gesundheits-Monitor, Tank-Warn-Push (Zustandswechsel) und MQTT-Status."""
    from services import health_monitor, mqtt_service, settings_service, feeding_service
    from services import eating_tracker
    logging.info("Background Sensor Polling gestartet (5 s Intervall)")
    last_date = datetime.date.today()
    last_total = 0.0
    last_below_warn = None  # None = noch kein Messwert (kein Push beim Start)
    while True:
        try:
            snapshot = _sensor_snapshot()
            realtime.emit_sensor_update(snapshot)

            # Gesundheits-Monitor (Fressverhalten aus der Gewichtskurve)
            try:
                hours = settings_service.get_settings().get('untouched_alert_hours', 12)
                health_monitor.sample(snapshot.get('weight'), hours)
            except Exception as e:
                logging.debug(f"Health-Sample Fehler: {e}")

            # Fress-Episoden (Katzen-Signatur) + Hand-Nachfüllungen - nur wenn
            # gerade NICHT dosiert wird (Motor hebt das Gewicht selbst an).
            # is_dosing() deckt manuelle UND Plan-Feeds inkl. Anti-Schling-
            # Pausen ab - bewusst NICHT der feeding_lock, den hält der
            # Scheduler jede Minute kurz auch ohne Fütterung
            try:
                dosing = snapshot.get('motor_running') or feeding_service.is_dosing()
                eating_tracker.sample(snapshot.get('weight'), bool(dosing))
            except Exception as e:
                logging.debug(f"Fress-Tracker Fehler: {e}")

            # Tank-Warnung als Push - Schwelle aus den App-Einstellungen
            # (tank_warn_percent), nur beim Unterschreiten (kein Spam)
            percent = (snapshot.get('tank') or {}).get('percent')
            if percent is not None:
                try:
                    warn = settings_service.get_settings().get('tank_warn_percent', 20)
                except Exception:
                    warn = 20
                below = percent < warn
                if below and last_below_warn is False:
                    try:
                        from services import push_service
                        push_service.notify('CatBoter - Tank',
                                            f'Füllstand niedrig ({percent:.0f} %) - bitte nachfüllen',
                                            tag='tank')
                    except Exception as e:
                        logging.debug(f"Tank-Push fehlgeschlagen: {e}")
                last_below_warn = below

            # MQTT-Status (retained, nur bei Änderung)
            try:
                mqtt_service.publish_status(
                    snapshot,
                    next_feeding=feedingControl.get_next_feeding_time(),
                    feeding_active=feeding_service.get_active_feeding(),
                )
            except Exception as e:
                logging.debug(f"MQTT-Status Fehler: {e}")

            today = datetime.date.today()
            if today != last_date:
                # last_total ist der letzte Stand des VORTAGES
                try:
                    tank_service.record_daily_snapshot(last_total)
                except Exception as e:
                    logging.warning(f"Tank-Snapshot fehlgeschlagen: {e}")
                # Tägliche Gesundheits-Checks: Appetit-Trend + fällige Erinnerungen
                try:
                    health_monitor.check_appetite_daily()
                except Exception as e:
                    logging.warning(f"Appetit-Check fehlgeschlagen: {e}")
                try:
                    from services import care_service
                    care_service.check_reminders_daily()
                except Exception as e:
                    logging.warning(f"Erinnerungs-Check fehlgeschlagen: {e}")
                last_date = today
            last_total = snapshot.get('today_total') or 0.0
        except Exception as e:
            logging.error(f"Sensor-Polling Fehler: {e}")
        eventlet.sleep(5)


def background_weight_streaming():
    """Schneller Nur-Gewicht-Kanal: 0.5-s-Takt, solange Clients verbunden sind.

    Pausiert während einer Dosierung - der Regelkreis liest den Sensor dann
    selbst (und streamt feeding_progress); ein zweiter Leser würde nur um das
    Sensor-Lock konkurrieren. Gesendet wird nur bei Änderung >= 0.1 g; der
    5-s-sensor_update bleibt die vollständige Wahrheit (Tank, Tagesmenge).
    """
    from services import feeding_service
    logging.info("Weight-Streaming gestartet (0.5 s Intervall bei verbundenen Clients)")
    last_sent = None
    while True:
        try:
            if (_clients["count"] > 0 and not motor_running()
                    and not feeding_service.is_dosing()):
                weight = get_cached_weight()
                if weight is not None and (last_sent is None
                                           or abs(weight - last_sent) >= 0.1):
                    realtime.emit_weight_update(weight)
                    last_sent = weight
        except Exception as e:
            logging.debug(f"Weight-Streaming Fehler: {e}")
        eventlet.sleep(0.5 if _clients["count"] > 0 else 2)


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
        logging.info(f"CatBoter V3.2 startet - Daten-Verzeichnis: {DATA_DIR}")

        # Ereignis-Log: alte Einträge aufräumen (Speicher-Budget) + Start markieren
        from services import event_log
        event_log.compact()
        event_log.log_event("backend_start", "Backend gestartet")

        # Plan-Fütterungen senden Realtime-Events
        feedingControl.set_feeding_notifier(_FeedingNotifier())

        # MQTT starten (falls in den Einstellungen aktiviert)
        try:
            from services import mqtt_service
            mqtt_service.apply_settings()
        except Exception as e:
            logging.warning(f"MQTT-Start fehlgeschlagen: {e}")

        # Hintergrund-Tasks (explizit hier, nicht als Import-Nebenwirkung)
        eventlet.spawn(background_sensor_polling)
        eventlet.spawn(background_weight_streaming)
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
