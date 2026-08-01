"""Fress-Episoden (Katzen-Signatur) und Diät-Status."""
import logging

from flask import Blueprint, jsonify, request

from services import diet_service, eating_tracker

bp = Blueprint("eating", __name__)


@bp.route("/eating/episodes")
def episodes():
    """Episoden der letzten Tage + Klassifikator-Status + heutige Mengen je Katze."""
    try:
        days = min(max(int(request.args.get("days", 7)), 1), 30)
    except ValueError:
        days = 7
    return jsonify({
        "episodes": eating_tracker.list_episodes(days),
        "classifier": eating_tracker.classifier_status(),
        "per_cat_today": eating_tracker.per_cat_today(),
    })


@bp.route("/eating/episodes/<episode_id>/label", methods=["POST"])
def label_episode(episode_id):
    """Episode einer Katze zuordnen (label: Name oder null = unbekannt)."""
    data = request.get_json(silent=True) or {}
    label = data.get("label")
    if label is not None:
        label = str(label).strip()[:30]
        if not label:
            label = None
    if not eating_tracker.set_label(episode_id, label):
        return jsonify({"error": "Episode nicht gefunden"}), 404
    return jsonify({"success": True, "classifier": eating_tracker.classifier_status()})


@bp.route("/diet/status")
def diet_status():
    try:
        return jsonify(diet_service.get_status())
    except Exception as e:
        logging.error(f"Diät-Status Fehler: {e}")
        return jsonify({"error": str(e)}), 500
