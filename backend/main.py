import os
import sys
import json
import time
from time import sleep
import datetime
import threading
from threading import Thread, Lock
from flask import Flask, jsonify, request, redirect, send_from_directory
from flask_cors import CORS
from flask_swagger_ui import get_swaggerui_blueprint
import logging
from pathlib import Path

# Performance-Optimierungen (nur Standard Libraries)
from functools import lru_cache
import concurrent.futures
from threading import Timer
import time as time_module

# Simple Cache-Implementierung ohne externe Dependencies
class SimpleCache:
    """Einfacher Cache mit TTL ohne externe Dependencies"""
    def __init__(self):
        self.weight_cache = {'data': None, 'timestamp': 0, 'ttl': 10}  # 10s - Gewicht ändert sich langsam
        self.distance_cache = {'data': None, 'timestamp': 0, 'ttl': 10}  # 10s - Füllstand ändert sich langsam
        self.motor_cache = {'data': None, 'timestamp': 0, 'ttl': 1}  # 1s - Motor-Status muss schnell sein
        self.system_cache = {'data': None, 'timestamp': 0, 'ttl': 30}  # 30s - System-Info ändert sich selten
        self.feeding_cache = {'data': None, 'timestamp': 0, 'ttl': 5}  # 5s - Fütterungsstatus
        self.lock = Lock()
    
    def get(self, cache_type: str, key: str):
        with self.lock:
            cache = getattr(self, f"{cache_type}_cache", None)
            if cache and cache['data'] is not None:
                # Prüfe TTL
                if time_module.time() - cache['timestamp'] < cache['ttl']:
                    logging.debug(f"Cache HIT: {cache_type}.{key}")
                    return cache['data']
                else:
                    # Cache abgelaufen
                    cache['data'] = None
            return None
    
    def set(self, cache_type: str, key: str, value):
        with self.lock:
            cache = getattr(self, f"{cache_type}_cache", None)
            if cache is not None:
                cache['data'] = value
                cache['timestamp'] = time_module.time()
                logging.debug(f"Cache SET: {cache_type}.{key}")
    
    def clear_all(self):
        with self.lock:
            for cache_name in ['weight_cache', 'distance_cache', 'motor_cache', 'system_cache', 'feeding_cache']:
                cache = getattr(self, cache_name)
                cache['data'] = None
                cache['timestamp'] = 0

# Logging konfigurieren
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Basisverzeichnis
base_dir = Path(__file__).parent

# Module importieren
sys.path.append(str(base_dir))
sys.path.append(str(base_dir / "SensorAktor"))
sys.path.append(str(base_dir / "System"))
sys.path.append(str(base_dir / "logic"))
sys.path.append(str(base_dir / "data"))

# Consumption Manager Import
try:
    from data.consumption_manager import consumption_manager
    logging.info("Consumption Manager erfolgreich importiert")
except ImportError as e:
    logging.error(f"Consumption Manager Import fehlgeschlagen: {e}")
    consumption_manager = None

# FEEDING PLAN KONFIGURATION (REPARIERT)
FEEDING_PLAN_DIR = base_dir / "feedingPlan"
FEEDING_PLAN_FILE = FEEDING_PLAN_DIR / "feedingPlans.json"

# FeedingPlan-Verzeichnis anlegen
if not os.path.exists(FEEDING_PLAN_DIR):
    os.makedirs(FEEDING_PLAN_DIR)

try:
    # Dynamische Import-Suche - finde die richtigen Klassennamen
    import sys
    import importlib.util
    
    # Prüfe gewichtssensor.py
    gewicht_path = base_dir / "SensorAktor" / "Gewichtssensor" / "gewichtssensor.py"
    if gewicht_path.exists():
        spec = importlib.util.spec_from_file_location("gewichtssensor", gewicht_path)
        gewicht_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gewicht_module)
        
        # Finde Gewichtssensor-Klasse
        for attr_name in dir(gewicht_module):
            attr = getattr(gewicht_module, attr_name)
            if isinstance(attr, type) and 'sensor' in attr_name.lower():
                WeightSensor = attr
                logging.info(f"Gewichtssensor-Klasse gefunden: {attr_name}")
                break
        else:
            # Fallback: Erste Klasse die nicht __ hat
            for attr_name in dir(gewicht_module):
                attr = getattr(gewicht_module, attr_name)
                if isinstance(attr, type) and not attr_name.startswith('_'):
                    WeightSensor = attr
                    logging.info(f"Gewichtssensor-Klasse (Fallback): {attr_name}")
                    break
            else:
                WeightSensor = None
    else:
        WeightSensor = None
    
    # Prüfe distance_sensor.py
    distance_path = base_dir / "SensorAktor" / "Distanzsensor" / "distance_sensor.py"
    if distance_path.exists():
        spec = importlib.util.spec_from_file_location("distance_sensor", distance_path)
        distance_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(distance_module)
        
        # Finde Distance-Sensor-Klasse
        for attr_name in dir(distance_module):
            attr = getattr(distance_module, attr_name)
            if isinstance(attr, type) and ('vl53' in attr_name.lower() or 'sensor' in attr_name.lower()):
                VL53L0XSensor = attr
                logging.info(f"Distance-Sensor-Klasse gefunden: {attr_name}")
                break
        else:
            for attr_name in dir(distance_module):
                attr = getattr(distance_module, attr_name)
                if isinstance(attr, type) and not attr_name.startswith('_'):
                    VL53L0XSensor = attr
                    logging.info(f"Distance-Sensor-Klasse (Fallback): {attr_name}")
                    break
            else:
                VL53L0XSensor = None
    else:
        VL53L0XSensor = None
    
    # Prüfe motor_control.py
    motor_path = base_dir / "SensorAktor" / "Motor" / "motor_control.py"
    if motor_path.exists():
        spec = importlib.util.spec_from_file_location("motor_control", motor_path)
        motor_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(motor_module)
        
        # Finde Motor-Klasse
        for attr_name in dir(motor_module):
            attr = getattr(motor_module, attr_name)
            if isinstance(attr, type) and ('motor' in attr_name.lower() or 'driver' in attr_name.lower()):
                MotorController = attr
                logging.info(f"Motor-Klasse gefunden: {attr_name}")
                break
        else:
            for attr_name in dir(motor_module):
                attr = getattr(motor_module, attr_name)
                if isinstance(attr, type) and not attr_name.startswith('_'):
                    MotorController = attr
                    logging.info(f"Motor-Klasse (Fallback): {attr_name}")
                    break
            else:
                MotorController = None
    else:
        MotorController = None
    
    # System Import
    try:
        from System import system
    except:
        system = None
    
    # FEEDING CONTROL IMPORTS (REPARIERT)
    try:
        from logic.feedingControl import (
            aktualisiere_fütterungsstatus,
            get_feeding_status,
            load_feeding_plans,
            save_feeding_plans
        )
        logging.info("feedingControl Funktionen erfolgreich importiert")
    except ImportError as e:
        logging.error(f"feedingControl Import fehlgeschlagen: {e}")
        # Fallback-Funktionen
        def aktualisiere_fütterungsstatus():
            return True
        def get_feeding_status():
            return {"error": "feedingControl nicht verfügbar"}
        def load_feeding_plans():
            return []
        def save_feeding_plans(plans):
            return True
    
    logging.info("Dynamischer Import abgeschlossen")
    
except Exception as e:
    logging.error(f"Dynamischer Import fehlgeschlagen: {e}")
    # Kompletter Fallback
    WeightSensor = None
    VL53L0XSensor = None
    MotorController = None
    system = None
    # Fallback-Funktionen für Feeding
    def aktualisiere_fütterungsstatus():
        return True
    def get_feeding_status():
        return {"error": "feedingControl nicht verfügbar"}
    def load_feeding_plans():
        return []
    def save_feeding_plans(plans):
        return True

# Flask App
app = Flask(__name__)
CORS(app)

# Hintergrund-Thread für automatische Fütterungsprüfung
def feeding_status_scheduler():
    logging.info("Starte Hintergrund-Scheduler für automatische Fütterungsprüfung (feeding_status_scheduler)")
    while True:
        try:
            logging.info("Scheduler: Rufe aktualisiere_fütterungsstatus() auf ...")
            aktualisiere_fütterungsstatus()
        except Exception as e:
            logging.error(f"Feeding Status Scheduler Fehler: {e}")
        time.sleep(60)  # Alle 60 Sekunden prüfen

# Starte Scheduler im Hintergrund
Thread(target=feeding_status_scheduler, daemon=True).start()

# Globale Instanzen
smart_cache = SimpleCache()
executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="sensor_")

