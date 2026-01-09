"""
WebSocket Handler für CatBoter V3
Echtzeit-Kommunikation zwischen Frontend und Backend

Features:
- Automatische Sensor-Updates nur bei Änderungen
- Bi-direktionale Kommunikation
- Minimaler Netzwerk-Traffic
- Batterie-schonend
"""

import logging
import time
from threading import Thread, Lock
from flask_socketio import SocketIO, emit
from typing import Optional, Dict, Any

# WebSocket-Konfiguration
socketio = None
_last_sensor_data: Dict[str, Any] = {
    'weight': None,
    'distance': None,
    'motor': None,
    'total_consumed_today': None
}
_last_update_time = 0
_data_lock = Lock()

# Threshold für Änderungserkennung (erhöht für Stabilität)
WEIGHT_THRESHOLD = 1.0  # gram (reduziert Springen)
DISTANCE_THRESHOLD = 1.0  # percent (reduziert Springen)
UPDATE_MIN_INTERVAL = 0.5  # seconds (2 updates/second, reduziert Flackern)

# Gleitender Durchschnitt für Sensor-Glättung
_weight_buffer = []
_distance_buffer = []
BUFFER_SIZE = 3  # Durchschnitt über 3 Messungen (schnellere Reaktion)


def init_websocket(app):
    """Initialisiere SocketIO mit Flask App"""
    global socketio

    socketio = SocketIO(
        app,
        cors_allowed_origins="*",  # In Production einschränken!
        async_mode='threading',
        logger=False,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25
    )

    logging.info("🔌 WebSocket initialisiert")

    # Event Handler registrieren
    register_events()

    return socketio


def smooth_value(buffer, new_value, buffer_size=BUFFER_SIZE):
    """
    Glättet Sensor-Werte mit gleitendem Durchschnitt
    """
    if new_value is None:
        return None

    # Füge neuen Wert hinzu
    buffer.append(new_value)

    # Halte Buffer-Größe konstant
    if len(buffer) > buffer_size:
        buffer.pop(0)

    # Berechne Durchschnitt
    if len(buffer) > 0:
        return round(sum(buffer) / len(buffer), 1)

    return new_value


def register_events():
    """Registriere WebSocket-Event-Handler"""

    @socketio.on('connect')
    def handle_connect():
        logging.info(f"✅ WebSocket-Client verbunden")
        # Sende initiale Daten sofort beim Connect
        emit('sensor_update', _last_sensor_data)

    @socketio.on('disconnect')
    def handle_disconnect():
        logging.info(f"❌ WebSocket-Client getrennt")

    @socketio.on('request_update')
    def handle_request_update():
        """Client fordert aktuelle Daten an"""
        logging.debug("🔄 Client fordert Update an")
        emit('sensor_update', _last_sensor_data)

    @socketio.on('motor_command')
    def handle_motor_command(data):
        """Client sendet Motor-Befehl"""
        logging.info(f"🎮 Motor-Befehl empfangen: {data}")
        # Dieser Event wird vom Frontend gesendet
        # Backend verarbeitet ihn und sendet Update zurück
        return {'status': 'received', 'command': data}


def should_send_update(new_data: Dict[str, Any]) -> bool:
    """
    Prüft ob ein Update gesendet werden soll
    Nur bei signifikanten Änderungen
    """
    global _last_sensor_data, _last_update_time

    with _data_lock:
        now = time.time()

        # Rate-Limiting: Max 5 Updates pro Sekunde
        if now - _last_update_time < UPDATE_MIN_INTERVAL:
            return False

        # Keine Daten vorhanden - immer senden
        if _last_sensor_data.get('weight') is None:
            return True

        # Gewicht geändert?
        old_weight = _last_sensor_data.get('weight', 0) or 0
        new_weight = new_data.get('weight', 0) or 0
        if abs(new_weight - old_weight) >= WEIGHT_THRESHOLD:
            logging.debug(f"⚖️  Gewicht geändert: {old_weight:.1f}g → {new_weight:.1f}g")
            return True

        # Füllstand geändert?
        old_distance = _last_sensor_data.get('distance', 0) or 0
        new_distance = new_data.get('distance', 0) or 0
        if abs(new_distance - old_distance) >= DISTANCE_THRESHOLD:
            logging.debug(f"📏 Füllstand geändert: {old_distance:.0f}% → {new_distance:.0f}%")
            return True

        # Motor-Status geändert?
        if _last_sensor_data.get('motor') != new_data.get('motor'):
            logging.debug(f"⚙️  Motor-Status geändert")
            return True

        # Tagesverbrauch geändert?
        old_consumed = _last_sensor_data.get('total_consumed_today', 0) or 0
        new_consumed = new_data.get('total_consumed_today', 0) or 0
        if abs(new_consumed - old_consumed) >= 0.1:  # 0.1g Änderung
            logging.debug(f"📊 Tagesverbrauch geändert: {old_consumed:.1f}g → {new_consumed:.1f}g")
            return True

        return False


