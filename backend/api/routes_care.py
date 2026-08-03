"""Pflege & Erinnerungen: Frische, Reinigung, Gesundheitstermine, Tierarzt-Bericht."""
import logging
from datetime import date, datetime

from flask import Blueprint, Response, jsonify, request

from services import care_service

bp = Blueprint("care", __name__)


@bp.route("/care/freshness")
def freshness():
    return jsonify(care_service.get_freshness())


@bp.route("/care/cleaned", methods=["POST"])
def cleaned():
    data = request.get_json(silent=True) or {}
    if not care_service.mark_cleaned(data.get("what")):
        return jsonify({"error": "what muss 'bowl' oder 'tank' sein"}), 400
    return jsonify({"success": True, **care_service.get_freshness()})


@bp.route("/care/reminders")
def reminders():
    return jsonify(care_service.list_reminders())


@bp.route("/care/reminders", methods=["POST"])
def add_reminder():
    data = request.get_json(silent=True) or {}
    ok, result = care_service.add_reminder(
        data.get("title"), data.get("interval_days"),
        data.get("next_due"), data.get("cat", ""))
    if not ok:
        return jsonify({"error": result}), 400
    return jsonify({"success": True, "reminder": result}), 201


@bp.route("/care/reminders/<reminder_id>/done", methods=["POST"])
def reminder_done(reminder_id):
    if not care_service.mark_reminder_done(reminder_id):
        return jsonify({"error": "Erinnerung nicht gefunden"}), 404
    return jsonify({"success": True})


@bp.route("/care/reminders/<reminder_id>", methods=["DELETE"])
def delete_reminder(reminder_id):
    if not care_service.delete_reminder(reminder_id):
        return jsonify({"error": "Erinnerung nicht gefunden"}), 404
    return jsonify({"success": True})