# Singleton Pattern für Hardware (OHNE FeedingController)
class HardwareManager:
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(HardwareManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._weight_sensor = None
        self._distance_sensor = None
        self._motor = None
        self._sensor_locks = {
            'weight': Lock(),
            'distance': Lock(),
            'motor': Lock()
        }
        self._initialized = True
        logging.info("HardwareManager initialisiert")
    
    def get_weight_sensor(self):
        if self._weight_sensor is None:
            with self._sensor_locks['weight']:
                if self._weight_sensor is None:
                    try:
                        if WeightSensor is not None:
                            self._weight_sensor = WeightSensor()
                            logging.info("WeightSensor initialisiert")
                        else:
                            logging.error("WeightSensor Klasse nicht verfügbar")
                            return None
                    except Exception as e:
                        logging.error(f"WeightSensor Initialisierung fehlgeschlagen: {e}")
                        return None
        return self._weight_sensor
    
    def get_distance_sensor(self):
        if self._distance_sensor is None:
            with self._sensor_locks['distance']:
                if self._distance_sensor is None:
                    try:
                        if VL53L0XSensor is not None:
                            self._distance_sensor = VL53L0XSensor()
                            logging.info("DistanceSensor initialisiert")
                        else:
                            logging.error("VL53L0XSensor Klasse nicht verfügbar")
                            return None
                    except Exception as e:
                        logging.error(f"DistanceSensor Initialisierung fehlgeschlagen: {e}")
                        return None
        return self._distance_sensor
    
    def get_motor(self):
        if self._motor is None:
            with self._sensor_locks['motor']:
                if self._motor is None:
                    try:
                        if MotorController is not None:
                            self._motor = MotorController()
                            logging.info("MotorController initialisiert")
                        else:
                            logging.error("MotorController Klasse nicht verfügbar")
                            return None
                    except Exception as e:
                        logging.error(f"MotorController Initialisierung fehlgeschlagen: {e}")
                        return None
        return self._motor
    
    def cleanup(self):
        """Cleanup aller Hardware-Ressourcen"""
        try:
            if self._weight_sensor:
                self._weight_sensor.cleanup()
            if self._distance_sensor:
                self._distance_sensor.cleanup()
            if self._motor:
                self._motor.cleanup()
            logging.info("Hardware cleanup abgeschlossen")
        except Exception as e:
            logging.error(f"Hardware cleanup error: {e}")

# Globale Hardware-Manager Instanz
hardware = HardwareManager()

# HELPER FUNCTIONS für Netzwerk-Info
def get_local_ip():
    """Ermittelt die lokale IP-Adresse"""
    try:
        # Verbindung zu einem externen Server um die lokale IP zu ermitteln
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def get_compatible_network_info():
    """Netzwerk-Info im ursprünglichen Format für Frontend-Kompatibilität"""
    try:
        import subprocess
        import socket
        import re
        
        logging.info("=== COMPATIBLE NETWORK INFO START ===")
        
        # Basis-Info im ursprünglichen Format
        info = {
            'current_ip': get_local_ip(),
            'wifi_ssid': None,
            'eth0': {},
            'wlan0': {}
        }
        
        logging.info(f"Initial info: {info}")
        
        # 1. Aktuelle WLAN-SSID ermitteln
        try:
            # Versuche iwgetid für aktuelle SSID
            logging.info("Versuche iwgetid...")
            result = subprocess.run(['iwgetid', '-r'], capture_output=True, text=True, timeout=3)
            if result.returncode == 0 and result.stdout.strip():
                info['wifi_ssid'] = result.stdout.strip()
                logging.info(f"✅ WiFi SSID gefunden via iwgetid: {info['wifi_ssid']}")
            else:
                logging.info(f"iwgetid result: returncode={result.returncode}, stdout='{result.stdout}', stderr='{result.stderr}'")
                
                # Fallback: nmcli
                logging.info("Versuche nmcli...")
                result = subprocess.run(['nmcli', '-t', '-f', 'ACTIVE,SSID', 'dev', 'wifi'], 
                                      capture_output=True, text=True, timeout=3)
                if result.returncode == 0:
                    for line in result.stdout.split('\n'):
                        if line.startswith('yes:'):
                            ssid = line.split(':', 1)[1]
                            if ssid:
                                info['wifi_ssid'] = ssid
                                logging.info(f"✅ WiFi SSID gefunden via nmcli: {ssid}")
                                break
                
                # Fallback: wpa_cli
                if not info['wifi_ssid']:
                    logging.info("Versuche wpa_cli...")
                    result = subprocess.run(['wpa_cli', 'status'], capture_output=True, text=True, timeout=3)
                    if result.returncode == 0:
                        for line in result.stdout.split('\n'):
                            if line.startswith('ssid='):
                                ssid = line.split('=', 1)[1]
                                if ssid:
                                    info['wifi_ssid'] = ssid
                                    logging.info(f"✅ WiFi SSID gefunden via wpa_cli: {ssid}")
                                    break
        except Exception as e:
            logging.error(f"WiFi SSID Fehler: {e}")
        
        # 2. Interface-IPs ermitteln
        try:
            # ip addr show
            logging.info("Versuche ip addr show...")
            result = subprocess.run(['ip', 'addr', 'show'], capture_output=True, text=True, timeout=3)
            if result.returncode == 0:
                current_interface = None
                for line in result.stdout.split('\n'):
                    # Interface line: "3: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP>"
                    if ': ' in line and ('eth' in line or 'wlan' in line):
                        parts = line.split(': ')
                        if len(parts) >= 2:
                            interface_name = parts[1].split('@')[0]  # Remove @something
                            if interface_name in ['eth0', 'wlan0']:
                                current_interface = interface_name
                                logging.info(f"Found {interface_name} interface: {line.strip()}")
                    
                    # IP line: "    inet 192.168.1.182/24"
                    elif current_interface and 'inet ' in line and 'inet6' not in line:
                        match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)', line)
                        if match:
                            ip_addr = match.group(1)
                            info[current_interface] = {'ip_address': ip_addr}
                            logging.info(f"✅ {current_interface} IP: {ip_addr}")
                            current_interface = None  # Reset for next interface
        except Exception as e:
            logging.error(f"Interface IP Fehler: {e}")
        
        # 3. Falls eth0/wlan0 nicht gefunden, verwende current_ip
        if not info['eth0'] and not info['wlan0']:
            # Versuche zu erraten welches Interface die current_ip hat
            if info['wifi_ssid']:
                info['wlan0'] = {'ip_address': info['current_ip']}
            else:
                info['eth0'] = {'ip_address': info['current_ip']}
        
        logging.info(f"=== FINAL NETWORK INFO: {info} ===")
        return info
        
    except Exception as e:
        logging.error(f"Netzwerk-Info Fehler: {e}")
        return {
            'current_ip': get_local_ip(),
            'wifi_ssid': None,
            'eth0': {},
            'wlan0': {},
            'error': str(e)
        }

# OPTIMIERTE SENSOR-FUNKTIONEN MIT TIMEOUT UND RETRY
def safe_sensor_read(sensor_func, sensor_name, timeout=5, retries=2):
    """Sichere Sensor-Abfrage mit Timeout und Retry"""
    for attempt in range(retries + 1):
        try:
            future = executor.submit(sensor_func)
            result = future.result(timeout=timeout)
            if result is not None:
                return result
            logging.warning(f"{sensor_name} lieferte None (Versuch {attempt + 1})")
        except concurrent.futures.TimeoutError:
            logging.warning(f"{sensor_name} Timeout nach {timeout}s (Versuch {attempt + 1})")
        except Exception as e:
            logging.error(f"{sensor_name} Fehler: {e} (Versuch {attempt + 1})")
        
        if attempt < retries:
            time.sleep(0.5)  # Kurze Pause vor Retry
    
    return None

def get_cached_weight():
    """Gewicht mit verbessertem Caching und Timeout"""
    cached = smart_cache.get('weight', 'current')
    if cached is not None:
        return cached
    
    weight_sensor = hardware.get_weight_sensor()
    if weight_sensor is None:
        return None
    
    def read_weight():
        return weight_sensor.get_weight()
    
    weight = safe_sensor_read(read_weight, "WeightSensor", timeout=8, retries=1)
    if weight is not None:
        smart_cache.set('weight', 'current', weight)
    
    return weight

def get_cached_distance():
    """Distance mit verbessertem Caching und Timeout"""
    cached = smart_cache.get('distance', 'current')
    if cached is not None:
        return cached
    
    distance_sensor = hardware.get_distance_sensor()
    if distance_sensor is None:
        return None
    
    def read_distance():
        return distance_sensor.get_distance()
    
    distance = safe_sensor_read(read_distance, "DistanceSensor", timeout=3, retries=1)
    if distance is not None:
        smart_cache.set('distance', 'current', distance)
    
    return distance

def get_cached_system_info():
    """System-Info mit Caching"""
    cached = smart_cache.get('system', 'info')
    if cached is not None:
        return cached
    
    try:
        # Flexible System-Info je nach verfügbaren Funktionen
        system_info = {
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        # Versuche System-Funktionen zu verwenden
        if system is not None:
            try:
                if hasattr(system, 'get_cpu_info'):
                    system_info['cpu_usage'] = system.get_cpu_info()
                if hasattr(system, 'get_cpu_temperature'):
                    system_info['cpu_temperature'] = system.get_cpu_temperature()
                if hasattr(system, 'get_memory_info'):
                    system_info['memory_usage'] = system.get_memory_info()
                if hasattr(system, 'get_disk_info'):
                    system_info['disk_usage'] = system.get_disk_info()
            except Exception as e:
                logging.error(f"System-Funktions-Fehler: {e}")
                system_info['error'] = str(e)
        else:
            # Fallback System-Info mit Standard-Libraries
            try:
                import psutil
                system_info.update({
                    'cpu_usage': psutil.cpu_percent(interval=0.1),
                    'memory_usage': psutil.virtual_memory()._asdict(),
                    'disk_usage': psutil.disk_usage('/')._asdict()
                })
            except ImportError:
                # Minimal System-Info falls psutil nicht verfügbar
                import os
                import subprocess
                try:
                    # CPU Info aus /proc/loadavg
                    with open('/proc/loadavg', 'r') as f:
                        load = f.read().strip().split()
                        system_info['cpu_load'] = float(load[0])
                    
                    # Memory Info aus /proc/meminfo  
                    with open('/proc/meminfo', 'r') as f:
                        meminfo = f.read()
                        for line in meminfo.split('\n'):
                            if 'MemTotal:' in line:
                                system_info['memory_total'] = int(line.split()[1]) * 1024
                            elif 'MemAvailable:' in line:
                                system_info['memory_available'] = int(line.split()[1]) * 1024
                    
                    # Disk Usage
                    statvfs = os.statvfs('/')
                    system_info['disk_total'] = statvfs.f_frsize * statvfs.f_blocks
                    system_info['disk_free'] = statvfs.f_frsize * statvfs.f_available
                    
                except Exception as e:
                    logging.warning(f"Minimal System-Info Fehler: {e}")
                    system_info['system_info'] = 'limited'
        
        smart_cache.set('system', 'info', system_info)
        return system_info
    except Exception as e:
        logging.error(f"System-Info Fehler: {e}")
        return {
            'error': str(e),
            'timestamp': datetime.datetime.now().isoformat()
        }

def get_cached_feeding_status():
    """Feeding Status mit Caching - REPARIERT für neue feedingControl.py"""
    cached = smart_cache.get('feeding', 'status')
    if cached is not None:
        return cached
    
    try:
        status = get_feeding_status()
        smart_cache.set('feeding', 'status', status)
        return status
    except Exception as e:
        logging.error(f"Feeding Status Fehler: {e}")
        return {"error": str(e)}

# SWAGGER CONFIG
SWAGGER_URL = '/swagger'
API_URL = '/api/swagger.yaml'
swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={'app_name': "Sensor API - CatBoter"}
)
app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

# PERFORMANCE-OPTIMIERTE API ENDPOINTS

@app.route('/swagger.yaml')
def swagger_spec():
    return send_from_directory('api', 'swagger.yaml')

@app.route('/health')
def health():
    """Ultra-schneller Health Check ohne Sensor-Abfragen"""
    return jsonify({
        'status': 'online',
        'timestamp': datetime.datetime.now().isoformat(),
        'cache_stats': {
            'weight_cached': smart_cache.weight_cache['data'] is not None,
            'distance_cached': smart_cache.distance_cache['data'] is not None,
            'system_cached': smart_cache.system_cache['data'] is not None
        },
        'threads': threading.active_count(),
        'version': '2.0'
    })

