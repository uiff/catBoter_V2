"""Health-Check und Dashboard (Initial-Load fürs Frontend)."""
import datetime
import logging

from flask import Blueprint, jsonify

from services import tank_service
from services.sensor_service import get_cached_weight, motor_running
from services.consumption_manager import consumption_manager

bp = Blueprint("health", __name__)


@bp.route("/health")
def health():
    # Ehrlicher Healthcheck: hängt der Fütterungs-Scheduler (tickt alle 60 s),
    # meldet /health 503 - Docker markiert den Container dann unhealthy und
    # der Autoheal-Timer auf dem Host startet ihn neu
    from services import heartbeat
    scheduler_age = heartbeat.age("scheduler")
    if scheduler_age is not None and scheduler_age > 180:
        # Läuft gerade eine Fütterung (Anti-Schling/JIT bis 15 min), hält sie
        # den Scheduler LEGITIM auf - erst ab 20 min gilt auch das als Hänger
        from core.locks import feeding_lock
        legit_feed = feeding_lock.locked() and scheduler_age <= 1200
        if not legit_feed:
            return jsonify({
                "status": "degraded",
                "detail": f"Fütterungs-Scheduler seit {scheduler_age:.0f}s ohne Herzschlag",
                "timestamp": datetime.datetime.now().isoformat(),
                "version": "3.6",
            }), 503
    return jsonify({
        "status": "online",
        "timestamp": datetime.datetime.now().isoformat(),
        "version": "3.6",
    })


@bp.route("/health/stats")
def health_stats():
    """Fressverhalten-Statistik für die Gesundheits-Karte."""
    from services import health_monitor
    return jsonify(health_monitor.get_stats())


@bp.route("/dashboard")
def dashboard():
    """Schlanker Initial-Payload - gleiche Struktur wie das sensor_update-Event."""
    try:
        tank = tank_service.read_tank()
        return jsonify({
            "weight": get_cached_weight(),
            "tank": tank,
            "motor_running": motor_running(),
            "today_total": consumption_manager.get_today_total(),
            "timestamp": datetime.datetime.now().isoformat(),
        })
    except Exception as e:
        logging.error(f"Dashboard error: {e}")
        return jsonify({"error": str(e)}), 500
