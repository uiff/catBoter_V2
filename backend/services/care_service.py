"""Pflege & Erinnerungen: Futter-Frische, Reinigungs-Daten, Gesundheitstermine.

- Frische: Auffüllungen werden aus dem Tank-Füllstand erkannt (Anstieg >5 %),
  daraus ergibt sich das Alter des Futters im Tank.
- Reinigung: Nutzer bestätigt "Napf/Tank gereinigt" in der App.
- Erinnerungen: wiederkehrende Termine (Entwurmung, Medikamente) je Katze,
  täglicher Fälligkeits-Check mit Push.

Alles in zwei kleinen, gedeckelten JSON-Dateien (Speicher-Budget).
"""
import json
import logging
import os
import threading
import uuid
from datetime import date, timedelta

from core.config import DATA_DIR

FRESHNESS_FILE = DATA_DIR / "freshness.json"
REMINDERS_FILE = DATA_DIR / "reminders.json"
MAX_REMINDERS = 20
FOOD_AGE_WARN_DAYS = 21
BOWL_CLEAN_WARN_DAYS = 3
TANK_CLEAN_WARN_DAYS = 30

_lock = threading.Lock()


def _load(path, default):
    try:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError):
        pass
    return default


def _save(path, data):
    try:
        tmp = path.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except OSError as e:
        logging.warning(f"{path.name} speichern fehlgeschlagen: {e}")


# ---------- Frische / Hygiene ----------

def _default_freshness():
    return {"last_refill": None, "last_bowl_clean": None, "last_tank_clean": None}


def note_refill(refill_date=None):
    """Vom Tank-Snapshot aufgerufen, wenn eine Auffüllung erkannt wurde."""
    with _lock:
        freshness = _load(FRESHNESS_FILE, _default_freshness())
        freshness["last_refill"] = (refill_date or date.today()).isoformat()
        _save(FRESHNESS_FILE, freshness)
    try:
        from services import event_log
        event_log.log_event("tank", "Auffüllung erkannt")
    except Exception:
        pass


def mark_cleaned(what: str):
    """'bowl' oder 'tank' als gereinigt markieren."""
    key = {"bowl": "last_bowl_clean", "tank": "last_tank_clean"}.get(what)
    if key is None:
        return False
    with _lock:
        freshness = _load(FRESHNESS_FILE, _default_freshness())
        freshness[key] = date.today().isoformat()
        _save(FRESHNESS_FILE, freshness)
    return True


def _days_since(iso_date):
    if not iso_date:
        return None
    try:
        return (date.today() - date.fromisoformat(iso_date)).days
    except ValueError:
        return None


def get_freshness() -> dict:
    freshness = _load(FRESHNESS_FILE, _default_freshness())
    food_age = _days_since(freshness.get("last_refill"))
    bowl_age = _days_since(freshness.get("last_bowl_clean"))
    tank_age = _days_since(freshness.get("last_tank_clean"))
    return {
        "food_age_days": food_age,
        "food_stale": food_age is not None and food_age >= FOOD_AGE_WARN_DAYS,
        "bowl_clean_days": bowl_age,
        "bowl_due": bowl_age is None or bowl_age >= BOWL_CLEAN_WARN_DAYS,
        "tank_clean_days": tank_age,
        "tank_due": tank_age is None or tank_age >= TANK_CLEAN_WARN_DAYS,
    }


# ---------- Erinnerungen ----------

def list_reminders():
    return _load(REMINDERS_FILE, [])


def add_reminder(title: str, interval_days: int, next_due: str, cat: str = ""):
    """Returns (ok, error|reminder)."""
    title = str(title or "").strip()[:60]
    if not title:
        return False, "Titel fehlt"
    try:
        interval_days = int(interval_days)
    except (TypeError, ValueError):
        return False, "Ungültiges Intervall"
    if not (1 <= interval_days <= 730):
        return False, "Intervall muss zwischen 1 und 730 Tagen liegen"
    try:
        due = date.fromisoformat(str(next_due))
    except ValueError:
        return False, "Ungültiges Fälligkeitsdatum"

    with _lock:
        reminders = _load(REMINDERS_FILE, [])
        if len(reminders) >= MAX_REMINDERS:
            return False, f"Maximal {MAX_REMINDERS} Erinnerungen"
        reminder = {
            "id": uuid.uuid4().hex[:8],
            "title": title,
            "cat": str(cat or "").strip()[:30],
            "interval_days": interval_days,
            "next_due": due.isoformat(),
            "last_done": None,
        }
        reminders.append(reminder)
        _save(REMINDERS_FILE, reminders)
    return True, reminder


def mark_reminder_done(reminder_id: str):
    """Erledigt: nächste Fälligkeit = heute + Intervall. Returns ok."""
    with _lock:
        reminders = _load(REMINDERS_FILE, [])
        for reminder in reminders:
            if reminder.get("id") == reminder_id:
                reminder["last_done"] = date.today().isoformat()
                reminder["next_due"] = (
                    date.today() + timedelta(days=reminder.get("interval_days", 30))
                ).isoformat()
                _save(REMINDERS_FILE, reminders)
                try:
                    from services import event_log
                    event_log.log_event("health", f"Erledigt: {reminder['title']}"
                                        + (f" ({reminder['cat']})" if reminder.get('cat') else ""))
                except Exception:
                    pass
                return True
    return False


def delete_reminder(reminder_id: str):
    with _lock:
        reminders = _load(REMINDERS_FILE, [])
        remaining = [r for r in reminders if r.get("id") != reminder_id]
        if len(remaining) == len(reminders):
            return False
        _save(REMINDERS_FILE, remaining)
    return True


def check_reminders_daily():
    """1x täglich: fällige Erinnerungen pushen (einmal pro Fälligkeitstag)."""
    today = date.today().isoformat()
    with _lock:
        reminders = _load(REMINDERS_FILE, [])
        due = [r for r in reminders
               if r.get("next_due") and r["next_due"] <= today
               and r.get("last_notified") != today]
        for reminder in due:
            reminder["last_notified"] = today
        if due:
            _save(REMINDERS_FILE, reminders)

    for reminder in due:
        label = reminder["title"] + (f" ({reminder['cat']})" if reminder.get("cat") else "")
        try:
            from services import push_service
            push_service.notify("CatBoter - Erinnerung", f"{label} ist fällig", tag="reminder")
        except Exception as e:
            logging.debug(f"Erinnerungs-Push fehlgeschlagen: {e}")
        try:
            from services import event_log
            event_log.log_event("health", f"Erinnerung fällig: {label}")
        except Exception:
            pass
