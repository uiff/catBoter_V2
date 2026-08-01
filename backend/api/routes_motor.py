"""Motor-Endpoints: grammbasierte manuelle Fütterung über den Plan-Regelkreis."""
from flask import Blueprint, jsonify, request

from services import feeding_service
from services.sensor_service import motor_running

bp = Blueprint("motor", __name__)


@bp.route("/motor/status")
def motor_status():
    return jsonify({
        "running": motor_running(),
        "active_feeding": feeding_service.get_active_feeding(),
    })


@bp.route("/motor/feed", methods=["POST"])
def motor_feed():
    """Manuelle Fütterung: {amount: <Gramm>}. Antwort 202, Ergebnis kommt
    asynchron über die Socket-Events feeding_progress/feeding_completed."""
    data = request.get_json(silent=True) or {}
    ok, error = feeding_service.start_manual_feed(
        data.get("amount"), data.get("slow_minutes", 0))
    if not ok:
        status = 409 if "bereits" in (error or "") else 400
        if "Hardware" in (error or "") or "Sensor" in (error or ""):
            status = 503
        return jsonify({"error": error}), status
    return jsonify({"status": "started", "target_grams": round(float(data.get("amount")), 1)}), 202


@bp.route("/motor/stop", methods=["POST"])
def motor_stop():
    ok, error = feeding_service.stop_feeding()
    if not ok:
        return jsonify({"error": error}), 503
    return jsonify({"success": True, "message": "Motor gestoppt"})