def broadcast_sensor_update(sensor_data: Dict[str, Any]):
    """
    Sende Sensor-Update an alle verbundenen Clients
    Nur wenn signifikante Änderung vorliegt
    """
    global _last_sensor_data, _last_update_time

    if not socketio:
        return

    # Prüfe ob Update nötig ist
    if should_send_update(sensor_data):
        with _data_lock:
            _last_sensor_data = sensor_data.copy()
            _last_update_time = time.time()

        # Broadcast an alle Clients
        socketio.emit('sensor_update', sensor_data)
        logging.debug(f"📡 Sensor-Update gesendet: weight={sensor_data.get('weight')}, distance={sensor_data.get('distance')}")


def broadcast_motor_update(motor_status: int):
    """Sende Motor-Status-Update"""
    if not socketio:
        return

    socketio.emit('motor_update', {'status': motor_status})
    logging.debug(f"📡 Motor-Update gesendet: {motor_status}")


def broadcast_feeding_event(feeding_data: Dict[str, Any]):
    """Sende Fütterungs-Event"""
    if not socketio:
        return

    socketio.emit('feeding_event', feeding_data)
    logging.info(f"📡 Fütterungs-Event gesendet: {feeding_data}")


def broadcast_alert(alert_type: str, message: str, severity: str = 'warning'):
    """Sende Alert/Warnung an Clients"""
    if not socketio:
        return

    alert_data = {
        'type': alert_type,
        'message': message,
        'severity': severity,
        'timestamp': time.time()
    }

    socketio.emit('alert', alert_data)
    logging.info(f"📡 Alert gesendet: {alert_type} - {message}")


# Hintergrund-Thread für periodische Updates (Fallback)
def background_sensor_broadcaster(hardware_manager, consumption_manager):
    """
    Hintergrund-Thread der regelmäßig Sensordaten broadcastet
    Mit Glättung für stabile Anzeige
    """
    global _weight_buffer, _distance_buffer
    logging.info("🔄 WebSocket Broadcast-Thread gestartet")

    while True:
        try:
            time.sleep(0.2)  # 5x pro Sekunde (reduziert CPU-Last)

            # Hole aktuelle Sensordaten
            weight_sensor = hardware_manager.get_weight_sensor()
            distance_sensor = hardware_manager.get_distance_sensor()
            motor = hardware_manager.get_motor()

            weight = None
            distance = None
            motor_status = 0

            # Gewicht mit Glättung
            if weight_sensor:
                try:
                    raw_weight = weight_sensor.get_weight()
                    weight = smooth_value(_weight_buffer, raw_weight)
                except Exception as e:
                    logging.debug(f"WebSocket: Gewicht-Fehler: {e}")

            # Füllstand mit Glättung
            if distance_sensor:
                try:
                    raw_distance = distance_sensor.get_distance()
                    distance = smooth_value(_distance_buffer, raw_distance)
                except Exception as e:
                    logging.debug(f"WebSocket: Distance-Fehler: {e}")

            # Motor
            if motor:
                try:
                    if hasattr(motor, 'status'):
                        motor_status = 1 if motor.status() else 0
                    elif hasattr(motor, 'is_running'):
                        motor_status = 1 if motor.is_running() else 0
                except:
                    motor_status = 0

            # Tagesverbrauch
            total_consumed = 0.0
            if consumption_manager:
                try:
                    total_consumed = consumption_manager.get_today_total()
                except:
                    pass

            # Erstelle Daten-Paket
            sensor_data = {
                'weight': weight,
                'distance': distance,
                'motor': motor_status,
                'total_consumed_today': total_consumed,
                'timestamp': time.time()
            }

            # Broadcast nur bei Änderungen
            broadcast_sensor_update(sensor_data)

        except Exception as e:
            logging.error(f"WebSocket Broadcast-Fehler: {e}")


def start_background_broadcaster(hardware_manager, consumption_manager):
    """Starte Hintergrund-Broadcast-Thread"""
    thread = Thread(
        target=background_sensor_broadcaster,
        args=(hardware_manager, consumption_manager),
        daemon=True,
        name="WebSocket-Broadcaster"
    )
    thread.start()
    logging.info("🚀 WebSocket Background-Broadcaster gestartet")