@app.route('/weight')
def weight():
    """Gewicht-Endpoint - Original"""
    try:
        weight_value = get_cached_weight()
        if weight_value is not None:
            return jsonify({'weight': weight_value})
        else:
            return jsonify({'error': 'Gewichtssensor nicht verfügbar'}), 500
    except Exception as e:
        logging.error(f"Weight endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/distance')
def distance():
    """Distance-Endpoint - Original"""
    try:
        distance_value = get_cached_distance()
        if distance_value is not None:
            return jsonify({'distance': distance_value})
        else:
            return jsonify({'error': 'Distanzsensor nicht verfügbar'}), 500
    except Exception as e:
        logging.error(f"Distance endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/tank/calibration', methods=['GET'])
def get_tank_calibration():
    """Tankfüllstand Kalibrierung abrufen"""
    try:
        calibration_file = os.path.join(os.path.dirname(__file__), 'backend', 'data', 'tank_calibration.json')

        if os.path.exists(calibration_file):
            with open(calibration_file, 'r') as f:
                calibration = json.load(f)
        else:
            # Default Werte
            calibration = {
                'min_distance': 3,   # Voller Tank
                'max_distance': 23   # Leerer Tank
            }

        return jsonify(calibration)
    except Exception as e:
        logging.error(f"Get tank calibration error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/tank/calibration', methods=['POST'])
def set_tank_calibration():
    """Tankfüllstand Kalibrierung speichern"""
    try:
        data = request.get_json()

        if not data or 'min_distance' not in data or 'max_distance' not in data:
            return jsonify({'error': 'Missing calibration data'}), 400

        min_dist = float(data['min_distance'])
        max_dist = float(data['max_distance'])

        # Validierung
        if min_dist >= max_dist:
            return jsonify({'error': 'min_distance muss kleiner als max_distance sein'}), 400

        if min_dist < 0 or max_dist > 100:
            return jsonify({'error': 'Ungültige Distanzwerte (0-100cm)'}), 400

        calibration = {
            'min_distance': min_dist,
            'max_distance': max_dist
        }

        # Speichern
        data_dir = os.path.join(os.path.dirname(__file__), 'backend', 'data')
        os.makedirs(data_dir, exist_ok=True)

        calibration_file = os.path.join(data_dir, 'tank_calibration.json')
        with open(calibration_file, 'w') as f:
            json.dump(calibration, f, indent=2)

        logging.info(f"Tank calibration saved: {calibration}")
        return jsonify({'success': True, 'calibration': calibration})

    except Exception as e:
        logging.error(f"Set tank calibration error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/distance', methods=['GET'])
def get_distance():
    """Aktuelle Distanzmessung vom Ultraschallsensor abrufen"""
    try:
        # Get cached sensor data which includes distance
        sensor_data = get_cached_sensor_data()

        if 'error' in sensor_data:
            return jsonify({'error': sensor_data['error'], 'distance': 0}), 500

        distance = sensor_data.get('distance', 0)

        return jsonify({'distance': distance})
    except Exception as e:
        logging.error(f"Get distance error: {e}")
        return jsonify({'error': str(e), 'distance': 0}), 500

@app.route('/motor', methods=['GET'])
def motor_get():
    """Motor Status - GET (automatische Erkennung der MotorController-Version)"""
    try:
        motor = hardware.get_motor()
        if motor is None:
            return jsonify({'status': 0}), 500
        
        # Automatische Erkennung welche Status-Methode vorhanden ist
        if hasattr(motor, 'status') and callable(getattr(motor, 'status')):
            # Ursprüngliche Version mit status() Methode
            status = 1 if motor.status() else 0
        elif hasattr(motor, 'is_running') and callable(getattr(motor, 'is_running')):
            # Optimierte Version mit is_running() Methode
            status = 1 if motor.is_running() else 0
        else:
            # Fallback
            status = 0
            
        return jsonify({'status': status})
    except Exception as e:
        logging.error(f"Motor GET endpoint error: {e}")
        return jsonify({'status': 0}), 500

@app.route('/motor', methods=['POST'])
def motor_post():
    """Motor Control - POST (exakt wie ursprüngliche main.py)"""
    try:
        data = request.get_json() or {}
        action = data.get('action')
        
        motor = hardware.get_motor()
        if motor is None:
            return jsonify({'error': 'Motor nicht verfügbar'}), 500
        
        if action == 'rotate':
            # Cache invalidieren
            smart_cache.set('motor', 'status', None)
            
            # Gewicht vor der Fütterung messen
            weight_before = None
            weight_sensor = hardware.get_weight_sensor()
            if weight_sensor is not None:
                try:
                    weight_before = weight_sensor.get_weight()
                except Exception as e:
                    logging.warning(f"Konnte Gewicht vor Fütterung nicht messen: {e}")
            
            logging.info("🚀 Starte Motor OHNE Parameter (wie ursprüngliche main.py)")
            
            # Exakt wie in deiner ursprünglichen main.py
            motor.rotate_motor()  # OHNE Parameter!
            
            # Gewicht nach der Fütterung messen und in consumption_manager eintragen
            if weight_before is not None and weight_sensor is not None and consumption_manager is not None:
                try:
                    # Warte kurz damit sich das Futter setzt
                    time.sleep(2)
                    weight_after = weight_sensor.get_weight()
                    fed_amount = weight_after - weight_before
                    
                    if fed_amount > 0:
                        consumption_manager.add_feeding(fed_amount)
                        logging.info(f"✅ Fütterung erfasst: {fed_amount:.1f}g")
                except Exception as e:
                    logging.warning(f"Konnte Fütterung nicht erfassen: {e}")
            
            return jsonify({"status": "Motor wurde gestartet"}), 201
            
        elif action == 'stop':
            logging.info("🛑 Stoppe Motor...")
            motor.stop_motor()
            
            # Ausrichten auf Nullstellung (wie in ursprünglicher main.py)
            motor.rotate_motor(
                forewardSteps=motor.rotational_difference(),
                backwardSteps=0,
                full_rotation_counts=1
            )
            motor.stop_motor()
            
            smart_cache.set('motor', 'status', None)
            return jsonify({"status": "Motor wurde gestoppt"}), 201
            
        else:
            return jsonify({"error": "Ungültige Aktion"}), 400
            
    except Exception as e:
        logging.error(f"Motor POST endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/motor/feed', methods=['POST'])
def motor_feed():
    """Motor Fütterung - Kompatibel mit Frontend"""
    try:
        data = request.get_json() or {}
        amount = data.get('amount', 30.0)
        timeout = data.get('timeout', 120)

        motor = hardware.get_motor()
        if motor is None:
            return jsonify({'success': False, 'message': 'Motor nicht verfügbar'}), 500

        # Cache invalidieren
        smart_cache.set('motor', 'status', None)

        # Gewicht vor der Fütterung messen
        weight_before = None
        weight_sensor = hardware.get_weight_sensor()
        if weight_sensor is not None:
            try:
                weight_before = weight_sensor.get_weight()
            except Exception as e:
                logging.warning(f"Konnte Gewicht vor Fütterung nicht messen: {e}")

        logging.info(f"🚀 Starte manuelle Fütterung: {amount}g (Timeout: {timeout}s)")

        # Motor starten
        motor.rotate_motor()

        # Warte kurz damit Motor Zeit hat zu füttern
        time.sleep(2)

        # Gewicht nach der Fütterung messen
        fed_amount = 0
        weight_measurement_failed = False

        if weight_sensor is not None and consumption_manager is not None:
            try:
                weight_after = weight_sensor.get_weight()

                if weight_before is not None:
                    # Berechne Differenz
                    fed_amount = abs(weight_after - weight_before)
                else:
                    # Kein Gewicht vorher - verwende Standardwert
                    fed_amount = amount
                    logging.warning("Gewicht vorher nicht verfügbar - verwende Standardwert")

                # Nur speichern wenn tatsächlich etwas gefüttert wurde (Mindestens 1g)
                if fed_amount >= 1.0:
                    consumption_manager.add_feeding(fed_amount)
                    logging.info(f"✅ Manuelle Fütterung erfasst: {fed_amount:.1f}g")
                else:
                    logging.warning(f"⚠️ Fütterung NICHT gespeichert - zu wenig Gewicht: {fed_amount:.1f}g (< 1.0g)")
                    weight_measurement_failed = True

            except Exception as e:
                logging.error(f"Fehler beim Erfassen der Fütterung: {e}")
                # Nur Standardwert speichern wenn explizit angefordert und >= 1g
                if amount >= 1.0:
                    try:
                        consumption_manager.add_feeding(amount)
                        fed_amount = amount
                        weight_measurement_failed = True
                        logging.warning(f"Fütterung mit Standardwert gespeichert: {amount}g")
                    except:
                        pass

        message = f'Fütterung durchgeführt: {fed_amount:.1f}g gefüttert'
        if weight_measurement_failed:
            message += ' (Gewichtsmessung fehlgeschlagen - Standardwert verwendet)'

        return jsonify({
            'success': True,
            'message': message,
            'fed_amount': fed_amount
        }), 200

    except Exception as e:
        logging.error(f"Motor feed endpoint error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/motor/stop', methods=['POST'])
def motor_stop():
    """Motor stoppen"""
    try:
        motor = hardware.get_motor()
        if motor is None:
            return jsonify({'success': False, 'message': 'Motor nicht verfügbar'}), 500

        logging.info("🛑 Stoppe Motor...")
        motor.stop_motor()

        # Ausrichten auf Nullstellung
        motor.rotate_motor(
            forewardSteps=motor.rotational_difference(),
            backwardSteps=0,
            full_rotation_counts=1
        )
        motor.stop_motor()

        smart_cache.set('motor', 'status', None)
        return jsonify({'success': True, 'message': 'Motor wurde gestoppt'}), 200

    except Exception as e:
        logging.error(f"Motor stop endpoint error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/weight/tare', methods=['POST'])
def weight_tare():
    """Gewichtssensor tarieren"""
    try:
        weight_sensor = hardware.get_weight_sensor()
        if weight_sensor is None:
            return jsonify({'error': 'Gewichtssensor nicht verfügbar'}), 500
        
        if hasattr(weight_sensor, 'tare'):
            weight_sensor.tare()
            return jsonify({'success': True, 'message': 'Gewichtssensor tariert'})
        else:
            return jsonify({'error': 'Tare-Funktion nicht verfügbar'}), 500
    except Exception as e:
        logging.error(f"Weight tare error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/weight/calibrate', methods=['POST'])
def weight_calibrate():
    """Gewichtssensor kalibrieren"""
    try:
        data = request.get_json() or {}
        known_weight = data.get('known_weight', 100.0)
        
        weight_sensor = hardware.get_weight_sensor()
        if weight_sensor is None:
            return jsonify({'error': 'Gewichtssensor nicht verfügbar'}), 500
        
        if hasattr(weight_sensor, 'calibrate'):
            weight_sensor.calibrate(known_weight)
            return jsonify({'success': True, 'message': 'Gewichtssensor kalibriert'})
        else:
            return jsonify({'error': 'Kalibrierungs-Funktion nicht verfügbar'}), 500
    except Exception as e:
        logging.error(f"Weight calibrate error: {e}")
        return jsonify({'error': str(e)}), 500

# SYSTEM ENDPOINTS
@app.route('/system/cpu')
def system_cpu():
    """CPU-Info"""
    try:
        if system is not None and hasattr(system, 'get_cpu_info'):
            cpu_info = system.get_cpu_info()
            return jsonify({'cpu_percent': cpu_info})
        else:
            # Fallback
            try:
                import psutil
                return jsonify({'cpu_percent': psutil.cpu_percent(interval=0.1)})
            except:
                with open('/proc/loadavg', 'r') as f:
                    load = f.read().strip().split()[0]
                    return jsonify({'cpu_load': float(load)})
    except Exception as e:
        logging.error(f"System CPU error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/temperature')
def system_temperature():
    """CPU-Temperatur"""
    try:
        if system is not None and hasattr(system, 'get_cpu_temperature'):
            temp = system.get_cpu_temperature()
            return jsonify({'temperature': temp})
        else:
            # Fallback
            try:
                import subprocess
                temp = subprocess.check_output(["vcgencmd", "measure_temp"]).decode()
                temp = float(temp.replace("temp=", "").replace("'C\n", ""))
                return jsonify({'temperature': temp})
            except:
                return jsonify({'error': 'Temperatur nicht verfügbar'}), 500
    except Exception as e:
        logging.error(f"System temperature error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/ram')
def system_ram():
    """RAM-Info"""
    try:
        if system is not None and hasattr(system, 'get_memory_info'):
            ram_info = system.get_memory_info()
            return jsonify(ram_info)
        else:
            # Fallback
            try:
                import psutil
                mem = psutil.virtual_memory()
                return jsonify({
                    'total': mem.total,
                    'available': mem.available,
                    'percent': mem.percent,
                    'used': mem.used,
                    'free': mem.free
                })
            except:
                with open('/proc/meminfo', 'r') as f:
                    meminfo = f.read()
                    total = int([line for line in meminfo.split('\n') if 'MemTotal:' in line][0].split()[1]) * 1024
                    available = int([line for line in meminfo.split('\n') if 'MemAvailable:' in line][0].split()[1]) * 1024
                    return jsonify({'total': total, 'available': available})
    except Exception as e:
        logging.error(f"System RAM error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/disk')
def system_disk():
    """Disk-Info"""
    try:
        if system is not None and hasattr(system, 'get_disk_info'):
            disk_info = system.get_disk_info()
            return jsonify(disk_info)
        else:
            # Fallback
            try:
                import psutil
                disk = psutil.disk_usage('/')
                return jsonify({
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': (disk.used / disk.total) * 100
                })
            except:
                import os
                statvfs = os.statvfs('/')
                total = statvfs.f_frsize * statvfs.f_blocks
                free = statvfs.f_frsize * statvfs.f_available
                used = total - free
                return jsonify({
                    'total': total,
                    'used': used,
                    'free': free,
                    'percent': (used / total) * 100
                })
    except Exception as e:
        logging.error(f"System disk error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/network')
def system_network():
    """Netzwerk-Info im ursprünglichen Format für Frontend-Kompatibilität"""
    try:
        logging.info("=== NETWORK INFO DEBUG ===")
        logging.info(f"System module: {system}")
        
        if system is not None and hasattr(system, 'get_network_status'):
            logging.info("Verwende system.get_network_status()")
            network_info = system.get_network_status()
            return jsonify(network_info)
        else:
            logging.info("Verwende get_compatible_network_info() Fallback")
            # Verwende die kompatible Fallback-Funktion
            network_info = get_compatible_network_info()
            return jsonify(network_info)
    except Exception as e:
        logging.error(f"System network error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/scan_wifi')
def scan_wifi():
    """WiFi-Scan mit robusten Fallback-Methoden"""
    try:
        import subprocess
        import re
        
        logging.info("=== WiFi SCAN DEBUG ===")
        logging.info(f"System module: {system}")
        
        if system is not None and hasattr(system, 'scan_wifi'):
            logging.info("Verwende system.scan_wifi()")
            try:
                networks = system.scan_wifi()
                return jsonify({'networks': networks, 'method': 'system'})
            except Exception as e:
                logging.error(f"System WiFi-Scan Fehler: {e}")
        
        # Fallback-Methoden
        wifi_networks = []
        
        # Methode 1: iwlist wlan0 scan
        try:
            logging.info("Versuche WiFi-Scan mit: iwlist wlan0 scan")
            result = subprocess.run(['iwlist', 'wlan0', 'scan'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                current_network = {}
                for line in result.stdout.split('\n'):
                    line = line.strip()
                    if 'ESSID:' in line:
                        ssid = line.split('ESSID:')[1].strip('"')
                        if ssid and ssid != '<hidden>':
                            current_network['ssid'] = ssid
                    elif 'Address:' in line and 'Cell' in line:
                        bssid = line.split('Address: ')[1].strip()
                        current_network['bssid'] = bssid
                    elif 'Signal level=' in line:
                        # Extract signal strength
                        match = re.search(r'Signal level=(-?\d+)', line)
                        if match:
                            signal = int(match.group(1))
                            # Convert to percentage (rough estimate)
                            signal_percent = max(0, min(100, (signal + 100) * 2))
                            current_network['signal_strength'] = signal_percent
                    elif 'Encryption key:' in line:
                        encrypted = 'on' in line.lower()
                        current_network['encrypted'] = encrypted
                        
                        # Add network if SSID exists
                        if 'ssid' in current_network:
                            wifi_networks.append(current_network.copy())
                            current_network = {}
                
                if wifi_networks:
                    logging.info(f"WiFi-Scan erfolgreich mit iwlist: {len(wifi_networks)} Netzwerke")
                    return jsonify({'networks': wifi_networks, 'method': 'iwlist'})
        except Exception as e:
            logging.error(f"iwlist WiFi-Scan Fehler: {e}")
        
        # Methode 2: nmcli dev wifi list
        try:
            logging.info("Versuche WiFi-Scan mit: nmcli dev wifi list")
            result = subprocess.run(['nmcli', 'dev', 'wifi', 'list'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                lines = result.stdout.split('\n')[1:]  # Skip header
                for line in lines:
                    if line.strip():
                        parts = line.split()
                        if len(parts) >= 3:
                            ssid = parts[0] if parts[0] != '--' else 'Hidden'
                            if ssid and ssid != 'Hidden':
                                signal_strength = 50  # Default
                                try:
                                    # Try to extract signal strength
                                    for part in parts:
                                        if part.endswith('%'):
                                            signal_strength = int(part.replace('%', ''))
                                            break
                                except:
                                    pass
                                
                                wifi_networks.append({
                                    'ssid': ssid,
                                    'signal_strength': signal_strength,
                                    'encrypted': True,  # Assume encrypted
                                    'bssid': 'unknown'
                                })
                
                if wifi_networks:
                    logging.info(f"WiFi-Scan erfolgreich mit nmcli: {len(wifi_networks)} Netzwerke")
                    return jsonify({'networks': wifi_networks, 'method': 'nmcli'})
        except Exception as e:
            logging.error(f"nmcli WiFi-Scan Fehler: {e}")
        
        # Methode 3: wpa_cli scan_results
        try:
            logging.info("Versuche WiFi-Scan mit: wpa_cli")
            # Start scan
            subprocess.run(['wpa_cli', 'scan'], capture_output=True, timeout=5)
            time.sleep(2)  # Wait for scan to complete
            
            result = subprocess.run(['wpa_cli', 'scan_results'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                lines = result.stdout.split('\n')[1:]  # Skip header
                for line in lines:
                    if line.strip():
                        parts = line.split('\t')
                        if len(parts) >= 5:
                            bssid = parts[0]
                            signal = int(parts[2]) if parts[2].lstrip('-').isdigit() else -50
                            flags = parts[3]
                            ssid = parts[4]
                            
                            if ssid:
                                signal_percent = max(0, min(100, (signal + 100) * 2))
                                wifi_networks.append({
                                    'ssid': ssid,
                                    'bssid': bssid,
                                    'signal_strength': signal_percent,
                                    'encrypted': 'WPA' in flags or 'WEP' in flags
                                })
                
                if wifi_networks:
                    logging.info(f"WiFi-Scan erfolgreich mit wpa_cli: {len(wifi_networks)} Netzwerke")
                    return jsonify({'networks': wifi_networks, 'method': 'wpa_cli'})
        except Exception as e:
            logging.error(f"wpa_cli WiFi-Scan Fehler: {e}")
        
        # Falls alle Methoden fehlschlagen
        return jsonify({'error': 'WiFi-Scan nicht verfügbar'}), 500
        
    except Exception as e:
        logging.error(f"WiFi-Scan allgemeiner Fehler: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/connect_wifi', methods=['POST'])
def connect_wifi():
    """WiFi-Verbindung herstellen"""
    try:
        data = request.get_json() or {}
        ssid = data.get('ssid')
        password = data.get('password', '')
        
        if not ssid:
            return jsonify({'error': 'SSID erforderlich'}), 400
        
        if system is not None and hasattr(system, 'connect_wifi'):
            result = system.connect_wifi(ssid, password)
            return jsonify(result)
        else:
            # Fallback mit nmcli
            import subprocess
            try:
                if password:
                    cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid, 'password', password]
                else:
                    cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid]
                
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    return jsonify({'success': True, 'message': f'Verbunden mit {ssid}'})
                else:
                    return jsonify({'error': f'Verbindung fehlgeschlagen: {result.stderr}'}), 500
            except Exception as e:
                return jsonify({'error': f'WiFi-Verbindung Fehler: {str(e)}'}), 500
    except Exception as e:
        logging.error(f"WiFi connect error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/configure_lan', methods=['POST'])
def configure_lan():
    """LAN-Konfiguration"""
    try:
        data = request.get_json() or {}
        
        if system is not None and hasattr(system, 'configure_lan'):
            result = system.configure_lan(data)
            return jsonify(result)
        else:
            # Einfacher Fallback
            return jsonify({'error': 'LAN-Konfiguration nicht verfügbar'}), 500
    except Exception as e:
        logging.error(f"LAN configure error: {e}")
        return jsonify({'error': str(e)}), 500

# FEEDING ENDPOINTS (KOMPLETT REPARIERT)
@app.route('/feeding_plan', methods=['POST'])
def save_feeding_plan():
    """Fütterungsplan speichern - Funktioniert mit neuer feedingControl.py"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
            
        # Validierung für manual mode
        if data.get('weightMode') == 'manual':
            for day, feedings in data.get('feedingSchedule', {}).items():
                for feeding in feedings:
                    if not feeding.get('time') or feeding.get('weight', 0) <= 0:
                        return jsonify({'error': 'Zeit und Gewicht müssen für jede Fütterung angegeben werden'}), 400

        # Aktuelle Pläne laden
        feeding_plans = load_feeding_plans()

        # Wenn neuer Plan aktiv sein soll, deaktiviere alle anderen
        if data.get('active', False):
            for plan in feeding_plans:
                plan['active'] = False

        # Plan hinzufügen
        feeding_plans.append(data)

        # Pläne speichern
        if save_feeding_plans(feeding_plans):
            # Status aktualisieren
            aktualisiere_fütterungsstatus()
            return jsonify({'message': 'Fütterungsplan gespeichert!'}), 201
        else:
            return jsonify({'error': 'Fehler beim Speichern'}), 500
        
    except Exception as e:
        logging.error(f"Save feeding plan error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/feeding_plan', methods=['GET'])
def get_feeding_plans():
    """Alle Fütterungspläne abrufen"""
    try:
        feeding_plans = load_feeding_plans()

        # Ensure all plans have 'name' field for frontend compatibility
        for plan in feeding_plans:
            if 'name' not in plan and 'planName' in plan:
                plan['name'] = plan['planName']
            # Also ensure 'days' field exists (map from selectedDays if needed)
            if 'days' not in plan and 'selectedDays' in plan:
                plan['days'] = plan['selectedDays']

        return jsonify(feeding_plans), 200
    except Exception as e:
        logging.error(f"Get feeding plans error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/feeding_plan/<string:plan_name>', methods=['DELETE'])
def delete_feeding_plan(plan_name):
    """Fütterungsplan löschen"""
    try:
        feeding_plans = load_feeding_plans()
        if not feeding_plans:
            return jsonify({'error': 'Keine Fütterungspläne gefunden'}), 404

        # Plan aus Liste entfernen
        original_count = len(feeding_plans)
        feeding_plans = [plan for plan in feeding_plans if plan.get('planName') != plan_name]
        
        if len(feeding_plans) == original_count:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404
        
        # Pläne speichern
        if save_feeding_plans(feeding_plans):
            return jsonify({'message': 'Fütterungsplan gelöscht!'}), 200
        else:
            return jsonify({'error': 'Fehler beim Löschen'}), 500
        
    except Exception as e:
        logging.error(f"Delete feeding plan error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/feeding_plan/load', methods=['POST'])
def load_feeding_plan():
    """Fütterungsplan laden/aktivieren"""
    try:
        data = request.get_json()
        logging.info(f"Load feeding plan request data: {data}")

        # Accept both planName and plan_name for compatibility
        plan_name = data.get('plan_name') or data.get('planName') if data else None

        if not plan_name:
            logging.error(f"No plan name provided. Data: {data}")
            return jsonify({'error': 'Kein Planname angegeben'}), 400

        # Pläne laden
        feeding_plans = load_feeding_plans()
        if not feeding_plans:
            return jsonify({'error': 'Keine Fütterungspläne gefunden'}), 404

        # Alle Pläne deaktivieren, gewählten aktivieren
        plan_found = False
        for plan in feeding_plans:
            # Support both 'planName' and 'name' fields
            current_name = plan.get('name') or plan.get('planName')
            plan['active'] = (current_name == plan_name)
            if plan['active']:
                plan_found = True

        if not plan_found:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404

        # Pläne speichern
        if save_feeding_plans(feeding_plans):
            # Status aktualisieren
            aktualisiere_fütterungsstatus()
            return jsonify({'message': f'Fütterungsplan {plan_name} geladen!'}), 200
        else:
            return jsonify({'error': 'Fehler beim Aktivieren'}), 500
        
    except Exception as e:
        logging.error(f"Load feeding plan error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/feeding_plan/generate_random', methods=['POST'])
def generate_random_feeding_plan():
    """Generiere einen zufälligen Fütterungsplan für heute"""
    try:
        import random
        from datetime import datetime, timedelta
        
        data = request.get_json()
        daily_weight = data.get('dailyWeight', 50)
        feeding_count = data.get('feedingCount', 3)
        
        # Validierung
        if feeding_count < 1 or feeding_count > 10:
            return jsonify({'error': 'Anzahl Fütterungen muss zwischen 1 und 10 liegen'}), 400
        
        if daily_weight < 10 or daily_weight > 500:
            return jsonify({'error': 'Tagesgewicht muss zwischen 10 und 500 Gramm liegen'}), 400
        
        # Gewicht pro Fütterung
        weight_per_feeding = daily_weight / feeding_count
        
        # Generiere zufällige Zeiten mit mindestens 1 Stunde Abstand
        # Zeitfenster: 06:00 bis 22:00 Uhr (16 Stunden)
        start_hour = 6
        end_hour = 22
        available_hours = end_hour - start_hour
        
        # Berechne minimalen Abstand in Stunden
        min_gap_hours = 1
        
        # Prüfe ob genug Platz für alle Fütterungen
        required_time = feeding_count + (feeding_count - 1) * min_gap_hours
        if required_time > available_hours:
            return jsonify({'error': 'Zu viele Fütterungen für den Zeitraum 06:00-22:00 mit 1h Mindestabstand'}), 400
        
        # Generiere zufällige Zeiten
        feeding_times = []
        attempts = 0
        max_attempts = 100
        
        while len(feeding_times) < feeding_count and attempts < max_attempts:
            attempts += 1
            
            # Generiere zufällige Stunde und Minute
            hour = random.randint(start_hour, end_hour - 1)
            minute = random.randint(0, 59)
            
            # Erstelle Zeit als Minuten seit Mitternacht
            time_minutes = hour * 60 + minute
            
            # Prüfe Mindestabstand zu bestehenden Zeiten (60 Minuten)
            valid = True
            for existing_time in feeding_times:
                existing_minutes = int(existing_time.split(':')[0]) * 60 + int(existing_time.split(':')[1])
                if abs(time_minutes - existing_minutes) < 60:
                    valid = False
                    break
            
            if valid:
                time_str = f"{hour:02d}:{minute:02d}"
                feeding_times.append(time_str)
        
        if len(feeding_times) < feeding_count:
            return jsonify({'error': 'Konnte nicht genügend Zeiten mit 1h Abstand generieren'}), 400
        
        # Sortiere Zeiten
        feeding_times.sort()
        
        # Erstelle Fütterungsplan
        current_day = datetime.now().strftime('%A')
        # Übersetze auf Deutsch
        day_translation = {
            'Monday': 'Montag',
            'Tuesday': 'Dienstag',
            'Wednesday': 'Mittwoch',
            'Thursday': 'Donnerstag',
            'Friday': 'Freitag',
            'Saturday': 'Samstag',
            'Sunday': 'Sonntag'
        }
        german_day = day_translation.get(current_day, current_day)
        
        # Erstelle Schedule
        schedule = {
            german_day: [
                {
                    'time': time,
                    'weight': weight_per_feeding
                }
                for time in feeding_times
            ]
        }
        
        # Erstelle Plan-Namen mit Timestamp
        plan_name = f"Random_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Lade existierende Pläne
        feeding_plans = load_feeding_plans()
        
        # Deaktiviere alle bestehenden Pläne
        for plan in feeding_plans:
            plan['active'] = False
        
        # Füge neuen Plan hinzu
        new_plan = {
            'planName': plan_name,
            'selectedDays': [german_day],
            'feedingSchedule': schedule,
            'weightMode': 'daily',
            'dailyWeight': daily_weight,
            'active': True
        }
        
        feeding_plans.append(new_plan)
        
        # Speichere Pläne
        if save_feeding_plans(feeding_plans):
            # Status aktualisieren
            aktualisiere_fütterungsstatus()
            return jsonify({
                'message': 'Random Fütterungsplan erstellt!',
                'planName': plan_name,
                'feedingTimes': feeding_times,
                'weightPerFeeding': weight_per_feeding
            }), 201
        else:
            return jsonify({'error': 'Fehler beim Speichern'}), 500
        
    except Exception as e:
        logging.error(f"Generate random feeding plan error: {e}")
        return jsonify({'error': str(e)}), 500

# RANDOM PLAN ENDPOINTS
RANDOM_PLANS_FILE = FEEDING_PLAN_DIR / "randomPlans.json"

def load_random_plans():
    """Lädt Random-Pläne"""
    try:
        if RANDOM_PLANS_FILE.exists():
            with open(RANDOM_PLANS_FILE, 'r') as file:
                return json.load(file)
        return []
    except Exception as e:
        logging.error(f"Fehler beim Laden der Random-Pläne: {e}")
        return []

def save_random_plans(plans):
    """Speichert Random-Pläne"""
    try:
        FEEDING_PLAN_DIR.mkdir(parents=True, exist_ok=True)
        with open(RANDOM_PLANS_FILE, 'w') as file:
            json.dump(plans, file, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logging.error(f"Fehler beim Speichern der Random-Pläne: {e}")
        return False

@app.route('/random_plans', methods=['GET'])
def get_random_plans():
    """Alle Random-Pläne abrufen"""
    try:
        plans = load_random_plans()
        return jsonify(plans), 200
    except Exception as e:
        logging.error(f"Get random plans error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/random_plan', methods=['POST'])
def save_random_plan():
    """Random-Plan speichern"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        
        plans = load_random_plans()
        plans.append(data)
        
        if save_random_plans(plans):
            return jsonify({'message': 'Random-Plan gespeichert!'}), 201
        else:
            return jsonify({'error': 'Fehler beim Speichern'}), 500
    except Exception as e:
        logging.error(f"Save random plan error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/random_plan/<string:plan_name>', methods=['DELETE'])
def delete_random_plan(plan_name):
    """Random-Plan löschen"""
    try:
        plans = load_random_plans()
        original_count = len(plans)
        plans = [p for p in plans if p.get('planName') != plan_name]
        
        if len(plans) == original_count:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404
        
        if save_random_plans(plans):
            return jsonify({'message': 'Random-Plan gelöscht!'}), 200
        else:
            return jsonify({'error': 'Fehler beim Löschen'}), 500
    except Exception as e:
        logging.error(f"Delete random plan error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/random_plan/activate', methods=['POST'])
def activate_random_plan():
    """Random-Plan aktivieren und generieren"""
    try:
        import random
        from datetime import datetime

        data = request.get_json()
        logging.info(f"Activate random plan request data: {data}")

        # Accept both planName and plan_name for compatibility
        plan_name = data.get('plan_name') or data.get('planName') if data else None

        if not plan_name:
            logging.error(f"No plan name provided. Data: {data}")
            return jsonify({'error': 'Kein Planname angegeben'}), 400
        
        # Random-Pläne laden
        random_plans = load_random_plans()
        plan = None
        for p in random_plans:
            # Support both 'planName' and 'name' fields
            current_name = p.get('name') or p.get('planName')
            p['active'] = (current_name == plan_name)
            if p['active']:
                plan = p
        
        if not plan:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404
        
        # Deaktiviere alle normalen Fütterungspläne
        feeding_plans = load_feeding_plans()
        for fp in feeding_plans:
            fp['active'] = False
        save_feeding_plans(feeding_plans)
        
        # Speichere Random-Pläne
        save_random_plans(random_plans)
        
        # Generiere sofort Fütterungszeiten
        current_day = datetime.now().strftime('%A')
        day_translation = {
            'Monday': 'Montag', 'Tuesday': 'Dienstag', 'Wednesday': 'Mittwoch',
            'Thursday': 'Donnerstag', 'Friday': 'Freitag', 'Saturday': 'Samstag', 'Sunday': 'Sonntag'
        }
        german_day = day_translation.get(current_day, current_day)
        
        # Prüfe workdaysOnly
        weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']
        if plan.get('workdaysOnly', False) and german_day not in weekdays:
            return jsonify({'message': 'Random-Plan aktiviert (heute Wochenende - keine Fütterungen)'}), 200
        
        # Generiere Zeiten basierend auf Intervallen
        min_interval = plan.get('minInterval', 120)
        max_interval = plan.get('maxInterval', 240)
        daily_weight = plan.get('dailyWeight', 50)
        
        # Extrahiere Start-/Endzeit und minimale Pause
        start_time_str = plan.get('startTime', '06:00')
        end_time_str = plan.get('endTime', '22:00')
        min_pause = plan.get('minPause', 60)
        
        # Konvertiere Zeiten zu Minuten seit Mitternacht
        start_hour, start_min = map(int, start_time_str.split(':'))
        end_hour, end_min = map(int, end_time_str.split(':'))
        current_time = start_hour * 60 + start_min
        end_time = end_hour * 60 + end_min
        
        # Generiere Fütterungszeiten
        feeding_times = []
        
        while current_time < end_time:
            hour = current_time // 60
            minute = current_time % 60
            feeding_times.append(f"{hour:02d}:{minute:02d}")
            
            # Nächste Fütterungszeit mit zufälligem Intervall
            interval = random.randint(min_interval, max_interval)
            # Stelle sicher, dass mindestens minPause zwischen Fütterungen liegt
            current_time += max(interval, min_pause)
        
        if not feeding_times:
            return jsonify({'error': 'Keine Fütterungszeiten generiert'}), 400
        
        # Gewicht pro Fütterung
        weight_per_feeding = daily_weight / len(feeding_times)
        
        # Erstelle normalen Fütterungsplan
        schedule = {
            german_day: [
                {'time': time, 'weight': weight_per_feeding}
                for time in feeding_times
            ]
        }
        
        temp_plan = {
            'planName': f"RandomGen_{plan_name}_{datetime.now().strftime('%Y%m%d')}",
            'selectedDays': [german_day],
            'feedingSchedule': schedule,
            'weightMode': 'daily',
            'dailyWeight': daily_weight,
            'active': True,
            'isRandomGenerated': True
        }
        
        feeding_plans.append(temp_plan)
        save_feeding_plans(feeding_plans)
        aktualisiere_fütterungsstatus()
        
        return jsonify({
            'message': 'Random-Plan aktiviert und Zeiten generiert!',
            'feedingTimes': feeding_times,
            'count': len(feeding_times)
        }), 200
        
    except Exception as e:
        logging.error(f"Activate random plan error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/random_plan/generate_now', methods=['POST'])
def generate_random_now():
    """Neue Random-Zeiten für aktiven Plan generieren"""
    try:
        import random
        from datetime import datetime
        
        # Finde aktiven Random-Plan
        random_plans = load_random_plans()
        active_plan = None
        for p in random_plans:
            if p.get('active', False):
                active_plan = p
                break
        
        if not active_plan:
            return jsonify({'error': 'Kein aktiver Random-Plan gefunden'}), 404
        
        # Generiere neue Zeiten (gleiche Logik wie activate)
        current_day = datetime.now().strftime('%A')
        day_translation = {
            'Monday': 'Montag', 'Tuesday': 'Dienstag', 'Wednesday': 'Mittwoch',
            'Thursday': 'Donnerstag', 'Friday': 'Freitag', 'Saturday': 'Samstag', 'Sunday': 'Sonntag'
        }
        german_day = day_translation.get(current_day, current_day)
        
        # Prüfe workdaysOnly
        weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']
        if active_plan.get('workdaysOnly', False) and german_day not in weekdays:
            return jsonify({'error': 'Heute ist Wochenende - keine Fütterungen im Wochentags-Modus'}), 400
        
        min_interval = active_plan.get('minInterval', 120)
        max_interval = active_plan.get('maxInterval', 240)
        daily_weight = active_plan.get('dailyWeight', 50)
        
        # Extrahiere Start-/Endzeit und minimale Pause
        start_time_str = active_plan.get('startTime', '06:00')
        end_time_str = active_plan.get('endTime', '22:00')
        min_pause = active_plan.get('minPause', 60)
        
        # Konvertiere Zeiten zu Minuten seit Mitternacht
        start_hour, start_min = map(int, start_time_str.split(':'))
        end_hour, end_min = map(int, end_time_str.split(':'))
        current_time = start_hour * 60 + start_min
        end_time = end_hour * 60 + end_min
        
        # Generiere neue Zeiten
        feeding_times = []
        
        while current_time < end_time:
            hour = current_time // 60
            minute = current_time % 60
            feeding_times.append(f"{hour:02d}:{minute:02d}")
            interval = random.randint(min_interval, max_interval)
            # Stelle sicher, dass mindestens minPause zwischen Fütterungen liegt
            current_time += max(interval, min_pause)
        
        if not feeding_times:
            return jsonify({'error': 'Keine Fütterungszeiten generiert'}), 400
        
        weight_per_feeding = daily_weight / len(feeding_times)
        
        # Lösche alte Random-generierte Pläne für heute
        feeding_plans = load_feeding_plans()
        today_str = datetime.now().strftime('%Y%m%d')
        feeding_plans = [p for p in feeding_plans if not (p.get('isRandomGenerated', False) and today_str in p.get('planName', ''))]
        
        # Erstelle neuen Plan
        schedule = {
            german_day: [
                {'time': time, 'weight': weight_per_feeding}
                for time in feeding_times
            ]
        }
        
        temp_plan = {
            'planName': f"RandomGen_{active_plan['planName']}_{today_str}",
            'selectedDays': [german_day],
            'feedingSchedule': schedule,
            'weightMode': 'daily',
            'dailyWeight': daily_weight,
            'active': True,
            'isRandomGenerated': True
        }
        
        feeding_plans.append(temp_plan)
        save_feeding_plans(feeding_plans)
        aktualisiere_fütterungsstatus()
        
        return jsonify({
            'message': 'Neue Random-Zeiten generiert!',
            'feedingTimes': feeding_times,
            'count': len(feeding_times)
        }), 200
        
    except Exception as e:
        logging.error(f"Generate random now error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/update_feeding_status', methods=['POST'])
def update_feeding_status():
    """Fütterungsstatus aktualisieren"""
    try:
        success = aktualisiere_fütterungsstatus()
        if success:
            return jsonify({"message": "Fütterungsstatus wurde aktualisiert"}), 200
        else:
            return jsonify({"error": "Fehler beim Aktualisieren"}), 500
    except Exception as e:
        logging.error(f"Update feeding status error: {e}")
        return jsonify({'error': str(e)}), 500

# DATA ENDPOINTS
@app.route('/influx/<measurement>')
def influx_data(measurement):
    """InfluxDB-Daten abrufen - Mit Mock-Daten bis InfluxDB integriert"""
    try:
        import random
        from datetime import datetime, timedelta
        
        start = request.args.get('start')
        end = request.args.get('end')
        
        # Parse Zeitbereich
        if start and end:
            try:
                end_time = datetime.fromisoformat(end.replace('Z', '+00:00'))
                start_time = datetime.fromisoformat(start.replace('Z', '+00:00'))
            except:
                end_time = datetime.now()
                start_time = end_time - timedelta(days=1)
        else:
            end_time = datetime.now()
            start_time = end_time - timedelta(days=1)
        
        # Generiere Mock-Daten
        data_points = []
        time_diff = end_time - start_time
        num_points = min(100, max(10, int(time_diff.total_seconds() / 300)))  # Ein Punkt alle 5 Min
        
        for i in range(num_points):
            time_offset = (time_diff / num_points) * i
            timestamp = start_time + time_offset
            
            # Measurement-spezifische Werte
            if measurement == 'distance':
                base_value = 75
                value = max(10, min(100, base_value + random.uniform(-15, 15)))
            elif measurement == 'weight':
                base_value = 50
                value = max(0, base_value + random.uniform(-10, 10))
            elif measurement == 'temperature':
                base_value = 55
                value = max(40, min(75, base_value + random.uniform(-5, 5)))
            elif measurement == 'cpu':
                base_value = 35
                value = max(10, min(90, base_value + random.uniform(-15, 25)))
            elif measurement == 'ram':
                base_value = 1024
                value = max(512, min(2048, base_value + random.uniform(-200, 400)))
            elif measurement == 'disk':
                base_value = 45
                value = max(20, min(95, base_value + random.uniform(-5, 5)))
            else:
                value = random.uniform(0, 100)
            
            data_points.append({
                'time': timestamp.isoformat(),
                'value': round(value, 2)
            })
        
        return jsonify(data_points)
    except Exception as e:
        logging.error(f"InfluxDB query error: {e}")
        return jsonify({'error': str(e)}), 500

# CONSUMPTION HISTORY ENDPOINTS
@app.route('/consumption/daily')
def get_daily_consumption():
    """Tägliche Verbrauchsdaten"""
    try:
        if consumption_manager is None:
            return jsonify({'error': 'Consumption Manager nicht verfügbar'}), 500

        days = request.args.get('days', default=30, type=int)
        data = consumption_manager.get_daily(days)
        return jsonify(data)
    except Exception as e:
        logging.error(f"Daily consumption error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/consumption/weekly')
def get_weekly_consumption():
    """Wöchentliche Verbrauchsdaten"""
    try:
        if consumption_manager is None:
            return jsonify({'error': 'Consumption Manager nicht verfügbar'}), 500

        weeks = request.args.get('weeks', default=12, type=int)
        data = consumption_manager.get_weekly(weeks)
        return jsonify(data)
    except Exception as e:
        logging.error(f"Weekly consumption error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/consumption/monthly')
def get_monthly_consumption():
    """Monatliche Verbrauchsdaten"""
    try:
        if consumption_manager is None:
            return jsonify({'error': 'Consumption Manager nicht verfügbar'}), 500

        months = request.args.get('months', default=6, type=int)
        data = consumption_manager.get_monthly(months)
        return jsonify(data)
    except Exception as e:
        logging.error(f"Monthly consumption error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/consumption/yearly')
def get_yearly_consumption():
    """Jährliche Verbrauchsdaten"""
    try:
        if consumption_manager is None:
            return jsonify({'error': 'Consumption Manager nicht verfügbar'}), 500

        data = consumption_manager.get_yearly()
        return jsonify(data)
    except Exception as e:
        logging.error(f"Yearly consumption error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/consumption/stats')
def get_consumption_stats():
    """Verbrauchsstatistiken"""
    try:
        if consumption_manager is None:
            return jsonify({'error': 'Consumption Manager nicht verfügbar'}), 500

        stats = consumption_manager.get_stats()
        return jsonify(stats)
    except Exception as e:
        logging.error(f"Consumption stats error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/consumption/today')
def get_today_consumption():
    """Heutiger Verbrauch"""
    try:
        if consumption_manager is None:
            return jsonify({'error': 'Consumption Manager nicht verfügbar'}), 500

        total = consumption_manager.get_today_total()
        return jsonify({'total': total})
    except Exception as e:
        logging.error(f"Today consumption error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/consumption/today_detailed')
def get_today_detailed():
    """Detaillierte heutige Fütterungen mit Plan und durchgeführten Fütterungen"""
    try:
        from datetime import datetime
        import json

        # Lade aktiven Feeding Plan
        plan_path = os.path.join(os.path.dirname(__file__), 'feedingPlan', 'feedingPlans.json')
        with open(plan_path, 'r', encoding='utf-8') as f:
            plans = json.load(f)

        # Finde aktiven Plan
        active_plan = next((p for p in plans if p.get('active', False)), None)

        feedings = []
        today = datetime.now()
        day_name_map = {
            0: 'Montag', 1: 'Dienstag', 2: 'Mittwoch',
            3: 'Donnerstag', 4: 'Freitag', 5: 'Samstag', 6: 'Sonntag'
        }
        today_day = day_name_map[today.weekday()]

        if active_plan and 'feedingSchedule' in active_plan:
            scheduled = active_plan['feedingSchedule'].get(today_day, [])
            for feeding in scheduled:
                # Extract actual fed amount from message if available
                fed_amount = feeding.get('fed_amount', 0)
                message = feeding.get('message', '')

                # Parse amount from message like "16.4g gefüttert (Soll: 15.0g)"
                if message and 'gefüttert' in message:
                    import re
                    match = re.search(r'(\d+\.?\d*)g gefüttert', message)
                    if match:
                        fed_amount = float(match.group(1))

                feedings.append({
                    'time': feeding['time'],
                    'amount': fed_amount,
                    'type': 'auto',
                    'status': feeding.get('status'),
                    'planned_amount': feeding.get('weight', 0)
                })

        # Lade ALLE Fütterungen von heute aus current_day.json (inkl. manuelle)
        current_day_path = os.path.join(os.path.dirname(__file__), 'backend', 'data', 'current_day.json')
        if os.path.exists(current_day_path):
            try:
                with open(current_day_path, 'r') as f:
                    current_day = json.load(f)

                # Finde manuelle Fütterungen (die nicht im Plan sind)
                today_str = today.strftime('%Y-%m-%d')
                if current_day.get('date') == today_str and 'feedings' in current_day:
                    # Sammle alle Zeiten aus dem Plan
                    planned_times = []
                    if active_plan and 'feedingSchedule' in active_plan:
                        scheduled = active_plan['feedingSchedule'].get(today_day, [])
                        for s in scheduled:
                            planned_times.append(s['time'])

                    # Hilfsfunktion um zu prüfen ob eine Zeit nahe einer geplanten Zeit ist
                    def is_near_planned_time(feeding_time_str, planned_times_list, tolerance_minutes=10):
                        """Prüft ob feeding_time innerhalb von tolerance_minutes einer geplanten Zeit liegt"""
                        try:
                            from datetime import datetime, timedelta
                            feeding_time = datetime.strptime(feeding_time_str, '%H:%M:%S')

                            for planned_time_str in planned_times_list:
                                planned_time = datetime.strptime(planned_time_str, '%H:%M:%S')
                                time_diff = abs((feeding_time - planned_time).total_seconds())
                                if time_diff <= tolerance_minutes * 60:
                                    return True
                            return False
                        except:
                            # Bei Parse-Fehler: Fallback auf exakte String-Übereinstimmung
                            return feeding_time_str in planned_times_list

                    # Finde Fütterungen, die NICHT im Plan sind (= manuell)
                    for feeding in current_day['feedings']:
                        feeding_time = feeding.get('time', '')
                        # Nur hinzufügen wenn nicht nahe einer geplanten Zeit
                        if feeding_time and not is_near_planned_time(feeding_time, planned_times):
                            feedings.append({
                                'time': feeding_time,
                                'amount': feeding.get('amount', 0),
                                'type': 'manual',
                                'status': True  # Manuelle Fütterungen sind immer durchgeführt
                            })
            except Exception as e:
                logging.warning(f"Konnte current_day.json nicht laden: {e}")

        # Sortiere nach Zeit
        feedings.sort(key=lambda x: x['time'])

        return jsonify({
            'date': today.strftime('%Y-%m-%d'),
            'feedings': feedings,
            'total': consumption_manager.get_today_total() if consumption_manager else 0
        })

    except Exception as e:
        import traceback
        logging.error(f"Today detailed error: {e}")
        logging.error(traceback.format_exc())
        return jsonify({'date': datetime.now().strftime('%Y-%m-%d'), 'feedings': [], 'total': 0, 'error': str(e)})

# DASHBOARD ENDPOINT (Performance-optimiert)
@app.route('/dashboard')
def dashboard():
    """Dashboard mit paralleler Datenabfrage für maximale Performance"""
    try:
        # Parallele Futures für alle Sensoren
        futures = {
            'weight': executor.submit(get_cached_weight),
            'distance': executor.submit(get_cached_distance),
            'system': executor.submit(get_cached_system_info),
            'feeding': executor.submit(get_cached_feeding_status)
        }
        
        # Motor-Status direkt (schnell)
        motor = hardware.get_motor()
        motor_status = 0
        if motor is not None:
            try:
                if hasattr(motor, 'status') and callable(getattr(motor, 'status')):
                    motor_status = 1 if motor.status() else 0
                elif hasattr(motor, 'is_running') and callable(getattr(motor, 'is_running')):
                    motor_status = 1 if motor.is_running() else 0
            except:
                motor_status = 0
        
        # Sammle Ergebnisse mit Timeout (2s statt 10s für schnellere Response)
        results = {}
        for name, future in futures.items():
            try:
                results[name] = future.result(timeout=2)
            except Exception as e:
                logging.warning(f"Dashboard {name} timeout/error: {e}")
                # Verwende gecachte Werte oder None
                if name == 'weight':
                    results[name] = smart_cache.weight_cache.get('data')
                elif name == 'distance':
                    results[name] = smart_cache.distance_cache.get('data')
                elif name == 'system':
                    results[name] = smart_cache.system_cache.get('data')
                elif name == 'feeding':
                    results[name] = smart_cache.feeding_cache.get('data')
                else:
                    results[name] = None
        
        # Hole heutigen Gesamtverbrauch
        total_consumed_today = 0
        if consumption_manager:
            try:
                total_consumed_today = consumption_manager.get_today_total()
            except:
                pass

        # Dashboard-Response
        dashboard_data = {
            'timestamp': datetime.datetime.now().isoformat(),
            'weight': results['weight'],
            'distance': results['distance'],
            'motor_status': motor_status,
            'total_consumed_today': total_consumed_today,
            'system_info': results['system'],
            'feeding_status': results['feeding'],
            'cache_stats': {
                'weight_cached': smart_cache.weight_cache['data'] is not None,
                'distance_cached': smart_cache.distance_cache['data'] is not None,
                'system_cached': smart_cache.system_cache['data'] is not None,
                'feeding_cached': smart_cache.feeding_cache['data'] is not None
            }
        }
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        logging.error(f"Dashboard error: {e}")
        return jsonify({'error': str(e)}), 500

# SENSOR ENDPOINTS (Legacy für alte API-Kompatibilität)
@app.route('/sensors')
def sensors():
    """Legacy Sensor-Endpoint für Rückwärtskompatibilität"""
    try:
        # Verwende Dashboard-Logik aber mit Legacy-Format
        weight_value = get_cached_weight()
        distance_value = get_cached_distance()
        
        motor = hardware.get_motor()
        motor_status = 0
        if motor is not None:
            try:
                if hasattr(motor, 'status') and callable(getattr(motor, 'status')):
                    motor_status = 1 if motor.status() else 0
                elif hasattr(motor, 'is_running') and callable(getattr(motor, 'is_running')):
                    motor_status = 1 if motor.is_running() else 0
            except:
                motor_status = 0
        
        # Heutiger Verbrauch aus Consumption Manager
        total_consumed_today = 0.0
        if consumption_manager is not None:
            try:
                total_consumed_today = consumption_manager.get_today_total()
            except Exception as e:
                logging.error(f"Error getting today total: {e}")
        
        return jsonify({
            'weight': weight_value,
            'distance': distance_value,
            'motor': motor_status,
            'total_consumed_today': total_consumed_today,
            'timestamp': datetime.datetime.now().isoformat()
        })
    except Exception as e:
        logging.error(f"Sensors endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

# SYSTEM CONTROL ENDPOINTS
@app.route('/system/restart_backend', methods=['POST'])
def restart_backend():
    """Backend neu starten"""
    try:
        import subprocess
        logging.info("Backend-Neustart angefordert...")
        
        # Teste zuerst ob wir sudo-Rechte haben
        test_result = subprocess.run(['sudo', '-n', 'true'], 
                                    capture_output=True, timeout=2)
        
        if test_result.returncode != 0:
            return jsonify({
                'error': 'Keine sudo-Berechtigung. Bitte konfigurieren Sie passwordless sudo für systemctl.',
                'hint': 'Fügen Sie in /etc/sudoers.d/catboter hinzu: <username> ALL=(ALL) NOPASSWD: /bin/systemctl restart catboter_autostart.service'
            }), 403
        
        # Verwende systemctl um den Service neu zu starten
        def restart_service():
            try:
                result = subprocess.run(
                    ['sudo', 'systemctl', 'restart', 'catboter_autostart.service'], 
                    capture_output=True, 
                    text=True,
                    timeout=5
                )
                if result.returncode != 0:
                    logging.error(f"Service restart failed: {result.stderr}")
                else:
                    logging.info("Service restart successful")
            except Exception as e:
                logging.error(f"Service restart error: {e}")
        
        # Starte Neustart in separatem Thread
        restart_thread = Thread(target=restart_service, daemon=True)
        restart_thread.start()
        
        return jsonify({'message': 'Backend wird neu gestartet...', 'success': True}), 200
    except Exception as e:
        logging.error(f"Restart backend error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/reboot', methods=['POST'])
def reboot_system():
    """Raspberry Pi neu starten"""
    try:
        import subprocess
        logging.info("System-Neustart angefordert...")
        
        # Teste sudo-Rechte
        test_result = subprocess.run(['sudo', '-n', 'true'], 
                                    capture_output=True, timeout=2)
        
        if test_result.returncode != 0:
            return jsonify({
                'error': 'Keine sudo-Berechtigung für reboot.',
                'hint': 'Fügen Sie in /etc/sudoers.d/catboter hinzu: <username> ALL=(ALL) NOPASSWD: /sbin/reboot'
            }), 403
        
        # Verzögerter Neustart um Response zu senden
        def delayed_reboot():
            time.sleep(2)  # 2 Sekunden warten
            try:
                result = subprocess.run(['sudo', 'reboot'], 
                                      capture_output=True, 
                                      text=True,
                                      timeout=5)
                if result.returncode != 0:
                    logging.error(f"Reboot failed: {result.stderr}")
            except Exception as e:
                logging.error(f"Reboot error: {e}")
        
        # Starte Neustart in separatem Thread
        reboot_thread = Thread(target=delayed_reboot, daemon=True)
        reboot_thread.start()
        
        return jsonify({'message': 'System wird in 2 Sekunden neu gestartet...', 'success': True}), 200
    except Exception as e:
        logging.error(f"Reboot system error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/shutdown', methods=['POST'])
def shutdown_system():
    """Raspberry Pi herunterfahren"""
    try:
        import subprocess
        logging.info("System-Shutdown angefordert...")
        
        # Teste sudo-Rechte
        test_result = subprocess.run(['sudo', '-n', 'true'], 
                                    capture_output=True, timeout=2)
        
        if test_result.returncode != 0:
            return jsonify({
                'error': 'Keine sudo-Berechtigung für shutdown.',
                'hint': 'Fügen Sie in /etc/sudoers.d/catboter hinzu: <username> ALL=(ALL) NOPASSWD: /sbin/shutdown'
            }), 403
        
        # Verzögertes Herunterfahren
        def delayed_shutdown():
            time.sleep(2)
            try:
                result = subprocess.run(['sudo', 'shutdown', '-h', 'now'], 
                                      capture_output=True,
                                      text=True,
                                      timeout=5)
                if result.returncode != 0:
                    logging.error(f"Shutdown failed: {result.stderr}")
            except Exception as e:
                logging.error(f"Shutdown error: {e}")
        
        shutdown_thread = Thread(target=delayed_shutdown, daemon=True)
        shutdown_thread.start()
        
        return jsonify({'message': 'System wird in 2 Sekunden heruntergefahren...', 'success': True}), 200
    except Exception as e:
        logging.error(f"Shutdown system error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/time_status')
def time_status():
    """Zeit-Status abrufen"""
    try:
        import subprocess
        from datetime import datetime

        # Aktuelle Zeit
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # NTP-Status prüfen
        ntp_enabled = False
        ntp_synced = False
        docker_container = False

        try:
            # Prüfe ob timedatectl verfügbar ist
            result = subprocess.run(['timedatectl', 'status'],
                                  capture_output=True, text=True, timeout=3)
            if result.returncode == 0:
                output = result.stdout.lower()
                ntp_enabled = 'ntp service: active' in output or 'network time on: yes' in output
                ntp_synced = 'system clock synchronized: yes' in output
            else:
                # timedatectl fehlgeschlagen - vermutlich Docker Container
                docker_container = True
        except:
            # Kein timedatectl verfügbar - vermutlich Docker Container
            docker_container = True

        # Im Docker Container: Zeit wird vom Host-System verwaltet
        if docker_container:
            ntp_enabled = True  # Zeit kommt vom Host
            ntp_synced = True   # Annahme: Host hat korrekte Zeit

        return jsonify({
            'current_time': current_time,
            'ntp_enabled': ntp_enabled,
            'ntp_synced': ntp_synced,
            'docker_managed': docker_container
        })
    except Exception as e:
        logging.error(f"Time status error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/enable_ntp', methods=['POST'])
def enable_ntp():
    """NTP aktivieren"""
    try:
        import subprocess
        logging.info("NTP aktivieren...")

        # Prüfe ob systemd verfügbar ist (Docker-Container haben oft kein systemd)
        systemd_check = subprocess.run(['which', 'systemctl'],
                                      capture_output=True, timeout=2)

        if systemd_check.returncode != 0:
            return jsonify({
                'success': True,
                'message': 'NTP-Konfiguration in Docker-Container nicht verfügbar',
                'warning': 'System läuft im Container ohne systemd. NTP wird vom Host-System verwaltet.'
            }), 200

        # Teste sudo-Rechte
        test_result = subprocess.run(['sudo', '-n', 'true'],
                                    capture_output=True, timeout=2)

        if test_result.returncode != 0:
            return jsonify({
                'error': 'Keine sudo-Berechtigung für timedatectl.',
                'hint': 'Fügen Sie in /etc/sudoers.d/catboter hinzu: <username> ALL=(ALL) NOPASSWD: /usr/bin/timedatectl'
            }), 403

        # Aktiviere NTP mit timedatectl
        result = subprocess.run(['sudo', 'timedatectl', 'set-ntp', 'true'],
                              capture_output=True, text=True, timeout=5)

        if result.returncode == 0:
            return jsonify({'message': 'NTP erfolgreich aktiviert', 'success': True}), 200
        else:
            return jsonify({'error': f'Fehler beim Aktivieren von NTP: {result.stderr}'}), 500

    except Exception as e:
        logging.error(f"Enable NTP error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/set_time', methods=['POST'])
def set_time():
    """Zeit manuell setzen"""
    try:
        import subprocess
        data = request.get_json() or {}
        date = data.get('date')  # YYYY-MM-DD
        time_str = data.get('time')  # HH:MM:SS
        
        if not date or not time_str:
            return jsonify({'error': 'Datum und Zeit erforderlich'}), 400
        
        logging.info(f"Setze Zeit auf: {date} {time_str}")
        
        # Teste sudo-Rechte
        test_result = subprocess.run(['sudo', '-n', 'true'], 
                                    capture_output=True, timeout=2)
        
        if test_result.returncode != 0:
            return jsonify({
                'error': 'Keine sudo-Berechtigung für date/timedatectl.',
                'hint': 'Fügen Sie in /etc/sudoers.d/catboter hinzu: <username> ALL=(ALL) NOPASSWD: /usr/bin/timedatectl, /bin/date'
            }), 403
        
        # Deaktiviere NTP zuerst
        subprocess.run(['sudo', 'timedatectl', 'set-ntp', 'false'], 
                      capture_output=True, timeout=5)
        
        # Setze Zeit mit timedatectl
        datetime_str = f"{date} {time_str}"
        result = subprocess.run(['sudo', 'timedatectl', 'set-time', datetime_str], 
                              capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            return jsonify({'message': 'Zeit erfolgreich gesetzt', 'success': True}), 200
        else:
            # Fallback: Verwende date-Befehl
            try:
                # Format: MMDDhhmmYYYY.ss
                from datetime import datetime
                dt = datetime.strptime(f"{date} {time_str}", '%Y-%m-%d %H:%M:%S')
                date_format = dt.strftime('%m%d%H%M%Y.%S')
                result = subprocess.run(['sudo', 'date', date_format], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    return jsonify({'message': 'Zeit erfolgreich gesetzt', 'success': True}), 200
            except:
                pass
            
            return jsonify({'error': f'Fehler beim Setzen der Zeit: {result.stderr}'}), 500
            
    except Exception as e:
        logging.error(f"Set time error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/sync_ntp', methods=['POST'])
def sync_ntp():
    """NTP sofort synchronisieren"""
    try:
        import subprocess
        logging.info("NTP-Synchronisation...")
        
        # Teste sudo-Rechte
        test_result = subprocess.run(['sudo', '-n', 'true'], 
                                    capture_output=True, timeout=2)
        
        if test_result.returncode != 0:
            return jsonify({
                'error': 'Keine sudo-Berechtigung.',
                'hint': 'Fügen Sie in /etc/sudoers.d/catboter hinzu: <username> ALL=(ALL) NOPASSWD: /usr/sbin/ntpdate, /usr/bin/chronyc'
            }), 403
        
        # Versuche verschiedene Methoden
        success = False
        
        # Methode 1: chronyc (wenn chronyd läuft)
        try:
            result = subprocess.run(['sudo', 'chronyc', 'makestep'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                success = True
        except:
            pass
        
        # Methode 2: systemd-timesyncd
        if not success:
            try:
                result = subprocess.run(['sudo', 'systemctl', 'restart', 'systemd-timesyncd'], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    success = True
            except:
                pass
        
        # Methode 3: ntpdate
        if not success:
            try:
                result = subprocess.run(['sudo', 'ntpdate', '-u', 'pool.ntp.org'], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    success = True
            except:
                pass
        
        if success:
            return jsonify({'message': 'Zeit erfolgreich synchronisiert', 'success': True}), 200
        else:
            return jsonify({'error': 'Konnte Zeit nicht synchronisieren'}), 500
            
    except Exception as e:
        logging.error(f"Sync NTP error: {e}")
        return jsonify({'error': str(e)}), 500

# ERROR HANDLERS
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint nicht gefunden'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Interner Serverfehler'}), 500

# WARMUP FUNCTION
def warmup_cache():
    """Cache Warmup für bessere Performance beim Start"""
    logging.info("Starte Cache Warmup...")
    
    # Starte Warmup-Tasks im Hintergrund
    def warmup_task():
        try:
            # Weight sensor warmup
            get_cached_weight()
            # Distance sensor warmup
            get_cached_distance()
            # System info warmup
            get_cached_system_info()
        except Exception as e:
            logging.error(f"Cache warmup error: {e}")
    
    # Starte Warmup in separatem Thread
    warmup_thread = Thread(target=warmup_task, daemon=True)
    warmup_thread.start()
    
    logging.info("Cache Warmup abgeschlossen")

#######################################################
# WIFI FALLBACK ACCESS POINT ENDPOINTS
#######################################################

wifi_fallback_manager = None

try:
    from system.wifi_fallback import WiFiFallbackManager
    wifi_fallback_manager = WiFiFallbackManager()
    logging.info("WiFi Fallback Manager initialisiert")
except Exception as e:
    logging.warning(f"WiFi Fallback Manager konnte nicht initialisiert werden: {e}")

@app.route('/system/wifi_fallback/status')
def wifi_fallback_status():
    """Gibt Status des WiFi Fallback Systems zurück"""
    try:
        if wifi_fallback_manager is None:
            return jsonify({'error': 'WiFi Fallback nicht verfügbar'}), 503

        return jsonify({
            'enabled': wifi_fallback_manager.config['enabled'],
            'ap_active': wifi_fallback_manager.ap_active,
            'wifi_connected': wifi_fallback_manager.is_wifi_connected(),
            'ap_ssid': wifi_fallback_manager.config['ssid'],
            'ap_ip': wifi_fallback_manager.config['ip_address'],
            'failed_checks': wifi_fallback_manager.failed_checks,
            'max_failed_checks': wifi_fallback_manager.max_failed_checks
        })
    except Exception as e:
        logging.error(f"WiFi Fallback Status Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/wifi_fallback/config', methods=['GET'])
def get_wifi_fallback_config():
    """Gibt Konfiguration des WiFi Fallback Systems zurück"""
    try:
        if wifi_fallback_manager is None:
            return jsonify({'error': 'WiFi Fallback nicht verfügbar'}), 503

        # Passwort ausblenden
        config = wifi_fallback_manager.config.copy()
        config['password'] = '********'

        return jsonify(config)
    except Exception as e:
        logging.error(f"WiFi Fallback Config Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/wifi_fallback/config', methods=['POST'])
def update_wifi_fallback_config():
    """Aktualisiert Konfiguration des WiFi Fallback Systems"""
    try:
        if wifi_fallback_manager is None:
            return jsonify({'error': 'WiFi Fallback nicht verfügbar'}), 503

        data = request.get_json()

        # Erlaubte Felder
        allowed_fields = ['enabled', 'ssid', 'password', 'channel', 'check_interval']

        for field in allowed_fields:
            if field in data:
                wifi_fallback_manager.config[field] = data[field]

        wifi_fallback_manager.save_config()

        return jsonify({
            'success': True,
            'message': 'Konfiguration aktualisiert',
            'config': wifi_fallback_manager.config
        })
    except Exception as e:
        logging.error(f"WiFi Fallback Config Update Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/wifi_fallback/enable_ap', methods=['POST'])
def enable_wifi_fallback_ap():
    """Aktiviert Access Point manuell"""
    try:
        if wifi_fallback_manager is None:
            return jsonify({'error': 'WiFi Fallback nicht verfügbar'}), 503

        success = wifi_fallback_manager.enable_access_point()

        if success:
            return jsonify({
                'success': True,
                'message': f'Access Point aktiviert: {wifi_fallback_manager.config["ssid"]}',
                'ssid': wifi_fallback_manager.config['ssid'],
                'ip': wifi_fallback_manager.config['ip_address'],
                'password': wifi_fallback_manager.config['password']
            })
        else:
            return jsonify({'error': 'Access Point konnte nicht aktiviert werden'}), 500

    except Exception as e:
        logging.error(f"WiFi Fallback Enable AP Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/wifi_fallback/disable_ap', methods=['POST'])
def disable_wifi_fallback_ap():
    """Deaktiviert Access Point manuell"""
    try:
        if wifi_fallback_manager is None:
            return jsonify({'error': 'WiFi Fallback nicht verfügbar'}), 503

        success = wifi_fallback_manager.disable_access_point()

        if success:
            return jsonify({
                'success': True,
                'message': 'Access Point deaktiviert, WiFi Client wiederhergestellt'
            })
        else:
            return jsonify({'error': 'Access Point konnte nicht deaktiviert werden'}), 500

    except Exception as e:
        logging.error(f"WiFi Fallback Disable AP Error: {e}")
        return jsonify({'error': str(e)}), 500

# SERVER START
if __name__ == '__main__':
    try:
        # Cache warmup
        Timer(2.0, warmup_cache).start()
        
        # Startup info
        logging.info("🚀 Starte CatBot V3 API Server mit erweiterten Performance-Optimierungen...")
        logging.info("💡 Für noch bessere Performance installiere gunicorn: pip3 install gunicorn")
        logging.info("📝 Dann starte mit: gunicorn -w 2 -b 0.0.0.0:5000 main:app")
        logging.info("🔧 Verwende Flask Development Server mit Threading...")
        
        # Start Flask Server mit optimierten Einstellungen
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=False,  # Performance
            threaded=True,  # Parallel requests
            use_reloader=False  # Stabilität
        )
        
    except KeyboardInterrupt:
        logging.info("Server wird heruntergefahren...")
    except Exception as e:
        logging.error(f"Server-Start Fehler: {e}")
    finally:
        # Cleanup beim Beenden
        try:
            hardware.cleanup()
            executor.shutdown(wait=True)
            smart_cache.clear_all()
            logging.info("Server-Cleanup abgeschlossen")
        except Exception as e:
            logging.error(f"Server-Cleanup Fehler: {e}")
