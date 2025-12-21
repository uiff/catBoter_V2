import time
import board
import busio
import adafruit_vl53l0x
import threading
import logging

# Konfiguriere Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class VL53L0XSensor:
    def __init__(self, min_distance_cm=4, max_distance_cm=55, max_retries=3):
        # Thread-Sicherheit
        self._lock = threading.Lock()
        
        # Konfigurierbare Parameter
        self.min_distance_cm = min_distance_cm  # 4 cm entspricht 100%
        self.max_distance_cm = max_distance_cm  # 55 cm entspricht 0%
        self.max_retries = max_retries
        
        # Sensor-Zustand
        self.sensor = None
        self.i2c = None
        self.is_initialized = False
        
        # Initialisierung mit Retry-Logik
        self._init_sensor()

    def _init_sensor(self):
        """Initialisiert den Sensor mit Retry-Logik"""
        for attempt in range(self.max_retries):
            try:
                with self._lock:
                    # Initialisiere den I2C-Bus
                    self.i2c = busio.I2C(board.SCL, board.SDA)
                    
                    # Initialisiere den VL53L0X-Sensor
                    self.sensor = adafruit_vl53l0x.VL53L0X(self.i2c)
                    self.is_initialized = True
                    
                logging.info(f"[DISTANCE SENSOR] Sensor erfolgreich initialisiert (Versuch {attempt + 1})")
                return True
                
            except RuntimeError as e:
                logging.warning(f"[DISTANCE SENSOR] Initialisierung fehlgeschlagen (Versuch {attempt + 1}): {e}")
                if attempt == self.max_retries - 1:
                    logging.error(f"[DISTANCE SENSOR] Initialisierung nach {self.max_retries} Versuchen fehlgeschlagen")
                    self.is_initialized = False
                    return False
                time.sleep(1)  # Warte vor nächstem Versuch
                
            except Exception as e:
                logging.error(f"[DISTANCE SENSOR] Unerwarteter Fehler bei Initialisierung: {e}")
                self.is_initialized = False
                return False
        
        return False

    def _convert_to_percentage(self, distance_cm):
        """Konvertiert Distanz in cm zu Füllstand in Prozent"""
        if distance_cm <= self.min_distance_cm:
            return 100.0
        elif distance_cm >= self.max_distance_cm:
            return 0.0
        else:
            # Lineare Interpolation zwischen min und max
            percentage = (self.max_distance_cm - distance_cm) / (self.max_distance_cm - self.min_distance_cm) * 100
            return round(percentage, 1)

    def get_distance_raw(self):
        """
        Misst die Rohdistanz in mm
        Returns: distance in mm or None on error
        """
        if not self.is_initialized:
            logging.warning("[DISTANCE SENSOR] Sensor nicht initialisiert")
            return None

        for attempt in range(self.max_retries):
            try:
                with self._lock:
                    if self.sensor is None:
                        return None
                    
                    # Messe die Entfernung in mm
                    distance_mm = self.sensor.range
                    logging.debug(f"[DISTANCE SENSOR] Rohdistanz: {distance_mm} mm")
                    return distance_mm
                    
            except RuntimeError as e:
                logging.warning(f"[DISTANCE SENSOR] Messung fehlgeschlagen (Versuch {attempt + 1}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(0.1)  # Kurze Pause vor Wiederholung
                    continue
                else:
                    logging.error(f"[DISTANCE SENSOR] Messung nach {self.max_retries} Versuchen fehlgeschlagen")
                    return None
            except Exception as e:
                logging.error(f"[DISTANCE SENSOR] Unerwarteter Fehler bei Messung: {e}")
                return None
        
        return None

    def get_distance(self):
        """
        Misst die Entfernung und gibt den Füllstand in Prozent zurück
        Returns: Füllstand in Prozent (0-100) oder None bei Fehler
        """
        distance_mm = self.get_distance_raw()
        if distance_mm is None:
            return None
        
        try:
            # Konvertiere mm zu cm
            distance_cm = round(distance_mm / 10, 1)
            
            # Konvertiere zu Prozent
            percentage = self._convert_to_percentage(distance_cm)
            
            logging.debug(f"[DISTANCE SENSOR] {distance_cm} cm -> {percentage}% Füllstand")
            return percentage
            
        except Exception as e:
            logging.error(f"[DISTANCE SENSOR] Fehler bei Konvertierung: {e}")
            return None

    def get_distance_cm(self):
        """
        Misst die Entfernung und gibt sie in cm zurück
        Returns: Distanz in cm oder None bei Fehler
        """
        distance_mm = self.get_distance_raw()
        if distance_mm is None:
            return None
        
        return round(distance_mm / 10, 1)

    def is_ready(self):
        """Prüft ob der Sensor bereit ist"""
        return self.is_initialized and self.sensor is not None

    def reinitialize(self):
        """Reinitialisiert den Sensor bei Problemen"""
        logging.info("[DISTANCE SENSOR] Reinitialisierung gestartet...")
        with self._lock:
            self.sensor = None
            self.i2c = None
            self.is_initialized = False
        
        return self._init_sensor()

    def configure_range(self, min_cm=None, max_cm=None):
        """
        Konfiguriert den Messbereich neu
        """
        if min_cm is not None:
            self.min_distance_cm = min_cm
        if max_cm is not None:
            self.max_distance_cm = max_cm
        
        logging.info(f"[DISTANCE SENSOR] Messbereich konfiguriert: {self.min_distance_cm}cm-{self.max_distance_cm}cm")

    def get_status(self):
        """Gibt Status-Informationen zurück"""
        return {
            "initialized": self.is_initialized,
            "min_distance_cm": self.min_distance_cm,
            "max_distance_cm": self.max_distance_cm,
            "max_retries": self.max_retries
        }

    def cleanup(self):
        """Ressourcen freigeben"""
        with self._lock:
            if self.sensor:
                try:
                    # Sensor-spezifische Cleanup falls nötig
                    pass
                except Exception as e:
                    logging.warning(f"[DISTANCE SENSOR] Cleanup-Warnung: {e}")
            
            self.sensor = None
            self.i2c = None
            self.is_initialized = False
            logging.info("[DISTANCE SENSOR] Cleanup abgeschlossen")

# Teste die Klasse, wenn das Modul direkt ausgeführt wird
if __name__ == "__main__":
    sensor = VL53L0XSensor()
    
    if not sensor.is_ready():
        print("Sensor konnte nicht initialisiert werden!")
        exit(1)
    
    print("Sensor bereit! Status:", sensor.get_status())
    print("Starte kontinuierliche Messungen...")
    print("Drücke Ctrl+C zum Beenden")
    
    try:
        measurement_count = 0
        while True:
            try:
                # Verschiedene Messmethoden testen
                distance_percent = sensor.get_distance()
                distance_cm = sensor.get_distance_cm()
                distance_mm = sensor.get_distance_raw()
                
                measurement_count += 1
                
                if distance_percent is not None:
                    print(f"Messung {measurement_count}: {distance_cm}cm | {distance_mm}mm | {distance_percent}% Füllstand")
                else:
                    print(f"Messung {measurement_count}: Fehler bei der Messung")
                    
                    # Bei mehreren fehlgeschlagenen Messungen Reinitialisierung versuchen
                    if measurement_count % 10 == 0:
                        print("Versuche Sensor-Reinitialisierung...")
                        if sensor.reinitialize():
                            print("Reinitialisierung erfolgreich!")
                        else:
                            print("Reinitialisierung fehlgeschlagen!")
                
                time.sleep(1)
                
            except Exception as e:
                print(f"Unerwarteter Fehler: {e}")
                time.sleep(1)
                
    except KeyboardInterrupt:
        print("\nMessung beendet durch Benutzer.")
    finally:
        sensor.cleanup()
        print("Sensor cleanup abgeschlossen.")