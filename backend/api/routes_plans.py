"""Fütterungsplan-Endpoints (Auto + Random).

Datenmodell und Verhalten sind 1:1 aus main.py übernommen (Plan-Logik ist
unantastbar). Neu: PUT-Routen für in-place-Updates (ersetzt das verlustträchtige
delete-then-create des Frontends) und plans_updated-Events nach jedem Schreiben.
"""
import json
import logging
import random
from datetime import datetime

from flask import Blueprint, jsonify, request

from core.config import FEEDING_PLAN_DIR
from logic.feedingControl import (load_feeding_plans, save_feeding_plans,
                                  aktualisiere_fütterungsstatus)
from services import realtime

bp = Blueprint("plans", __name__)

RANDOM_PLANS_FILE = FEEDING_PLAN_DIR / "randomPlans.json"

DAY_TRANSLATION = {
    'Monday': 'Montag', 'Tuesday': 'Dienstag', 'Wednesday': 'Mittwoch',
    'Thursday': 'Donnerstag', 'Friday': 'Freitag', 'Saturday': 'Samstag',
    'Sunday': 'Sonntag',
}
WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']


def load_random_plans():
    try:
        if RANDOM_PLANS_FILE.exists():
            with open(RANDOM_PLANS_FILE, 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        logging.error(f"Fehler beim Laden der Random-Pläne: {e}")
        return []


def save_random_plans(plans):
    try:
        FEEDING_PLAN_DIR.mkdir(parents=True, exist_ok=True)
        with open(RANDOM_PLANS_FILE, 'w') as f:
            json.dump(plans, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logging.error(f"Fehler beim Speichern der Random-Pläne: {e}")
        return False


def _plan_days(plan):
    return set(plan.get('selectedDays') or [])


def _deactivate_overlapping(plans, target_days, skip_name=None):
    """Deaktiviert nur Pläne, deren Tage sich mit target_days überschneiden.
    Pläne an anderen Tagen (z. B. Arbeitswoche vs. Wochenende) bleiben aktiv -
    so sind mehrere Pläne parallel möglich, ohne Doppel-Fütterung am selben Tag."""
    changed = False
    for plan in plans:
        if plan.get('planName') == skip_name:
            continue
        if plan.get('active') and _plan_days(plan) & target_days:
            plan['active'] = False
            changed = True
    return changed


def _deactivate_overlapping_random(target_days, skip_name=None):
    """Gleiche Regel für die Random-Plan-Liste (eigene Datei)."""
    random_plans = load_random_plans()
    if _deactivate_overlapping(random_plans, target_days, skip_name):
        save_random_plans(random_plans)


def _schedule_status_update():
    """Fütterungsstatus im Hintergrund aktualisieren - eine fällige Fütterung
    darf die HTTP-Antwort nicht um Minuten verzögern (der Scheduler-Tick würde
    sie sonst spätestens in 60 s ohnehin ausführen)."""
    try:
        realtime.socketio.start_background_task(aktualisiere_fütterungsstatus)
    except Exception as e:
        logging.warning(f"Status-Update konnte nicht gestartet werden: {e}")


# ---------- Auto-Pläne ----------

@bp.route('/feeding_plan', methods=['GET'])
def get_feeding_plans():
    try:
        feeding_plans = load_feeding_plans()
        for plan in feeding_plans:
            if 'name' not in plan and 'planName' in plan:
                plan['name'] = plan['planName']
            if 'days' not in plan and 'selectedDays' in plan:
                plan['days'] = plan['selectedDays']
        return jsonify(feeding_plans), 200
    except Exception as e:
        logging.error(f"Get feeding plans error: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/feeding_plan', methods=['POST'])
def save_feeding_plan():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400

        if data.get('weightMode') == 'manual':
            for day, feedings in data.get('feedingSchedule', {}).items():
                for feeding in feedings:
                    if not feeding.get('time') or feeding.get('weight', 0) <= 0:
                        return jsonify({'error': 'Zeit und Gewicht müssen für jede Fütterung angegeben werden'}), 400

        feeding_plans = load_feeding_plans()
        # Doppelte Namen verhindern: DELETE/PUT/Aktivieren arbeiten namensbasiert
        if any(p.get('planName') == data.get('planName') for p in feeding_plans):
            return jsonify({'error': f"Ein Plan namens \"{data.get('planName')}\" existiert bereits"}), 409
        if data.get('active', False):
            _deactivate_overlapping(feeding_plans, _plan_days(data))
            _deactivate_overlapping_random(_plan_days(data))
        feeding_plans.append(data)

        if save_feeding_plans(feeding_plans):
            realtime.emit_plans_updated()
            _schedule_status_update()
            return jsonify({'message': 'Fütterungsplan gespeichert!'}), 201
        return jsonify({'error': 'Fehler beim Speichern'}), 500
    except Exception as e:
        logging.error(f"Save feeding plan error: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/feeding_plan/<string:plan_name>', methods=['PUT'])
def update_feeding_plan(plan_name):
    """In-place-Update eines Auto-Plans (NEU - ersetzt delete-then-create)."""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400

        feeding_plans = load_feeding_plans()
        index = next((i for i, p in enumerate(feeding_plans)
                      if p.get('planName') == plan_name), None)
        if index is None:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404

        # Umbenennen auf einen bereits vergebenen Namen verhindern
        new_name = data.get('planName')
        if new_name != plan_name and any(p.get('planName') == new_name for p in feeding_plans):
            return jsonify({'error': f'Ein Plan namens "{new_name}" existiert bereits'}), 409

        # Laufzeit-Felder des heutigen Tages erhalten: das Frontend sendet nur
        # {time, weight} - status/attempts/fed_amount dürfen beim Bearbeiten
        # nicht verloren gehen (sonst füttert der Scheduler heute erneut!)
        old_schedule = feeding_plans[index].get('feedingSchedule', {})
        for day, feedings in data.get('feedingSchedule', {}).items():
            old_by_time = {f.get('time'): f for f in old_schedule.get(day, [])}
            for feeding in feedings:
                old = old_by_time.get(feeding.get('time'))
                if old:
                    for key in ('status', 'attempts', 'fed_amount', 'last_attempt', 'message'):
                        if key in old and key not in feeding:
                            feeding[key] = old[key]

        if data.get('active', False):
            _deactivate_overlapping(feeding_plans, _plan_days(data), skip_name=plan_name)
            _deactivate_overlapping_random(_plan_days(data))
        feeding_plans[index] = data

        if save_feeding_plans(feeding_plans):
            realtime.emit_plans_updated()
            _schedule_status_update()
            return jsonify({'message': 'Fütterungsplan aktualisiert!'}), 200
        return jsonify({'error': 'Fehler beim Speichern'}), 500
    except Exception as e:
        logging.error(f"Update feeding plan error: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/feeding_plan/<string:plan_name>', methods=['DELETE'])
def delete_feeding_plan(plan_name):
    try:
        feeding_plans = load_feeding_plans()
        if not feeding_plans:
            return jsonify({'error': 'Keine Fütterungspläne gefunden'}), 404

        original_count = len(feeding_plans)
        feeding_plans = [p for p in feeding_plans if p.get('planName') != plan_name]
        if len(feeding_plans) == original_count:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404

        if save_feeding_plans(feeding_plans):
            realtime.emit_plans_updated()
            return jsonify({'message': 'Fütterungsplan gelöscht!'}), 200
        return jsonify({'error': 'Fehler beim Löschen'}), 500
    except Exception as e:
        logging.error(f"Delete feeding plan error: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/feeding_plan/load', methods=['POST'])
def load_feeding_plan():
    """Fütterungsplan aktivieren."""
    try:
        data = request.get_json(silent=True)
        plan_name = (data.get('plan_name') or data.get('planName')) if data else None
        if not plan_name:
            return jsonify({'error': 'Kein Planname angegeben'}), 400

        feeding_plans = load_feeding_plans()
        if not feeding_plans:
            return jsonify({'error': 'Keine Fütterungspläne gefunden'}), 404

        target = next((p for p in feeding_plans
                       if (p.get('name') or p.get('planName')) == plan_name), None)
        if target is None:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404

        # Nur Pläne mit überschneidenden Tagen deaktivieren - Pläne für andere
        # Tage (z. B. Wochenende) bleiben parallel aktiv
        _deactivate_overlapping(feeding_plans, _plan_days(target),
                                skip_name=target.get('planName'))
        _deactivate_overlapping_random(_plan_days(target))
        target['active'] = True

        if save_feeding_plans(feeding_plans):
            realtime.emit_plans_updated()
            _schedule_status_update()
            return jsonify({'message': f'Fütterungsplan {plan_name} geladen!'}), 200
        return jsonify({'error': 'Fehler beim Aktivieren'}), 500
    except Exception as e:
        logging.error(f"Load feeding plan error: {e}")
        return jsonify({'error': str(e)}), 500


# ---------- Random-Pläne ----------

@bp.route('/random_plans', methods=['GET'])
def get_random_plans():
    try:
        return jsonify(load_random_plans()), 200
    except Exception as e:
        logging.error(f"Get random plans error: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/random_plan', methods=['POST'])
def save_random_plan():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        plans = load_random_plans()
        if any(p.get('planName') == data.get('planName') for p in plans):
            return jsonify({'error': f"Ein Plan namens \"{data.get('planName')}\" existiert bereits"}), 409
        plans.append(data)
        if save_random_plans(plans):
            realtime.emit_plans_updated()
            return jsonify({'message': 'Random-Plan gespeichert!'}), 201
        return jsonify({'error': 'Fehler beim Speichern'}), 500
    except Exception as e:
        logging.error(f"Save random plan error: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/random_plan/<string:plan_name>', methods=['PUT'])
def update_random_plan(plan_name):
    """In-place-Update eines Random-Plans (NEU)."""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Keine Daten empfangen'}), 400
        plans = load_random_plans()
        index = next((i for i, p in enumerate(plans)
                      if p.get('planName') == plan_name), None)
        if index is None:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404
        new_name = data.get('planName')
        if new_name != plan_name and any(p.get('planName') == new_name for p in plans):
            return jsonify({'error': f'Ein Plan namens "{new_name}" existiert bereits'}), 409
        plans[index] = data
        if save_random_plans(plans):
            realtime.emit_plans_updated()
            return jsonify({'message': 'Random-Plan aktualisiert!'}), 200
        return jsonify({'error': 'Fehler beim Speichern'}), 500
    except Exception as e:
        logging.error(f"Update random plan error: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/random_plan/<string:plan_name>', methods=['DELETE'])
def delete_random_plan(plan_name):
    try:
        plans = load_random_plans()
        original_count = len(plans)
        plans = [p for p in plans if p.get('planName') != plan_name]
        if len(plans) == original_count:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404
        if save_random_plans(plans):
            realtime.emit_plans_updated()
            return jsonify({'message': 'Random-Plan gelöscht!'}), 200
        return jsonify({'error': 'Fehler beim Löschen'}), 500
    except Exception as e:
        logging.error(f"Delete random plan error: {e}")
        return jsonify({'error': str(e)}), 500


def _to_minutes(time_str):
    hours, minutes = map(int, time_str.split(':'))
    return hours * 60 + minutes


def _generate_count_based(plan, german_day):
    """Generator für das anzahlbasierte Random-Format (minFeedings/maxFeedings,
    minAmount/maxAmount, timeRanges) - z. B. 'Ayla Diet Plan': 4 x 11 g."""
    count = random.randint(int(plan.get('minFeedings', 3)),
                           max(int(plan.get('minFeedings', 3)), int(plan.get('maxFeedings', 4))))
    ranges = plan.get('timeRanges') or [{
        'start': plan.get('startTime', '06:00'),
        'end': plan.get('endTime', '22:00'),
    }]

    times = []
    attempts = 0
    while len(times) < count and attempts < 500:
        attempts += 1
        time_range = random.choice(ranges)
        start = _to_minutes(time_range.get('start', '06:00'))
        end = _to_minutes(time_range.get('end', '22:00'))
        if end <= start:
            continue
        candidate = random.randint(start, end - 1)
        # Mindestens 60 Minuten Abstand zwischen Fütterungen
        if all(abs(candidate - existing) >= 60 for existing in times):
            times.append(candidate)

    if not times:
        return None, [], 'Keine Fütterungszeiten generiert'
    times.sort()
    feeding_times = [f"{t // 60:02d}:{t % 60:02d}" for t in times]

    min_amount = float(plan.get('minAmount', 10))
    max_amount = max(min_amount, float(plan.get('maxAmount', min_amount)))
    schedule = {
        german_day: [{'time': ft, 'weight': round(random.uniform(min_amount, max_amount), 1)}
                     for ft in feeding_times]
    }
    daily_weight = round(sum(f['weight'] for f in schedule[german_day]), 1)

    temp_plan = {
        'planName': f"RandomGen_{plan['planName']}_{datetime.now().strftime('%Y%m%d')}",
        'selectedDays': [german_day],
        'feedingSchedule': schedule,
        'weightMode': 'daily',
        'dailyWeight': daily_weight,
        'active': True,
        'isRandomGenerated': True,
        # Anti-Schling-Einstellung des Random-Plans an den Tagesplan vererben
        'slowFeedMinutes': plan.get('slowFeedMinutes', 0),
    }
    return temp_plan, feeding_times, None


def _generate_today_plan(plan):
    """Erzeugt aus einem Random-Plan den konkreten Tagesplan.
    Unterstützt BEIDE Formate: anzahlbasiert (minFeedings/timeRanges, Alt-Format)
    und intervallbasiert (minInterval/maxInterval, Neu-Format).
    Returns (temp_plan|None, feeding_times, error|None)."""
    german_day = DAY_TRANSLATION.get(datetime.now().strftime('%A'),
                                     datetime.now().strftime('%A'))

    if plan.get('workdaysOnly', False) and german_day not in WEEKDAYS:
        return None, [], 'weekend'
    if plan.get('selectedDays') and german_day not in plan['selectedDays']:
        return None, [], 'weekend'

    if 'minFeedings' in plan or 'timeRanges' in plan:
        return _generate_count_based(plan, german_day)

    min_interval = plan.get('minInterval', 120)
    max_interval = plan.get('maxInterval', 240)
    daily_weight = plan.get('dailyWeight', 50)
    start_time_str = plan.get('startTime', '06:00')
    end_time_str = plan.get('endTime', '22:00')
    min_pause = plan.get('minPause', 60)

    start_hour, start_min = map(int, start_time_str.split(':'))
    end_hour, end_min = map(int, end_time_str.split(':'))
    current_time = start_hour * 60 + start_min
    end_time = end_hour * 60 + end_min

    feeding_times = []
    while current_time < end_time:
        feeding_times.append(f"{current_time // 60:02d}:{current_time % 60:02d}")
        interval = random.randint(min_interval, max_interval)
        current_time += max(interval, min_pause)

    if not feeding_times:
        return None, [], 'Keine Fütterungszeiten generiert'

    weight_per_feeding = daily_weight / len(feeding_times)
    schedule = {
        german_day: [{'time': t, 'weight': weight_per_feeding} for t in feeding_times]
    }
    temp_plan = {
        'planName': f"RandomGen_{plan['planName']}_{datetime.now().strftime('%Y%m%d')}",
        'selectedDays': [german_day],
        'feedingSchedule': schedule,
        'weightMode': 'daily',
        'dailyWeight': daily_weight,
        'active': True,
        'isRandomGenerated': True,
        # Anti-Schling-Einstellung des Random-Plans an den Tagesplan vererben
        'slowFeedMinutes': plan.get('slowFeedMinutes', 0),
    }
    return temp_plan, feeding_times, None


@bp.route('/random_plan/activate', methods=['POST'])
def activate_random_plan():
    """Random-Plan aktivieren und Tageszeiten generieren."""
    try:
        data = request.get_json(silent=True)
        plan_name = (data.get('plan_name') or data.get('planName')) if data else None
        if not plan_name:
            return jsonify({'error': 'Kein Planname angegeben'}), 400

        random_plans = load_random_plans()
        plan = next((p for p in random_plans
                     if (p.get('name') or p.get('planName')) == plan_name), None)
        if not plan:
            return jsonify({'error': f'Plan "{plan_name}" nicht gefunden'}), 404

        target_days = _plan_days(plan) or set(DAY_TRANSLATION.values())
        _deactivate_overlapping(random_plans, target_days, skip_name=plan.get('planName'))
        plan['active'] = True

        feeding_plans = load_feeding_plans()
        _deactivate_overlapping(feeding_plans, target_days)
        # Alte generierte Tagespläne dieses Random-Plans entfernen (kein Duplikat
        # bei erneuter Aktivierung am selben Tag)
        today_str = datetime.now().strftime('%Y%m%d')
        feeding_plans = [p for p in feeding_plans
                         if not (p.get('isRandomGenerated', False)
                                 and plan_name in p.get('planName', '')
                                 and today_str in p.get('planName', ''))]
        save_feeding_plans(feeding_plans)
        save_random_plans(random_plans)

        temp_plan, feeding_times, error = _generate_today_plan(plan)
        if error == 'weekend':
            realtime.emit_plans_updated()
            return jsonify({'message': 'Random-Plan aktiviert (heute laut Plan keine Fütterungen)'}), 200
        if error:
            return jsonify({'error': error}), 400

        feeding_plans.append(temp_plan)
        save_feeding_plans(feeding_plans)
        realtime.emit_plans_updated()
        _schedule_status_update()

        return jsonify({
            'message': 'Random-Plan aktiviert und Zeiten generiert!',
            'feedingTimes': feeding_times,
            'count': len(feeding_times),
        }), 200
    except Exception as e:
        logging.error(f"Activate random plan error: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/random_plan/generate_now', methods=['POST'])
def generate_random_now():
    """Neue Random-Zeiten für den aktiven Random-Plan generieren."""
    try:
        random_plans = load_random_plans()
        active_plan = next((p for p in random_plans if p.get('active', False)), None)
        if not active_plan:
            return jsonify({'error': 'Kein aktiver Random-Plan gefunden'}), 404

        temp_plan, feeding_times, error = _generate_today_plan(active_plan)
        if error == 'weekend':
            return jsonify({'error': 'Heute ist Wochenende - keine Fütterungen im Wochentags-Modus'}), 400
        if error:
            return jsonify({'error': error}), 400

        # Alte Random-generierte Pläne für heute entfernen
        feeding_plans = load_feeding_plans()
        today_str = datetime.now().strftime('%Y%m%d')
        feeding_plans = [p for p in feeding_plans
                         if not (p.get('isRandomGenerated', False) and today_str in p.get('planName', ''))]
        feeding_plans.append(temp_plan)
        save_feeding_plans(feeding_plans)
        realtime.emit_plans_updated()
        _schedule_status_update()

        return jsonify({
            'message': 'Neue Random-Zeiten generiert!',
            'feedingTimes': feeding_times,
            'count': len(feeding_times),
        }), 200
    except Exception as e:
        logging.error(f"Generate random now error: {e}")
        return jsonify({'error': str(e)}), 500
