"""MQTT-Integration (Home Assistant & Co.) - Zwei-Topic-Struktur:

- catboter/status   (retained, JSON): kompletter Zustand, Publish bei Änderung
- catboter/command  (subscribe, JSON): {"action": "feed"|"stop"|"pause"|"resume", ...}
- catboter/event    (nicht retained): Fütterungs-Abschlüsse/Fehler

Optional ha_discovery: publiziert zusätzlich Home-Assistant-Discovery-Configs.
"""
import json
import logging
import threading

TOPIC_STATUS = "catboter/status"
TOPIC_COMMAND = "catboter/command"
TOPIC_EVENT = "catboter/event"

_lock = threading.Lock()
_client = None
_last_status_json = None
_connected = False


def is_connected() -> bool:
    return _connected


def apply_settings():
    """(Neu-)Konfiguration aus app_settings - bei Start und nach Änderungen."""
    global _client, _connected, _last_status_json
    from services import settings_service
    config = settings_service.get_settings().get("mqtt") or {}

    with _lock:
        if _client is not None:
            try:
                # Sauber abmelden: retained-Status auf offline setzen, sonst
                # zeigt der Broker (und Home Assistant) ewig "online": true -
                # das Last-Will greift nur bei UNsauberen Trennungen
                if _connected:
                    _client.publish(TOPIC_STATUS, json.dumps({"online": False}),
                                    retain=True).wait_for_publish(timeout=3)
                _client.loop_stop()
                _client.disconnect()
            except Exception:
                pass
            _client = None
            _connected = False
            _last_status_json = None

        if not config.get("enabled") or not config.get("host"):
            logging.info("MQTT: deaktiviert")
            return

        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            logging.error("MQTT: paho-mqtt nicht installiert")
            return

        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                             client_id="catboter", clean_session=True)
        if config.get("username"):
            client.username_pw_set(config["username"], config.get("password") or None)
        client.will_set(TOPIC_STATUS, json.dumps({"online": False}), retain=True)

        client.on_connect = _on_connect
        client.on_disconnect = _on_disconnect
        client.on_message = _on_message
        client.reconnect_delay_set(min_delay=2, max_delay=60)

        try:
            client.connect_async(config["host"], int(config.get("port") or 1883), keepalive=30)
            client.loop_start()
            _client = client
            logging.info(f"MQTT: verbinde mit {config['host']}:{config.get('port', 1883)}")
        except Exception as e:
            logging.error(f"MQTT: Verbindung fehlgeschlagen: {e}")
            _client = None


def _on_connect(client, userdata, flags, reason_code, properties):
    global _connected, _last_status_json
    _connected = reason_code == 0
    if _connected:
        logging.info("MQTT: verbunden")
        client.subscribe(TOPIC_COMMAND)
        _last_status_json = None  # Status frisch publizieren
        _publish_discovery_if_enabled(client)
    else:
        logging.warning(f"MQTT: Verbindung abgelehnt ({reason_code})")


def _on_disconnect(client, userdata, flags, reason_code, properties):
    global _connected
    _connected = False
    logging.info("MQTT: getrennt")


def _on_message(client, userdata, message):
    """Steuer-Topic: feed / stop / pause / resume."""
    try:
        payload = json.loads(message.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        logging.warning("MQTT: ungültiges Command-JSON")
        return
    action = payload.get("action")
    logging.info(f"MQTT: Befehl {action}")
    try:
        from services import feeding_service, settings_service
        if action == "feed":
            ok, error = feeding_service.start_manual_feed(
                payload.get("grams", 10), payload.get("slow_minutes", 0))
            if not ok:
                publish_event({"type": "command_rejected", "detail": error})
        elif action == "stop":
            feeding_service.stop_feeding()
        elif action == "pause":
            from logic.feedingControl import parse_pause_timestamp
            from datetime import datetime
            until = parse_pause_timestamp(payload.get("until"))
            if until is None or until <= datetime.now():
                publish_event({"type": "command_rejected",
                               "detail": "Ungültiger oder vergangener Pause-Zeitpunkt"})
            else:
                settings_service.update_settings({"paused_until": until.isoformat()})
        elif action == "resume":
            settings_service.update_settings({"paused_until": None})
    except Exception as e:
        logging.error(f"MQTT: Befehl fehlgeschlagen: {e}")


def publish_status(snapshot: dict, next_feeding=None, feeding_active=None):
    """Vom Sensor-Polling-Loop: nur bei Änderung publizieren (retained)."""
    global _last_status_json
    if _client is None or not _connected:
        return
    tank = snapshot.get("tank") or {}
    status = {
        "tank_percent": tank.get("percent"),
        "tank_state": tank.get("state"),
        "weight_g": snapshot.get("weight"),
        "today_g": snapshot.get("today_total"),
        "next_feeding": next_feeding,
        "motor_running": snapshot.get("motor_running"),
        "feeding_active": feeding_active,
        "range_days": tank.get("range_days"),
        "online": True,
    }
    encoded = json.dumps(status, sort_keys=True)
    if encoded == _last_status_json:
        return
    _last_status_json = encoded
    try:
        _client.publish(TOPIC_STATUS, encoded, retain=True)
    except Exception as e:
        logging.debug(f"MQTT publish_status: {e}")


def publish_event(event: dict):
    if _client is None or not _connected:
        return
    try:
        _client.publish(TOPIC_EVENT, json.dumps(event))
    except Exception as e:
        logging.debug(f"MQTT publish_event: {e}")


def _publish_discovery_if_enabled(client):
    """Optional: Home-Assistant-Discovery (Entitäten erscheinen automatisch)."""
    from services import settings_service
    if not settings_service.get_settings().get("ha_discovery"):
        return
    device = {"identifiers": ["catboter"], "name": "CatBoter",
              "manufacturer": "iotueli", "model": "CatBoter V3"}
    sensors = [
        ("tank", "Tank", "tank_percent", "%", "mdi:silo"),
        ("weight", "Napf", "weight_g", "g", "mdi:scale"),
        ("today", "Heute gefüttert", "today_g", "g", "mdi:food-drumstick"),
        ("range", "Reichweite", "range_days", "d", "mdi:calendar-clock"),
    ]
    for key, name, field, unit, icon in sensors:
        config = {
            "name": name,
            "unique_id": f"catboter_{key}",
            "state_topic": TOPIC_STATUS,
            "value_template": f"{{{{ value_json.{field} }}}}",
            "unit_of_measurement": unit,
            "icon": icon,
            "device": device,
        }
        client.publish(f"homeassistant/sensor/catboter_{key}/config",
                       json.dumps(config), retain=True)
    client.publish("homeassistant/binary_sensor/catboter_motor/config", json.dumps({
        "name": "Motor", "unique_id": "catboter_motor",
        "state_topic": TOPIC_STATUS,
        "value_template": "{{ 'ON' if value_json.motor_running else 'OFF' }}",
        "device": device,
    }), retain=True)
    logging.info("MQTT: HA-Discovery publiziert")
