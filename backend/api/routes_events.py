"""Ereignis-Verlauf: JSON-Abfrage und CSV-Export (fürs Tierarztgespräch)."""
import csv
import io

from flask import Blueprint, Response, jsonify, request

from services import event_log

bp = Blueprint("events", __name__)

TYPE_LABELS = {
    "feeding_completed": "Fütterung",
    "feeding_failed": "Fütterung fehlgeschlagen",
    "feeding_skipped": "Fütterung übersprungen",
    "backend_start": "Backend gestartet",
    "plan_changed": "Plan geändert",
    "pause": "Pause",
    "health": "Gesundheit",
    "tank": "Tank",
    "hand_feed": "Von Hand gefüttert",
    "diet": "Diät-Modus",
    "diet_clamp": "Diät: Dosis gekappt",
    "diet_skipped": "Diät: übersprungen",
    "jit_gate": "Pro-Katze: Dosierung pausiert",
    "jit_withheld": "Pro-Katze: zurückgehalten",
}


@bp.route("/events")
def get_events():
    try:
        days = min(max(int(request.args.get("days", 7)), 1), 90)
    except ValueError:
        days = 7
    return jsonify(event_log.get_events(days))


@bp.route("/events/export.csv")
def export_events_csv():
    try:
        days = min(max(int(request.args.get("days", 30)), 1), 90)
    except ValueError:
        days = 30

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(["Zeitpunkt", "Ereignis", "Details", "Gramm"])
    for entry in reversed(event_log.get_events(days)):  # chronologisch
        writer.writerow([
            entry.get("ts", ""),
            TYPE_LABELS.get(entry.get("type", ""), entry.get("type", "")),
            entry.get("detail", ""),
            entry.get("grams", ""),
        ])

    return Response(
        # BOM, damit Excel Umlaute korrekt öffnet
        "﻿" + buffer.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=catboter-verlauf.csv"},
    )
