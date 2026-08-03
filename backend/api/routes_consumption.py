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
        # Bei mehreren aktiven Plänen (z. B. Arbeitstage/Wochenende) zählt der,
        # der den HEUTIGEN Tag abdeckt
        active_plan = next((p for p in plans if p.get('active', False)
                            and today_day in p.get('selectedDays', [])), None)

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
                    'skipped': bool(feeding.get('skipped_smart') or feeding.get('skipped_diet')),
                    'skipped_diet': bool(feeding.get('skipped_diet', False)),
                })

        for entry in consumption_manager.get_today_feedings():
            source = entry.get('source')
            # 'hand': Nutzer hat Futter direkt in den Napf gegeben (Waage hat
            # den anhaltenden Gewichtsanstieg erkannt und verbucht)
            if source in ('manual', 'hand'):
                feedings.append({
                    'time': entry.get('time', '')[:5],
                    'amount': entry.get('amount', 0),
                    'type': source,
                    'status': True,
                    'planned_amount': entry.get('amount', 0),
                })

        feedings.sort(key=lambda f: f.get('time') or '')

        # Fress-Zuordnung: erkannte/gelabelte Episoden der Waage gehören zur
        # LETZTEN Futterausgabe davor (nur zu solchen, die wirklich Futter
        # ausgegeben haben) -> "Gefressen: Rocco 8 g" in der Heute-Liste
        try:
            from services import eating_tracker
            today_str = today.strftime('%Y-%m-%d')
            delivered = [f for f in feedings
                         if f.get('time') and (f.get('amount') or 0) > 0]
            for episode in eating_tracker.list_episodes(1):
                if not episode.get('ts', '').startswith(today_str):
                    continue
                cat = episode.get('label') or episode.get('auto_label')
                if not cat:
                    continue
                episode_time = episode.get('ts', '')[11:16]
                target = None
                for feeding in delivered:
                    if feeding['time'] <= episode_time:
                        target = feeding
                    else:
                        break
                if target is None:
                    continue
                eaten = target.setdefault('eaten_by', {})
                eaten[cat] = round(eaten.get(cat, 0) + (episode.get('consumed') or 0), 1)
        except Exception as e:
            logging.debug(f"Fress-Zuordnung fehlgeschlagen: {e}")

        return jsonify({
            'date': today.strftime('%Y-%m-%d'),
            'total': consumption_manager.get_today_total(),
            'feedings': feedings,
        })
    except Exception as e:
        logging.error(f"today_detailed error: {e}")
        return jsonify({'error': str(e)}), 500
