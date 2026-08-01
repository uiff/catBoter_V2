"""Gecachte Sensor-Reads (Gewicht) - eine Stelle statt verstreuter Helfer."""
import logging

from core.cache import smart_cache
from services import hardware


def get_cached_weight():
    """Gewicht mit TTL-Cache (0.5 s). None bei Sensorfehler."""
    cached = smart_cache.get('weight', 'current')
    if cached is not None:
        return cached

    sensor = hardware.get_weight_sensor()
    if sensor is None:
        return None
    try:
        weight = sensor.get_weight()
    except Exception as e:
        logging.debug(f"Gewichtsmessung fehlgeschlagen: {e}")
        return None
    if weight is not None:
        smart_cache.set('weight', 'current', weight)
    return weight


def motor_running():
    """True wenn gerade eine Fütterung/Motorbewegung läuft."""
    motor = hardware.get_motor()
    if motor is None:
        return False
    try:
        return bool(motor.status())
    except Exception:
        return False
