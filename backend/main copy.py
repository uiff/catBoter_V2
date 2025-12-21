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
        self.weight_cache = {'data': None, 'timestamp': 0, 'ttl': 3}
        self.distance_cache = {'data': None, 'timestamp': 0, 'ttl': 2}
        self.motor_cache = {'data': None, 'timestamp': 0, 'ttl': 1}
        self.system_cache = {'data': None, 'timestamp': 0, 'ttl': 10}
        self.feeding_cache = {'data': None, 'timestamp': 0, 'ttl': 5}
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

@app.route('/api/swagger.yaml')
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
            
            logging.info("🚀 Starte Motor OHNE Parameter (wie ursprüngliche main.py)")
            
            # Exakt wie in deiner ursprünglichen main.py
            motor.rotate_motor()  # OHNE Parameter!
            
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
            return jsonify({'cpu_usage': cpu_info})
        else:
            # Fallback
            try:
                import psutil
                return jsonify({'cpu_usage': psutil.cpu_percent(interval=0.1)})
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
        plan_name = data.get('planName')  # Beachte: planName statt plan_name!
        
        if not plan_name:
            return jsonify({'error': 'Kein Planname angegeben'}), 400

        # Pläne laden
        feeding_plans = load_feeding_plans()
        if not feeding_plans:
            return jsonify({'error': 'Keine Fütterungspläne gefunden'}), 404

        # Alle Pläne deaktivieren, gewählten aktivieren
        plan_found = False
        for plan in feeding_plans:
            plan['active'] = (plan.get('planName') == plan_name)
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
    """InfluxDB-Daten abrufen"""
    try:
        # Hier würde normalerweise InfluxDB-Abfrage stehen
        # Für jetzt nur Platzhalter
        return jsonify({
            'measurement': measurement,
            'data': [],
            'message': 'InfluxDB-Integration nicht implementiert'
        })
    except Exception as e:
        logging.error(f"InfluxDB query error: {e}")
        return jsonify({'error': str(e)}), 500

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
        
        # Sammle Ergebnisse mit Timeout
        results = {}
        for name, future in futures.items():
            try:
                results[name] = future.result(timeout=10)
            except Exception as e:
                logging.error(f"Dashboard {name} error: {e}")
                results[name] = None
        
        # Dashboard-Response
        dashboard_data = {
            'timestamp': datetime.datetime.now().isoformat(),
            'weight': results['weight'],
            'distance': results['distance'],
            'motor_status': motor_status,
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
        
        return jsonify({
            'weight': weight_value,
            'distance': distance_value,
            'motor': motor_status,
            'timestamp': datetime.datetime.now().isoformat()
        })
    except Exception as e:
        logging.error(f"Sensors endpoint error: {e}")
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