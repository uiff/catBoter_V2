"""DIE eine Hardware-Quelle.

Genau EINE Instanz je Sensor/Motor - der Motor bekommt den Gewichtssensor,
damit manueller Feed und Plan-Feed denselben geregelten Pfad nutzen.
(Vorher existierten zwei MotorController auf denselben GPIO-Pins:
einer ohne Sensor in main.py, einer mit Sensor in feedingControl.)
"""
import logging
import threading

from SensorAktor.Gewichtssensor.gewichtssensor import Gewichtssensor
from SensorAktor.Distanzsensor.distance_sensor import VL53L0XSensor
from SensorAktor.Motor.motor_control import MotorController

_lock = threading.Lock()
_weight_sensor = None
_distance_sensor = None
_motor = None


def get_weight_sensor():
    global _weight_sensor
    if _weight_sensor is None:
        with _lock:
            if _weight_sensor is None:
                try:
                    _weight_sensor = Gewichtssensor()
                    logging.info("Hardware: Gewichtssensor initialisiert")
                except Exception as e:
                    logging.error(f"Hardware: Gewichtssensor-Init fehlgeschlagen: {e}")
                    return None
    return _weight_sensor


def get_distance_sensor():
    global _distance_sensor
    if _distance_sensor is None:
        with _lock:
            if _distance_sensor is None:
                try:
                    _distance_sensor = VL53L0XSensor()
                    logging.info("Hardware: Distanzsensor initialisiert")
                except Exception as e:
                    logging.error(f"Hardware: Distanzsensor-Init fehlgeschlagen: {e}")
                    return None
    return _distance_sensor


def get_motor():
    """Motor IMMER mit Gewichtssensor - eine Instanz für manuell UND Plan."""
    global _motor
    if _motor is None:
        # Gewichtssensor VOR dem Lock auflösen: get_weight_sensor() nimmt
        # denselben (nicht-reentranten) Lock - sonst Deadlock, wenn die
        # Sensor-Initialisierung zuvor fehlgeschlagen ist
        weight_sensor = get_weight_sensor()
        with _lock:
            if _motor is None:
                try:
                    _motor = MotorController(weight_sensor)
                    logging.info("Hardware: MotorController (mit Gewichtssensor) initialisiert")
                except Exception as e:
                    logging.error(f"Hardware: MotorController-Init fehlgeschlagen: {e}")
                    return None
    return _motor


def cleanup():
    """Cleanup aller Hardware-Ressourcen (Shutdown)."""
    global _weight_sensor, _distance_sensor, _motor
    try:
        if _motor:
            _motor.cleanup()
        if _weight_sensor:
            _weight_sensor.cleanup()
        if _distance_sensor:
            _distance_sensor.cleanup()
        logging.info("Hardware: Cleanup abgeschlossen")
    except Exception as e:
        logging.error(f"Hardware: Cleanup-Fehler: {e}")
    finally:
        _weight_sensor = None
        _distance_sensor = None
        _motor = None
