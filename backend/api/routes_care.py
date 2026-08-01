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
        from services import event_log, health_monitor
        from services.consumption_manager import consumption_manager

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
 body {{ font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; color: #111; }}
 h1 {{ font-size: 1.4rem; }} h2 {{ font-size: 1.05rem; margin-top: 1.6rem; }}
 table {{ border-collapse: collapse; width: 100%; font-size: 0.9rem; }}
 td, th {{ border-bottom: 1px solid #ddd; padding: 0.35rem 0.5rem; text-align: left; }}
 td.v {{ text-align: right; font-variant-numeric: tabular-nums; }}
 .muted {{ color: #666; font-size: 0.85rem; }}
 @media print {{ body {{ margin: 0.5rem; }} }}
</style>
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

<h2>Tagesmengen</h2>
<table><tr><th>Datum</th><th class='v'>Menge</th><th class='v'>Fütterungen</th></tr>
{days_rows or "<tr><td colspan='3'>Noch keine Daten</td></tr>"}</table>

<h2>Gesundheits-Ereignisse</h2>
<table>{event_rows}</table>

<p class="muted">Automatisch erstellt von CatBoter V3 (iotueli). Kein Ersatz für eine
tierärztliche Untersuchung.</p>
<script>window.print &amp;&amp; setTimeout(() => window.print(), 300)</script>"""
        return Response(html, mimetype="text/html; charset=utf-8")
    except Exception as e:
        logging.error(f"Report error: {e}")
        return jsonify({"error": str(e)}), 500
