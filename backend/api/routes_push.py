"""Web-Push: Schlüssel, Subscriptions, Test."""
import logging

from flask import Blueprint, jsonify, request

from services import push_service

bp = Blueprint("push", __name__)


@bp.route("/push/public_key")
def public_key():
    try:
        return jsonify({"public_key": push_service.get_public_key(),
                        "subscriptions": push_service.subscription_count()})
    except Exception as e:
        logging.error(f"Push public_key error: {e}")
        return jsonify({"error": "Push nicht verfügbar"}), 500


@bp.route("/push/subscribe", methods=["POST"])
def subscribe():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not push_service.add_subscription(data):
        return jsonify({"error": "Ungültige Subscription"}), 400
    return jsonify({"success": True})


@bp.route("/push/unsubscribe", methods=["POST"])
def unsubscribe():
    data = request.get_json(silent=True) or {}
    endpoint = data.get("endpoint")
    if not endpoint:
        return jsonify({"error": "endpoint fehlt"}), 400
    push_service.remove_subscription(endpoint)
    return jsonify({"success": True})


@bp.route("/push/test", methods=["POST"])
def test():
    # Synchron senden, damit die Antwort die Zustellzahl enthält
    delivered = push_service.notify_sync("CatBoter",
                                         "Test-Benachrichtigung - Push funktioniert!",
                                         tag="test")
    if delivered == 0:
        return jsonify({"error": "Keine aktiven Subscriptions"}), 400
    return jsonify({"success": True, "delivered": delivered})
