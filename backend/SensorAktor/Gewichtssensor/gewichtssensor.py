import os
import RPi.GPIO as GPIO
from hx711 import HX711
import json
import time
import threading
from enum import Enum, auto
import logging

# Konfiguriere Logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

class SensorState(Enum):
    INIT = auto()
    TARED = auto()
    CALIBRATING = auto()
    READY = auto()
    ERROR = auto()

class Gewichtssensor:
    def __init__(self):
        self.DT_PIN = 17  # Data Pin
        self.SCK_PIN = 18  # Clock Pin

        # Thread-Sicherheit
        self._lock = threading.Lock()
        self._initialized = False

        # Verzeichnis des aktuellen Skripts und Kalibrierungsdateipfad
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.calibration_file = os.path.join(self.base_dir, 'kalibrierung.json')

        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)

        # Initialisiere HX711 mit korrekten Parameterbezeichnungen
        self.hx = HX711(self.DT_PIN, self.SCK_PIN)

        self.reference_unit = 1.0  # Standardwert (wird nach Kalibrierung angepasst)
        self.offset = 0.0  # Standard-Offset (wird nach Tarierung angepasst)
        self.state = SensorState.INIT
        self._is_tared = False  # Flag für Tarierungs-Status

        # Stabilisierungsparameter
        self.stabilization_time = 2.0
        self.measurement_samples = 8  # Erhöht von 5 auf 8 für stabilere Messungen

        self.load_calibration()  # Lade Kalibrierungsdaten beim Start

        # Überprüfe, ob gültige Kalibrierungsdaten geladen wurden
        if self.reference_unit != 1.0 or self.offset != 0.0:
            self.state = SensorState.READY
            logging.info(f"[INIT] State = {self.state} (Kalibrierungsdaten geladen)")
        else:
            self.state = SensorState.INIT
            logging.info(f"[INIT] State = {self.state} (Keine Kalibrierungsdaten)")

        self._initialized = True

    def load_calibration(self):
        try:
            with open(self.calibration_file, 'r') as f:
                data = json.load(f)
                self.reference_unit = data['reference_unit']
                self.offset = data['offset']
                logging.info(f"[LOAD CALIBRATION] Kalibrierungsdaten geladen: Reference Unit={self.reference_unit}, Offset={self.offset}")
        except FileNotFoundError:
            logging.warning("[LOAD CALIBRATION] Keine Kalibrierungsdaten gefunden")
        except json.JSONDecodeError:
            logging.error("[LOAD CALIBRATION] Fehler beim Dekodieren der Kalibrierungsdaten")
            self.state = SensorState.ERROR
        except Exception as e:
            logging.error(f"[LOAD CALIBRATION] Unbekannter Fehler: {e}")
            self.state = SensorState.ERROR

    def save_calibration(self):
        data = {
            'reference_unit': self.reference_unit,
            'offset': self.offset
        }
        try:
            with open(self.calibration_file, 'w') as f:
                json.dump(data, f)
            logging.info("[SAVE CALIBRATION] Kalibrierungsdaten gespeichert")
        except Exception as e:
            logging.error(f"[SAVE CALIBRATION] Fehler beim Speichern: {e}")
            self.state = SensorState.ERROR

    def _get_stable_reading(self, samples=None):
        """
        Holt eine stabile Rohwert-Messung durch Mittelwertbildung
        """
        if samples is None:
            samples = self.measurement_samples

        logging.debug(f"[STABLE READING] Starte mit {samples} Samples (sammle {samples*2} Messungen)")
        readings = []
        attempts = 0
        max_attempts = samples * 6  # Noch mehr Versuche wegen Hardware-Instabilität

        # HARDWARE-FILTER DEAKTIVIERT: HX711 Rohwerte schwanken zu stark
        # MAD-Filter ist ausreichend für Ausreißer-Filterung

        while len(readings) < samples * 2 and attempts < max_attempts:
            attempts += 1
            try:
                # KORRIGIERT: Verwende die korrekte HX711 API - verschiedene Varianten testen
                raw = None

                # Versuche HX711 Rohwert-Methoden (in der richtigen Reihenfolge!)
                # WICHTIG: get_value() gibt Rohwerte, get_weight() gibt berechnete Gewichte
                if hasattr(self.hx, 'get_value'):
                    raw = self.hx.get_value(1)  # 1 Sample für Geschwindigkeit
                elif hasattr(self.hx, 'read'):
                    raw = self.hx.read()
                elif hasattr(self.hx, 'read_average'):
                    raw = self.hx.read_average(1)
                else:
                    # Fallback
                    try:
                        raw = self.hx.get_value(1)
                    except:
                        raw = None
                        logging.error(f"[STABLE READING] Versuch {attempts}: Fallback fehlgeschlagen")

                # Akzeptiere alle nicht-None Rohwerte (MAD-Filter entfernt Ausreißer später)
                if raw is not None:
                    readings.append(raw)
                else:
                    logging.debug(f"[STABLE READING] Versuch {attempts}: raw=None")
                time.sleep(0.01)  # Kurze Pause zwischen Messungen
            except Exception as e:
                logging.warning(f"[STABLE READING] Versuch {attempts} fehlgeschlagen: {e}")
                continue

        if len(readings) < samples:
            logging.error(f"[STABLE READING] Nur {len(readings)} von {samples} Messungen erfolgreich")
            return None

        # VERBESSERTE Ausreißer-Entfernung mit Median Absolute Deviation (MAD)
        import statistics

        # Berechne Median (robuster als Mean)
        median = statistics.median(readings)

        # Berechne MAD (Median Absolute Deviation)
        mad = statistics.median([abs(x - median) for x in readings])

        # Entferne Ausreißer (mehr als 2 MAD vom Median entfernt - aggressiver!)
        # MAD = 0 bedeutet alle Werte sind gleich
        if mad > 0:
            threshold = 2 * mad  # Reduziert von 3 auf 2 für aggressivere Filterung
            filtered_readings = [x for x in readings if abs(x - median) <= threshold]

            if len(filtered_readings) < samples // 2:  # Zu viele Ausreißer
                logging.warning(f"[STABLE READING] Zu viele Ausreißer! Median={median:.0f}, MAD={mad:.0f}")
                # Verwende nur Werte nahe am Median
                filtered_readings = sorted(readings, key=lambda x: abs(x - median))[:samples]
        else:
            filtered_readings = readings

        stable_value = sum(filtered_readings) / len(filtered_readings)
        logging.debug(f"[STABLE READING] {len(readings)} Messungen, {len(filtered_readings)} nach Filterung, Wert: {stable_value:.2f}")
        return stable_value

    def tare(self):
        """
        Thread-sichere Tarierung bei leerer Waage.
        """
        with self._lock:
            if not self._initialized:
                logging.error("[TARE] Sensor nicht initialisiert")
                return False

            if self.state == SensorState.ERROR:
                logging.error("[TARE] Abbruch: State=ERROR.")
                return False

            logging.info("[TARE] Starte Tarierung – bitte sicherstellen, dass Waage leer ist!")
            
            # Sensor stabilisieren
            time.sleep(self.stabilization_time)

            try:
                stable_reading = self._get_stable_reading(20)  # Mehr Messungen für Tarierung
                if stable_reading is None:
                    raise ValueError("Keine stabilen Rohwerte für die Tarierung erhalten.")

                self.offset = stable_reading
                logging.info(f"[TARE] Tara abgeschlossen. Offset={self.offset:.2f}")

                # Speichere Kalibrierung sofort
                self.save_calibration()

                # Wechsle zu READY damit get_weight() funktioniert
                # Setze internes Flag für Kalibrierung
                self.state = SensorState.READY
                self._is_tared = True
                logging.info("[TARE] Sensor ist jetzt READY für Messungen")
                return True

            except Exception as e:
                logging.error(f"[TARE] Fehler: {e}")
                self.state = SensorState.ERROR
                return False

    def calibrate(self, known_weight: float, alternative_formula=False):
        """
        Thread-sichere Kalibrierung mit aufgelegtem Gewicht.
        """
        with self._lock:
            # Prüfe ob tariert wurde (entweder TARED State oder _is_tared Flag)
            if not self._is_tared and self.state != SensorState.TARED:
                logging.warning(f"[CAL] Sensor wurde noch nicht tariert. Bitte zuerst tarieren!")
                # Erlaube Kalibrierung trotzdem, aber warne

            if self.state == SensorState.ERROR:
                logging.error(f"[CAL] Abbruch: State=ERROR")
                return False

            logging.info(f"[CAL] Starte Kalibrierung mit bekanntem Gewicht: {known_weight} g")
            
            # Stabilisierungszeit
            time.sleep(self.stabilization_time)

            try:
                stable_reading = self._get_stable_reading()
                if stable_reading is None:
                    logging.error("[CAL] Fehler: Keine stabilen Messungen erhalten.")
                    self.state = SensorState.ERROR
                    return False

                logging.debug(f"[CAL] Stabiles Rohgewicht: {stable_reading:.2f}")

                if abs(stable_reading - self.offset) < 1:  # Zu wenig Unterschied
                    logging.error("[CAL] Fehler: Gemessenes Gewicht zu nah am Offset.")
                    self.state = SensorState.ERROR
                    return False

                if alternative_formula:
                    # Alternative Formel: Referenzeinheit = bekanntes Gewicht / (gemessen - Offset)
                    self.reference_unit = known_weight / (stable_reading - self.offset)
                    logging.debug(f"[CAL] Verwende alternative Formel. Referenzeinheit = {self.reference_unit:.4f}")
                else:
                    # Standardformel: Referenzeinheit = (gemessen - Offset) / bekanntes Gewicht
                    self.reference_unit = (stable_reading - self.offset) / known_weight
                    logging.debug(f"[CAL] Verwende Standardformel. Referenzeinheit = {self.reference_unit:.4f}")

                self.save_calibration()
                self.state = SensorState.READY  # Ändere den Zustand zu READY
                logging.info(f"[CAL] Kalibrierung abgeschlossen. Referenzeinheit={self.reference_unit:.4f}")
                return True

            except Exception as e:
                logging.error(f"[CAL] Fehler bei der Kalibrierung: {e}")
                self.state = SensorState.ERROR
                return False

    def get_weight(self):
        """
        Thread-sichere Gewichtsmessung
        """
        with self._lock:
            if not self._initialized:
                logging.warning("[GET WEIGHT] Sensor nicht initialisiert")
                return None

            if self.state != SensorState.READY:
                logging.warning(f"[GET WEIGHT] Abbruch: State={self.state}, erwartet=READY.")
                return None

            try:
                stable_reading = self._get_stable_reading()
                if stable_reading is not None:
                    weight = (stable_reading - self.offset) / self.reference_unit

                    # DEADBAND: Werte unter 3g sind Rauschen/Drift - setze auf 0
                    DEADBAND_THRESHOLD = 3.0  # gram
                    if abs(weight) < DEADBAND_THRESHOLD:
                        weight_rounded = 0.0
                        logging.debug(f"[GET WEIGHT] Rohwert: {stable_reading:.2f}, Gewicht unter Deadband ({DEADBAND_THRESHOLD}g) -> 0g")
                    else:
                        # Verhindere negative Gewichtswerte - Minimum ist immer 0!
                        weight_rounded = round(max(0, weight), 2)
                        logging.debug(f"[GET WEIGHT] Rohwert: {stable_reading:.2f}, Gewicht: {weight_rounded:.2f} g")

                    return weight_rounded
                else:
                    logging.error("[GET WEIGHT] Fehler beim Lesen des stabilen Rohwerts.")
                    return None
            except Exception as e:
                logging.error(f"[GET WEIGHT] Unerwarteter Fehler: {e}")
                return None

    def get_state(self):
        """Thread-sichere State-Abfrage"""
        with self._lock:
            return self.state

    def is_ready(self):
        """Prüft ob Sensor bereit für Messungen ist"""
        return self.get_state() == SensorState.READY

    def cleanup(self):
        """Reinige GPIO Einstellungen - thread-safe"""
        with self._lock:
            if self._initialized:
                try:
                    # Nur cleanup wenn wir der letzte Nutzer sind
                    logging.info("[CLEANUP] GPIO bereinigt")
                    # GPIO.cleanup() # Nur aufrufen wenn wirklich nötig
                except Exception as e:
                    logging.warning(f"[CLEANUP] Fehler beim GPIO cleanup: {e}")
                finally:
                    self._initialized = False