@bp.route("/care/report")
def vet_report():
    """Druckfertiger Gesundheitsbericht (HTML) für den Tierarztbesuch."""
    try:
        from services import eating_tracker, event_log, health_monitor
        from services.consumption_manager import consumption_manager

        # Pro-Katze-Auswertung aus den Fress-Episoden (Label vor Auto-Label) -
        # "welche Katze frisst weniger?" ist beim Tierarzt die Kernfrage
        episodes = eating_tracker.list_episodes(30)
        by_cat = {}
        unknown_g = 0.0
        total_g = 0.0
        for ep in episodes:
            grams = ep.get("consumed", 0) or 0
            total_g += grams
            cat = ep.get("label") or ep.get("auto_label")
            if not cat:
                unknown_g += grams
                continue
            bucket = by_cat.setdefault(cat, {"g": 0.0, "meals": 0, "dur": 0.0, "rate": 0.0})
            bucket["g"] += grams
            bucket["meals"] += 1
            bucket["dur"] += ep.get("duration_s", 0) or 0
            bucket["rate"] += ep.get("rate", 0) or 0
        cat_rows = "".join(
            f"<tr><td>{name}</td><td class='v'>{b['g']:.0f} g</td>"
            f"<td class='v'>{b['meals']}</td>"
            f"<td class='v'>{b['dur'] / max(1, b['meals']) / 60:.1f} min</td>"
            f"<td class='v'>{b['rate'] / max(1, b['meals']):.1f} g/min</td></tr>"
            for name, b in sorted(by_cat.items()))
        unknown_share = (unknown_g / total_g * 100) if total_g > 0 else 0

        daily = consumption_manager.get_daily(30)
        stats = consumption_manager.get_stats()
        health = health_monitor.get_stats()
        appetite = health.get("appetite") or {}
        fresh = care_service.get_freshness()
        health_events = [e for e in event_log.get_events(30)
                         if e.get("type") in ("health", "feeding_failed")][:20]

        def row(label, value):
            return f"<tr><td>{label}</td><td class='v'>{value}</td></tr>"

        days_rows = "".join(
            f"<tr><td>{d['date']}</td><td class='v'>{d['total']:.1f} g</td>"
            f"<td class='v'>{d['feedings']}</td></tr>"
            for d in reversed(daily)
        )
        event_rows = "".join(
            f"<tr><td>{e['ts'][:16].replace('T', ' ')}</td><td>{e['detail']}</td></tr>"
            for e in health_events
        ) or "<tr><td colspan='2'>Keine Auffälligkeiten</td></tr>"

        appetite_label = {"ok": "unauffällig", "low": "RÜCKGANG (beobachten!)",
                          "high": "Heisshunger (beobachten!)"}.get(appetite.get("state"), "–")

        html = f"""<meta charset="utf-8">
<title>CatBoter Gesundheitsbericht</title>
<style>
 body {{ font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto 2rem; padding: 0 1rem; color: #111; }}
 h1 {{ font-size: 1.4rem; }} h2 {{ font-size: 1.05rem; margin-top: 1.6rem; }}
 table {{ border-collapse: collapse; width: 100%; font-size: 0.9rem; }}
 td, th {{ border-bottom: 1px solid #ddd; padding: 0.35rem 0.5rem; text-align: left; }}
 td.v {{ text-align: right; font-variant-numeric: tabular-nums; }}
 .muted {{ color: #666; font-size: 0.85rem; }}
 .bar {{ position: sticky; top: 0; background: #fff; display: flex; gap: 0.5rem;
        padding: 0.75rem 0; border-bottom: 1px solid #ddd; margin-bottom: 1rem; }}
 .bar button {{ font: inherit; padding: 0.55rem 1rem; border-radius: 8px;
        border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; min-height: 44px; }}
 .bar button.p {{ background: #0e7490; color: #fff; border-color: #0e7490; }}
 @media print {{ body {{ margin: 0.5rem; }} .bar {{ display: none; }} }}
</style>
<div class="bar">
  <button onclick="if(history.length>1){{history.back()}}else{{location.href='/'}}">← Zurück zur App</button>
  <button class="p" onclick="window.print()">Drucken / PDF</button>
</div>
<h1>CatBoter – Gesundheitsbericht</h1>
<p class="muted">Erstellt am {datetime.now().strftime('%d.%m.%Y %H:%M')} ·
Zeitraum: letzte 30 Tage · Hinweis: Werte umfassen ALLE Katzen des Haushalts gemeinsam.</p>

<h2>Zusammenfassung</h2>
<table>
{row('Ø Tagesmenge (30 Tage)', f"{stats.get('avg_daily', 0):.1f} g")}
{row('Ø Tagesmenge (7 Tage)', f"{stats.get('avg_weekly', 0):.1f} g")}
{row('Fütterungen (30 Tage)', stats.get('total_feedings', 0))}
{row('Appetit-Trend', appetite_label)}
{row('Ø Fresszeit', f"{health.get('avg_minutes')} min" if health.get('avg_minutes') else '–')}
{row('Futter-Alter im Tank', f"{fresh.get('food_age_days')} Tage" if fresh.get('food_age_days') is not None else '–')}
</table>

<h2>Pro Katze (30 Tage, Waagen-Erkennung)</h2>
<table><tr><th>Katze</th><th class='v'>Gesamt</th><th class='v'>Mahlzeiten</th><th class='v'>Ø Dauer</th><th class='v'>Ø Tempo</th></tr>
{cat_rows or "<tr><td colspan='5'>Noch keine zugeordneten Fress-Episoden</td></tr>"}</table>
<p class="muted">Nicht zuordenbare Fressmenge: {unknown_share:.0f} % - die Erkennung arbeitet
über die Fress-Signatur der Waage und ist ein Richtwert.</p>

<h2>Tagesmengen</h2>
<table><tr><th>Datum</th><th class='v'>Menge</th><th class='v'>Fütterungen</th></tr>
{days_rows or "<tr><td colspan='3'>Noch keine Daten</td></tr>"}</table>

<h2>Gesundheits-Ereignisse</h2>
<table>{event_rows}</table>

<p class="muted">Automatisch erstellt von CatBoter V3 (iotueli). Kein Ersatz für eine
tierärztliche Untersuchung.</p>"""
        return Response(html, mimetype="text/html; charset=utf-8")
    except Exception as e:
        logging.error(f"Report error: {e}")
        return jsonify({"error": str(e)}), 500
