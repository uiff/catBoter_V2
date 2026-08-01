"""Ereignis-Log: JSONL-Datei mit fester Retention (Speicher-Budget!).

Jede Zeile: {"ts": ISO, "type": str, "detail": str, "grams": float|None}
Rotation: beim Start werden Einträge älter als RETENTION_DAYS entfernt.
"""
import json
import logging
import os
import threading
from datetime import datetime, timedelta

from core.config import DATA_DIR

EVENTS_FILE = DATA_DIR / "events.jsonl"
RETENTION_DAYS = 90

_lock = threading.Lock()


def log_event(event_type: str, detail: str = "", grams=None):
    """Hängt ein Ereignis an (atomar genug: einzeilige Appends)."""
    entry = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "type": event_type,
        "detail": detail,
    }
    if grams is not None:
        entry["grams"] = round(float(grams), 1)
    try:
        with _lock:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            with open(EVENTS_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as e:
        logging.warning(f"Event-Log: Schreiben fehlgeschlagen: {e}")


def get_events(days: int = 7):
    """Ereignisse der letzten N Tage, neueste zuerst."""
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    events = []
    try:
        with _lock:
            if not EVENTS_FILE.exists():
                return []
            with open(EVENTS_FILE, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if entry.get("ts", "") >= cutoff:
                        events.append(entry)
    except OSError as e:
        logging.warning(f"Event-Log: Lesen fehlgeschlagen: {e}")
    events.reverse()
    return events


def compact():
    """Entfernt Einträge älter als RETENTION_DAYS (beim Backend-Start)."""
    cutoff = (datetime.now() - timedelta(days=RETENTION_DAYS)).isoformat()
    try:
        with _lock:
            if not EVENTS_FILE.exists():
                return
            kept = []
            with open(EVENTS_FILE, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        if json.loads(line).get("ts", "") >= cutoff:
                            kept.append(line)
                    except json.JSONDecodeError:
                        continue
            tmp = EVENTS_FILE.with_suffix(".jsonl.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                f.write("\n".join(kept) + ("\n" if kept else ""))
            os.replace(tmp, EVENTS_FILE)
    except OSError as e:
        logging.warning(f"Event-Log: Kompaktierung fehlgeschlagen: {e}")
