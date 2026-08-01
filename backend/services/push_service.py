"""Web-Push-Benachrichtigungen direkt vom Pi (VAPID, ohne Cloud-Dienst).

Voraussetzung: der Pi hat Internet (die Push-Zustellung läuft über die
Push-Dienste der Browser-Hersteller). Subscriptions liegen im Daten-Volume;
tote Endpoints (404/410) werden automatisch entfernt.
"""
import base64
import json
import logging
import os
import threading

from core.config import DATA_DIR

VAPID_PEM = DATA_DIR / "vapid_private.pem"
SUBSCRIPTIONS_FILE = DATA_DIR / "push_subscriptions.json"
VAPID_CLAIMS = {"sub": "mailto:catboter@iotueli.ch"}

_lock = threading.Lock()


def _ensure_vapid():
    from py_vapid import Vapid
    if not VAPID_PEM.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        vapid = Vapid()
        vapid.generate_keys()
        vapid.save_key(str(VAPID_PEM))
        logging.info("Push: VAPID-Schlüsselpaar erzeugt")
    return Vapid.from_file(str(VAPID_PEM))


def get_public_key() -> str:
    """applicationServerKey (base64url, ohne Padding) für pushManager.subscribe."""
    from cryptography.hazmat.primitives import serialization
    vapid = _ensure_vapid()
    raw = vapid.public_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _load_subscriptions():
    try:
        if SUBSCRIPTIONS_FILE.exists():
            with open(SUBSCRIPTIONS_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError):
        pass
    return []


def _save_subscriptions(subs):
    tmp = SUBSCRIPTIONS_FILE.with_suffix(".json.tmp")
    with open(tmp, "w") as f:
        json.dump(subs, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, SUBSCRIPTIONS_FILE)


def add_subscription(subscription: dict):
    endpoint = (subscription or {}).get("endpoint")
    if not endpoint or "keys" not in subscription:
        return False
    with _lock:
        subs = [s for s in _load_subscriptions() if s.get("endpoint") != endpoint]
        subs.append(subscription)
        _save_subscriptions(subs)
    logging.info(f"Push: Subscription registriert ({len(subs)} gesamt)")
    return True


def remove_subscription(endpoint: str):
    with _lock:
        subs = [s for s in _load_subscriptions() if s.get("endpoint") != endpoint]
        _save_subscriptions(subs)
    return True


def subscription_count() -> int:
    return len(_load_subscriptions())


def notify(title: str, body: str, tag: str = "catboter"):
    """Feuert Notifications asynchron ab (blockiert den Aufrufer nicht -
    wichtig, weil Aufrufe aus dem 5-s-Sensor-Loop kommen)."""
    try:
        import eventlet
        eventlet.spawn_n(notify_sync, title, body, tag)
    except ImportError:
        notify_sync(title, body, tag)


def notify_sync(title: str, body: str, tag: str = "catboter"):
    """Sendet eine Notification an alle Subscriptions (best-effort, blockierend)."""
    from pywebpush import webpush, WebPushException

    with _lock:
        subs = _load_subscriptions()
    if not subs:
        return 0

    _ensure_vapid()
    payload = json.dumps({"title": title, "body": body, "tag": tag})
    delivered = 0
    dead = []
    for sub in subs:
        try:
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=str(VAPID_PEM),
                vapid_claims=dict(VAPID_CLAIMS),
                timeout=10,
            )
            delivered += 1
        except WebPushException as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (404, 410):
                dead.append(sub.get("endpoint"))
            else:
                logging.warning(f"Push fehlgeschlagen: {e}")
        except Exception as e:
            logging.warning(f"Push-Fehler: {e}")

    if dead:
        with _lock:
            subs = [s for s in _load_subscriptions() if s.get("endpoint") not in dead]
            _save_subscriptions(subs)
        logging.info(f"Push: {len(dead)} tote Subscriptions entfernt")

    return delivered
