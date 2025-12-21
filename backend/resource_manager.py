"""
Resource Manager für CatBot V3
Zentrales Management aller Hardware-Ressourcen und Thread-Sicherheit
"""

import threading
import atexit
import logging
import time
import RPi.GPIO as GPIO
from typing import Optional, Dict, Any, Callable

# Konfiguriere Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ResourceManager:
    """
    Singleton-Klasse für zentrales Ressourcen-Management
    """
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(ResourceManager, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        # Verhindere mehrfache Initialisierung
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self._cleanup_callbacks = []
        self._resources = {}
        self._gpio_initialized = False
        self._main_lock = threading.RLock()  # Reentrant Lock
        
        # Registriere automatisches Cleanup beim Programm-Ende
        atexit.register(self.cleanup_all)
        
        logging.info("[RESOURCE MANAGER] Initialisiert")
    
    def initialize_gpio(self):
        """Thread-sichere GPIO-Initialisierung"""
        with self._main_lock:
            if not self._gpio_initialized:
                try:
                    GPIO.setwarnings(False)
                    GPIO.setmode(GPIO.BCM)
                    self._gpio_initialized = True
                    logging.info("[RESOURCE MANAGER] GPIO initialisiert")
                except Exception as e:
                    logging.error(f"[RESOURCE MANAGER] GPIO-Initialisierung fehlgeschlagen: {e}")
                    raise
    
    def register_resource(self, name: str, resource: Any, cleanup_callback: Optional[Callable] = None):
        """
        Registriert eine Ressource für zentrales Management
        
        Args:
            name: Eindeutiger Name der Ressource
            resource: Die Ressource selbst
            cleanup_callback: Optionale Cleanup-Funktion
        """
        with self._main_lock:
            if name in self._resources:
                logging.warning(f"[RESOURCE MANAGER] Ressource '{name}' bereits registriert - überschreibe")
            
            self._resources[name] = {
                'resource': resource,
                'cleanup_callback': cleanup_callback,
                'created_at': time.time()
            }
            
            logging.info(f"[RESOURCE MANAGER] Ressource '{name}' registriert")
    
    def get_resource(self, name: str) -> Optional[Any]:
        """Holt eine registrierte Ressource"""
        with self._main_lock:
            resource_info = self._resources.get(name)
            if resource_info:
                return resource_info['resource']
            return None
    
    def unregister_resource(self, name: str, cleanup: bool = True):
        """
        Entfernt eine Ressource und führt optional Cleanup durch
        
        Args:
            name: Name der Ressource
            cleanup: Ob Cleanup-Callback ausgeführt werden soll
        """
        with self._main_lock:
            resource_info = self._resources.get(name)
            if resource_info:
                if cleanup and resource_info['cleanup_callback']:
                    try:
                        resource_info['cleanup_callback']()
                        logging.info(f"[RESOURCE MANAGER] Cleanup für '{name}' ausgeführt")
                    except Exception as e:
                        logging.error(f"[RESOURCE MANAGER] Cleanup-Fehler für '{name}': {e}")
                
                del self._resources[name]
                logging.info(f"[RESOURCE MANAGER] Ressource '{name}' entfernt")
            else:
                logging.warning(f"[RESOURCE MANAGER] Ressource '{name}' nicht gefunden")
    
    def register_cleanup(self, callback: Callable):
        """Registriert eine globale Cleanup-Funktion"""
        with self._main_lock:
            if callback not in self._cleanup_callbacks:
                self._cleanup_callbacks.append(callback)
                logging.debug(f"[RESOURCE MANAGER] Cleanup-Callback registriert: {callback.__name__}")
    
    def unregister_cleanup(self, callback: Callable):
        """Entfernt eine Cleanup-Funktion"""
        with self._main_lock:
            if callback in self._cleanup_callbacks:
                self._cleanup_callbacks.remove(callback)
                logging.debug(f"[RESOURCE MANAGER] Cleanup-Callback entfernt: {callback.__name__}")
    
    def cleanup_all(self):
        """Führt komplettes Cleanup aller Ressourcen durch"""
        with self._main_lock:
            logging.info("[RESOURCE MANAGER] Starte komplettes Cleanup...")
            
            # 1. Cleanup aller registrierten Ressourcen
            resource_names = list(self._resources.keys())
            for name in resource_names:
                self.unregister_resource(name, cleanup=True)
            
            # 2. Globale Cleanup-Callbacks ausführen
            for callback in self._cleanup_callbacks[:]:  # Kopie der Liste
                try:
                    callback()
                    logging.debug(f"[RESOURCE MANAGER] Globaler Cleanup ausgeführt: {callback.__name__}")
                except Exception as e:
                    logging.error(f"[RESOURCE MANAGER] Globaler Cleanup-Fehler: {e}")
            
            # 3. GPIO cleanup falls initialisiert
            if self._gpio_initialized:
                try:
                    GPIO.cleanup()
                    self._gpio_initialized = False
                    logging.info("[RESOURCE MANAGER] GPIO cleanup abgeschlossen")
                except Exception as e:
                    logging.error(f"[RESOURCE MANAGER] GPIO cleanup Fehler: {e}")
            
            # 4. Cleanup-Liste leeren
            self._cleanup_callbacks.clear()
            
            logging.info("[RESOURCE MANAGER] Komplettes Cleanup abgeschlossen")
    
    def get_status(self) -> Dict[str, Any]:
        """Gibt Status-Informationen zurück"""
        with self._main_lock:
            return {
                'gpio_initialized': self._gpio_initialized,
                'registered_resources': list(self._resources.keys()),
                'cleanup_callbacks_count': len(self._cleanup_callbacks),
                'total_resources': len(self._resources)
            }
    
    def force_cleanup_resource(self, name: str):
        """Erzwingt Cleanup einer spezifischen Ressource"""
        logging.warning(f"[RESOURCE MANAGER] Erzwinge Cleanup für '{name}'")
        self.unregister_resource(name, cleanup=True)

# Singleton-Instanz erstellen
resource_manager = ResourceManager()

# Convenience-Funktionen für einfache Nutzung
def get_resource_manager() -> ResourceManager:
    """Holt die Singleton-Instanz des ResourceManagers"""
    return resource_manager

def register_resource(name: str, resource: Any, cleanup_callback: Optional[Callable] = None):
    """Shortcut für Ressourcen-Registrierung"""
    resource_manager.register_resource(name, resource, cleanup_callback)

def get_resource(name: str) -> Optional[Any]:
    """Shortcut für Ressourcen-Abruf"""
    return resource_manager.get_resource(name)

def register_cleanup(callback: Callable):
    """Shortcut für Cleanup-Registrierung"""
    resource_manager.register_cleanup(callback)

def cleanup_all():
    """Shortcut für komplettes Cleanup"""
    resource_manager.cleanup_all()

# Kontext-Manager für automatisches Ressourcen-Management
class ManagedResource:
    """
    Kontext-Manager für automatisches Ressourcen-Management
    
    Usage:
        with ManagedResource("sensor", my_sensor, cleanup_func) as sensor:
            sensor.do_something()
        # Automatisches Cleanup nach dem with-Block
    """
    
    def __init__(self, name: str, resource: Any, cleanup_callback: Optional[Callable] = None):
        self.name = name
        self.resource = resource
        self.cleanup_callback = cleanup_callback
    
    def __enter__(self):
        register_resource(self.name, self.resource, self.cleanup_callback)
        return self.resource
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        resource_manager.unregister_resource(self.name, cleanup=True)

# Thread-sichere Locks für spezifische Ressourcentypen
class ResourceLocks:
    """Vordefinierte Locks für verschiedene Ressourcentypen"""
    
    gpio_lock = threading.Lock()
    i2c_lock = threading.Lock()
    motor_lock = threading.Lock()
    sensor_lock = threading.Lock()
    feeding_lock = threading.Lock()
    
    @classmethod
    def get_lock(cls, resource_type: str) -> threading.Lock:
        """Holt ein Lock für einen bestimmten Ressourcentyp"""
        lock_map = {
            'gpio': cls.gpio_lock,
            'i2c': cls.i2c_lock,
            'motor': cls.motor_lock,
            'sensor': cls.sensor_lock,
            'feeding': cls.feeding_lock
        }
        
        return lock_map.get(resource_type, threading.Lock())

# Test-Funktion
def test_resource_manager():
    """Testet den ResourceManager"""
    
    class TestResource:
        def __init__(self, name):
            self.name = name
            self.active = True
            print(f"TestResource {name} erstellt")
        
        def cleanup(self):
            self.active = False
            print(f"TestResource {self.name} bereinigt")
    
    print("=== Resource Manager Test ===")
    
    # Test 1: Ressourcen registrieren
    resource1 = TestResource("Resource1")
    resource2 = TestResource("Resource2")
    
    register_resource("test1", resource1, resource1.cleanup)
    register_resource("test2", resource2, resource2.cleanup)
    
    # Test 2: Status abrufen
    print("Status:", resource_manager.get_status())
    
    # Test 3: Ressource abrufen
    retrieved = get_resource("test1")
    print(f"Resource abgerufen: {retrieved.name if retrieved else 'None'}")
    
    # Test 4: Kontext-Manager
    with ManagedResource("test3", TestResource("Resource3"), lambda: print("Context cleanup")) as res:
        print(f"Im Kontext: {res.name}")
    
    # Test 5: Komplettes Cleanup
    print("Führe komplettes Cleanup durch...")
    cleanup_all()
    
    print("Test abgeschlossen!")

if __name__ == "__main__":
    test_resource_manager()