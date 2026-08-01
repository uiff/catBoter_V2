"""Tank-Füllstand: Kalibrierung (cm) und zentrale Prozent-Berechnung.

Einheit durchgängig cm (der Sensor liefert cm über get_distance_cm()).
min_distance = Sensorabstand bei VOLLEM Tank, max_distance = bei LEEREM Tank.
Alte mm-Kalibrierungen (Werte > 100) werden beim Laden automatisch migriert.
"""
import json
import logging
import os
import threading

from core.config import (DATA_DIR, TANK_DEFAULT_MIN_CM, TANK_DEFAULT_MAX_CM,
                         TANK_LOW_PERCENT, TANK_EMPTY_PERCENT)
from core.cache import smart_cache
from services import hardware

CALIBRATION_FILE = DATA_DIR / "tank_calibration.json"
_lock = threading.Lock()


def _atomic_write(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def load_calibration():
    """Lädt die Kalibrierung (cm); migriert alte mm-Werte (>100) einmalig."""
    with _lock:
        cal = {"min_distance": TANK_DEFAULT_MIN_CM, "max_distance": TANK_DEFAULT_MAX_CM}
        try:
            if CALIBRATION_FILE.exists():
                with open(CALIBRATION_FILE) as f:
                    stored = json.load(f)
                cal["min_distance"] = float(stored.get("min_distance", cal["min_distance"]))
                cal["max_distance"] = float(stored.get("max_distance", cal["max_distance"]))
        except (json.JSONDecodeError, OSError, ValueError) as e:
            logging.error(f"Tank-Kalibrierung unlesbar ({e}) - nutze Defaults")
            return cal

        # mm-Migration: alte Speicherung war in mm (z. B. 230 statt 23.0)
        if cal["max_distance"] > 100:
            cal["min_distance"] = round(cal["min_distance"] / 10, 1)
            cal["max_distance"] = round(cal["max_distance"] / 10, 1)
            logging.info(f"Tank-Kalibrierung von mm nach cm migriert: {cal}")
            try:
                _atomic_write(CALIBRATION_FILE, cal)
            except OSError as e:
                logging.warning(f"Tank-Migration konnte nicht gespeichert werden: {e}")
        return cal


def save_calibration(min_cm, max_cm):
    """Speichert die Kalibrierung. Returns (ok, error)."""
    try:
        min_cm = round(float(min_cm), 1)
        max_cm = round(float(max_cm), 1)
    except (TypeError, ValueError):
        return False, "Ungültige Werte"
    if not (0 < min_cm < max_cm <= 100):
        return False, "Es muss gelten: 0 < voll (min) < leer (max) <= 100 cm"
    with _lock:
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            _atomic_write(CALIBRATION_FILE, {"min_distance": min_cm, "max_distance": max_cm})
        except OSError as e:
            return False, f"Speichern fehlgeschlagen: {e}"
    return True, None


def percent_from_distance(distance_cm, cal=None):
    """Rechnet eine cm-Distanz in Füllstand-Prozent um (geclamped 0-100)."""
    if distance_cm is None:
        return None
    if cal is None:
        cal = load_calibration()
    span = cal["max_distance"] - cal["min_distance"]
    if span <= 0:
        return None
    percent = (cal["max_distance"] - distance_cm) / span * 100
    return round(max(0.0, min(100.0, percent)), 1)


def state_from_percent(percent):
    if percent is None:
        return "unknown"
    if percent < TANK_EMPTY_PERCENT:
        return "empty"
    if percent < TANK_LOW_PERCENT:
        return "low"
    return "ok"


def read_tank(use_cache=True):
    """Liest den Tank: {distance_cm, percent, state} (distance_cm None bei Sensorfehler)."""
    distance_cm = smart_cache.get("distance", "cm") if use_cache else None
    if distance_cm is None:
        sensor = hardware.get_distance_sensor()
        if sensor is not None:
            try:
                distance_cm = sensor.get_distance_cm()
            except Exception as e:
                logging.debug(f"Tank: Distanzmessung fehlgeschlagen: {e}")
                distance_cm = None
        if distance_cm is not None:
            smart_cache.set("distance", "cm", distance_cm)

    percent = percent_from_distance(distance_cm)
    return {
        "distance_cm": distance_cm,
        "percent": percent,
        "state": state_from_percent(percent),
    }