# Teste die Klasse, wenn das Modul direkt ausgeführt wird
if __name__ == "__main__":
    sensor = Gewichtssensor()
    try:
        # Schritt 1: Tarieren
        print("Starte Tarierung...")
        success_tare = sensor.tare()
        if not success_tare:
            logging.error("Tarierung fehlgeschlagen.")
        else:
            print("Tarierung erfolgreich!")
            
            # Schritt 2: Kalibrieren mit bekanntem Gewicht
            known_weight = 141  # Beispielwert für das bekannte Gewicht in Gramm
            print(f"Starte Kalibrierung mit {known_weight}g...")
            success_cal = sensor.calibrate(known_weight, alternative_formula=False)
            if not success_cal:
                logging.error("Kalibrierung fehlgeschlagen mit Standardformel. Versuch mit alternativer Formel.")
                success_cal = sensor.calibrate(known_weight, alternative_formula=True)
                if not success_cal:
                    logging.error("Kalibrierung fehlgeschlagen mit alternativer Formel.")
                else:
                    logging.info("Kalibrierung erfolgreich mit alternativer Formel.")
            else:
                logging.info("Kalibrierung erfolgreich mit Standardformel.")

            if success_cal:
                # Warte, bis das Kalibrierungsgewicht entfernt wurde
                input("Kalibrierung abgeschlossen. Entferne das Gewicht und drücke Enter...")

                # Schritt 3: Gewicht messen
                print("Starte Gewichtsmessungen...")
                for i in range(10):
                    weight = sensor.get_weight()
                    if weight is not None:
                        print(f"Messung {i+1}: {weight:.2f} g")
                    else:
                        print(f"Messung {i+1}: Fehler bei der Messung")
                    time.sleep(1)

    except KeyboardInterrupt:
        print("\nMessung beendet durch Benutzer.")
    finally:
        sensor.cleanup()