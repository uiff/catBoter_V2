"""Gewichts-Tagebuch der Katzen (manuell gewogen).

Je Katze eine Liste {date, kg}. Ein neuer Eintrag am selben Tag ersetzt den
alten (zweimal wiegen = korrigieren). Beim Eintragen wird das Profilgewicht
in den Katzenprofilen mitgezogen - der Kalorienrechner bleibt so aktuell.
"""
import logging
import threading
from datetime import date

from core.config import DATA_DIR
from core.files import atomic_write_json

WEIGHTS_FILE = DATA_DIR / "cat_weights.json"
MAX_ENTRIES_PER_CAT = 200
MIN_KG, MAX_KG = 0.5, 20.0

_lock = threading.Lock()


def _load():
    import json
    try:
        if WEIGHTS_FILE.exists():
            with open(WEIGHTS_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logging.warning(f"Gewichts-Tagebuch unlesbar: {e}")
    return {}


def get_all():
    with _lock:
        return _load()


def add_entry(cat, kg, day=None):
    """Returns (ok, fehler|einträge)."""
    cat = str(cat or "").strip()
    if not cat:
        return False, "Keine Katze angegeben"
    try:
        kg = round(float(kg), 2)
    except (TypeError, ValueError):
        return False, "Ungültiges Gewicht"
    if not (MIN_KG <= kg <= MAX_KG):
        return False, f"Gewicht muss zwischen {MIN_KG:g} und {MAX_KG:g} kg liegen"
    day = str(day or date.today().isoformat())

    with _lock:
        data = _load()
        entries = [e for e in data.get(cat, []) if e.get("date") != day]
        entries.append({"date": day, "kg": kg})
        entries.sort(key=lambda e: e["date"])
        data[cat] = entries[-MAX_ENTRIES_PER_CAT:]
        atomic_write_json(WEIGHTS_FILE, data)

    _sync_profile_weight(cat, kg)
    return True, data[cat]


def delete_entry(cat, day):
    with _lock:
        data = _load()
        entries = data.get(cat, [])
        remaining = [e for e in entries if e.get("date") != day]
        if len(remaining) == len(entries):
            return False
        data[cat] = remaining
        atomic_write_json(WEIGHTS_FILE, data)
    return True


def _sync_profile_weight(cat, kg):
    """Profilgewicht mitziehen (Kalorienrechner) - best effort."""
    try:
        from services import settings_service
        profiles = settings_service.get_settings().get("cat_profiles") or {}
        cats = profiles.get("cats") or []
        changed = False
        for entry in cats:
            if entry.get("name") == cat:
                entry["weight_kg"] = kg
                changed = True
        if changed:
            settings_service.update_settings({"cat_profiles": profiles})
    except Exception as e:
        logging.warning(f"Profilgewicht-Sync fehlgeschlagen: {e}")
