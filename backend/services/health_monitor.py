"""Gesundheits-Monitor: Fressverhalten aus der 5-s-Gewichtskurve.

- Fressgeschwindigkeit: nach jeder Fütterung wird gemessen, wie lange es
  dauert, bis der Napf (fast) leer ist.
- Unberührt-Warnung: liegt Futter im Napf und das Gewicht sinkt über die
  konfigurierte Zeit nicht, gibt es Event + Push (frühes Krankheitssignal).

Alles in-memory + eine kleine, gedeckelte Statistikdatei (Speicher-Budget).
"""
import json
import logging
import os
import threading
import time
from datetime import datetime

from core.config import DATA_DIR

STATS_FILE = DATA_DIR / "health_stats.json"
MAX_ENTRIES = 60
EATING_DONE_THRESHOLD_G = 1.0
EATING_WATCH_TIMEOUT_S = 2 * 3600
MIN_DECREASE_G = 0.5
MIN_BOWL_FOR_ALERT_G = 2.0

_lock = threading.Lock()
_state = {
    "last_weight": None,
    "last_decrease_ts": time.time(),
    "untouched_alerted": False,
    # Fress-Beobachtung nach einer Fütterung
    "watch_start_ts": None,
    "watch_start_weight": None,
}


def _load_stats():
    try:
        if STATS_FILE.exists():
            with open(STATS_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError):
        pass
    return []


def _save_stats(stats):
    try:
        tmp = STATS_FILE.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(stats[-MAX_ENTRIES:], f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, STATS_FILE)
    except OSError as e:
        logging.warning(f"Health-Stats speichern fehlgeschlagen: {e}")


def on_feeding_completed(fed_grams: float):
    """Nach erfolgreicher Fütterung: Fresszeit-Beobachtung starten."""
    if fed_grams <= 0:
        return
    with _lock:
        _state["watch_start_ts"] = time.time()
        _state["watch_start_weight"] = None  # wird beim nächsten Sample gesetzt


def sample(weight, untouched_alert_hours: float):
    """Vom 5-s-Polling-Loop aufgerufen. Returns optionalen Alert-Text."""
    if weight is None:
        return None
    now = time.time()
    alert = None

    with _lock:
        last = _state["last_weight"]
        if last is not None and last - weight >= MIN_DECREASE_G:
            _state["last_decrease_ts"] = now
            _state["untouched_alerted"] = False
        _state["last_weight"] = weight

        # Fresszeit-Beobachtung
        if _state["watch_start_ts"] is not None:
            if _state["watch_start_weight"] is None:
                _state["watch_start_weight"] = weight
            elapsed = now - _state["watch_start_ts"]
            if weight <= EATING_DONE_THRESHOLD_G and elapsed > 30:
                minutes = round(elapsed / 60, 1)
                stats = _load_stats()
                stats.append({"ts": datetime.now().isoformat(timespec="seconds"),
                              "minutes": minutes,
                              "start_weight": round(_state["watch_start_weight"] or 0, 1)})
                _save_stats(stats)
                _state["watch_start_ts"] = None
                try:
                    from services import event_log
                    event_log.log_event("health", f"Napf in {minutes:g} min leergefressen")
                except Exception:
                    pass
            elif elapsed > EATING_WATCH_TIMEOUT_S:
                _state["watch_start_ts"] = None

        # Unberührt-Warnung
        if (untouched_alert_hours and untouched_alert_hours > 0
                and weight >= MIN_BOWL_FOR_ALERT_G
                and not _state["untouched_alerted"]):
            untouched_s = now - _state["last_decrease_ts"]
            if untouched_s >= untouched_alert_hours * 3600:
                hours = round(untouched_s / 3600, 1)
                alert = (f"Napf seit {hours:g} Stunden unberührt "
                         f"({weight:.1f} g Futter liegen bereit)")
                _state["untouched_alerted"] = True

    if alert:
        try:
            from services import event_log
            event_log.log_event("health", alert)
        except Exception:
            pass
        try:
            from services import push_service
            push_service.notify("CatBoter - Gesundheit", alert, tag="health")
        except Exception as e:
            logging.debug(f"Health-Push fehlgeschlagen: {e}")
    return alert


def get_stats() -> dict:
    """Für die Statistik-Karte: letzte Fresszeiten + aktueller Unberührt-Stand."""
    with _lock:
        untouched_h = round((time.time() - _state["last_decrease_ts"]) / 3600, 1)
        bowl = _state["last_weight"]
    entries = _load_stats()[-10:]
    minutes = [e["minutes"] for e in entries]
    return {
        "recent": list(reversed(entries)),
        "avg_minutes": round(sum(minutes) / len(minutes), 1) if minutes else None,
        "untouched_hours": untouched_h,
        "bowl_weight": bowl,
    }
