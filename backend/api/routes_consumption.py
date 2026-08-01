"""Verbrauchs-Statistiken: daily, stats, today_detailed (mit source-Feld)."""
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request

from logic.feedingControl import load_feeding_plans
from services.consumption_manager import consumption_manager

bp = Blueprint("consumption", __name__)

DAY_NAME_MAP = {
    0: 'Montag', 1: 'Dienstag', 2: 'Mittwoch',
    3: 'Donnerstag', 4: 'Freitag', 5: 'Samstag', 6: 'Sonntag',
}


@bp.route("/consumption/daily")
def consumption_daily():
    try:
        days = min(max(int(request.args.get("days", 30)), 1), 90)
    except ValueError:
        days = 30
    return jsonify(consumption_manager.get_daily(days))


@bp.route("/consumption/stats")
def consumption_stats():
    return jsonify(consumption_manager.get_stats())


@bp.route("/consumption/today_detailed")
def today_detailed():
    """Heutige Fütterungen: geplante aus dem aktiven Plan (fed_amount ist
    autoritativ) + manuelle aus dem ConsumptionManager (source == 'manual').
    Die alte 10-Minuten-Näherungs-Heuristik entfällt."""
    try:
        feedings = []
        today = datetime.now()
        today_day = DAY_NAME_MAP[today.weekday()]

        plans = load_feeding_plans()
        active_plan = next((p for p in plans if p.get('active', False)), None)

        if active_plan and 'feedingSchedule' in active_plan:
            for feeding in active_plan['feedingSchedule'].get(today_day, []):
                if 'fed_amount' in feeding:
                    fed_amount = feeding.get('fed_amount') or 0
                else:
                    fed_amount = 0
                feedings.append({
                    'time': feeding.get('time'),
                    'amount': fed_amount,
                    'type': 'random' if active_plan.get('isRandomGenerated') else 'auto',
                    'status': feeding.get('status'),
                    'planned_amount': feeding.get('weight', 0),
                })

        for entry in consumption_manager.get_today_feedings():
            if entry.get('source') == 'manual':
                feedings.append({
                    'time': entry.get('time', '')[:5],
                    'amount': entry.get('amount', 0),
                    'type': 'manual',
                    'status': True,
                    'planned_amount': entry.get('amount', 0),
                })

        feedings.sort(key=lambda f: f.get('time') or '')
        return jsonify({
            'date': today.strftime('%Y-%m-%d'),
            'total': consumption_manager.get_today_total(),
            'feedings': feedings,
        })
    except Exception as e:
        logging.error(f"today_detailed error: {e}")
        return jsonify({'error': str(e)}), 500
