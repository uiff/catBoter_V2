"""App-Einstellungen (app_settings.json) - EINE Lese-/Schreibstelle fürs Backend.

Wird von Routen UND Logik (Scheduler, Feeding) genutzt; kleiner TTL-Cache,
damit der 60-s-Scheduler nicht bei jedem Tick von der SD-Karte liest.
"""
import json
import logging
import os
import threading
import time

from core.config import APP_SETTINGS_FILE, APP_SETTINGS_DEFAULTS, DATA_DIR

_lock = threading.Lock()
_cache = {"data": None, "ts": 0.0}
_TTL = 5.0


def get_settings() -> dict:
    """Aktuelle Einstellungen (Defaults + Datei), kurz gecacht."""
    with _lock:
        if _cache["data"] is not None and time.time() - _cache["ts"] < _TTL:
            return dict(_cache["data"])
        settings = dict(APP_SETTINGS_DEFAULTS)
        try:
            if APP_SETTINGS_FILE.exists():
                with open(APP_SETTINGS_FILE) as f:
                    settings.update(json.load(f))
        except (json.JSONDecodeError, OSError) as e:
            logging.warning(f"app_settings.json unlesbar: {e}")
        _cache["data"] = dict(settings)
        _cache["ts"] = time.time()
        return settings


def update_settings(changes: dict) -> dict:
    """Merged Änderungen und speichert atomar. Returns neuen Stand."""
    with _lock:
        settings = dict(APP_SETTINGS_DEFAULTS)
        try:
            if APP_SETTINGS_FILE.exists():
                with open(APP_SETTINGS_FILE) as f:
                    settings.update(json.load(f))
        except (json.JSONDecodeError, OSError):
            pass
        settings.update(changes)

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = APP_SETTINGS_FILE.with_suffix(APP_SETTINGS_FILE.suffix + ".tmp")
        with open(tmp, "w") as f:
            json.dump(settings, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, APP_SETTINGS_FILE)

        _cache["data"] = dict(settings)
        _cache["ts"] = time.time()
        return settings
