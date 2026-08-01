"""Sensor-Endpoints: Gewicht (inkl. Tare/Kalibrierung) und Tank (cm)."""
import logging

from flask import Blueprint, jsonify, request

from services import hardware, tank_service
from services.sensor_service import get_cached_weight

bp = Blueprint("sensors", __name__)


@bp.route("/weight")
def weight():
    value = get_cached_weight()
    if value is not None:
        return jsonify({"weight": value})
    return jsonify({"error": "Gewichtssensor nicht verfügbar"}), 503


@bp.route("/weight/tare", methods=["POST"])
def weight_tare():
    """Waage tarieren. Bool-Rückgabe des Sensors wird AUSGEWERTET
    (vorher wurde bei Sensorfehler trotzdem Erfolg gemeldet)."""
    sensor = hardware.get_weight_sensor()
    if sensor is None:
        return jsonify({"error": "Gewichtssensor nicht verfügbar"}), 503
    try:
        ok = sensor.tare()
    except Exception as e:
        logging.error(f"Tare error: {e}")
        return jsonify({"error": str(e)}), 500
    if ok:
        return jsonify({"success": True, "message": "Waage tariert"})
    return jsonify({"error": "Tarieren fehlgeschlagen - Sensor prüfen"}), 500


@bp.route("/weight/calibrate", methods=["POST"])
def weight_calibrate():
    """Waage kalibrieren. Vertrag: {known_weight: <Gramm des Referenzgewichts>}."""
    sensor = hardware.get_weight_sensor()
    if sensor is None:
        return jsonify({"error": "Gewichtssensor nicht verfügbar"}), 503
    data = request.get_json(silent=True) or {}
    try:
        known_weight = float(data.get("known_weight"))
    except (TypeError, ValueError):
        return jsonify({"error": "known_weight (Gramm) fehlt oder ist ungültig"}), 400
    if not (1 <= known_weight <= 5000):
        return jsonify({"error": "known_weight muss zwischen 1 und 5000 g liegen"}), 400
    try:
        ok = sensor.calibrate(known_weight)
    except Exception as e:
        logging.error(f"Calibrate error: {e}")
        return jsonify({"error": str(e)}), 500
    if ok:
        return jsonify({"success": True, "message": f"Waage mit {known_weight:g} g kalibriert"})
    return jsonify({"error": "Kalibrierung fehlgeschlagen - Sensor prüfen"}), 500


@bp.route("/distance")
def distance():
    """Tank-Messung: {distance_cm, percent, state}. Für den Kalibrier-
    Assistenten liefert ?fresh=1 eine ungecachte Live-Messung."""
    fresh = request.args.get("fresh") in ("1", "true")
    tank = tank_service.read_tank(use_cache=not fresh)
    if tank["distance_cm"] is None:
        return jsonify({"error": "Distanzsensor nicht verfügbar", **tank}), 503
    return jsonify(tank)


@bp.route("/tank/calibration", methods=["GET"])
def get_tank_calibration():
    return jsonify(tank_service.load_calibration())


@bp.route("/tank/calibration", methods=["POST"])
def set_tank_calibration():
    data = request.get_json(silent=True) or {}
    ok, error = tank_service.save_calibration(
        data.get("min_distance"), data.get("max_distance"))
    if not ok:
        return jsonify({"error": error}), 400
    return jsonify({"success": True, "message": "Tank-Kalibrierung gespeichert",
                    **tank_service.load_calibration()})
