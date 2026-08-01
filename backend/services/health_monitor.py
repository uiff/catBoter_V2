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


APPETITE_FILE = DATA_DIR / "appetite_stats.json"
APPETITE_LOW_FACTOR = 0.70   # <= 70 % des Üblichen = zu wenig
APPETITE_HIGH_FACTOR = 1.40  # >= 140 % = Heisshunger
APPETITE_MIN_BASELINE = 15.0  # erst warnen, wenn genug Datenbasis (g/Tag)
APPETITE_STREAK = 2          # Tage in Folge bis zur Warnung


def _load_appetite():
    try:
        if APPETITE_FILE.exists():
            with open(APPETITE_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError):
        pass
    return {"streak_low": 0, "streak_high": 0, "last_checked": None,
            "baseline": None, "yesterday": None, "state": "ok"}


def _save_appetite(state):
    try:
        tmp = APPETITE_FILE.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(state, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, APPETITE_FILE)
    except OSError as e:
        logging.warning(f"Appetit-Statistik speichern fehlgeschlagen: {e}")


def check_appetite_daily():
    """1x täglich (nach Datumswechsel): Gestern gegen den 7-Tage-Schnitt prüfen.

    Anhaltender Rückgang ist bei Katzen DAS Frühwarnsignal (Niere, Zähne,
    Schmerz); anhaltender Heisshunger bei Senioren deutet auf Schilddrüse/
    Diabetes. Achtung: bei zwei Katzen misst das den GESAMT-Appetit.
    """
    from datetime import date, timedelta
    state = _load_appetite()
    yesterday_str = (date.today() - timedelta(days=1)).isoformat()
    if state.get("last_checked") == yesterday_str:
        return  # heute schon geprüft

    try:
        from services.consumption_manager import consumption_manager
        daily = consumption_manager.get_daily(9)
    except Exception:
        return

    yesterday_entry = next((d for d in daily if d.get("date") == yesterday_str), None)
    history = [d["total"] for d in daily if d.get("date") < yesterday_str]
    state["last_checked"] = yesterday_str
    if yesterday_entry is None or len(history) < 4:
        _save_appetite(state)
        return  # zu wenig Daten

    baseline = sorted(history)[len(history) // 2]  # Median der Vortage
    yesterday_total = yesterday_entry["total"]
    state["baseline"] = round(baseline, 1)
    state["yesterday"] = round(yesterday_total, 1)

    if baseline < APPETITE_MIN_BASELINE:
        _save_appetite(state)
        return

    if yesterday_total <= baseline * APPETITE_LOW_FACTOR:
        state["streak_low"] += 1
        state["streak_high"] = 0
    elif yesterday_total >= baseline * APPETITE_HIGH_FACTOR:
        state["streak_high"] += 1
        state["streak_low"] = 0
    else:
        state["streak_low"] = 0
        state["streak_high"] = 0

    state["state"] = ("low" if state["streak_low"] >= APPETITE_STREAK
                      else "high" if state["streak_high"] >= APPETITE_STREAK
                      else "ok")
    _save_appetite(state)

    if state["state"] == "low" and state["streak_low"] == APPETITE_STREAK:
        alert = (f"Appetit-Rückgang: nur {yesterday_total:.0f} g statt üblich "
                 f"~{baseline:.0f} g - {APPETITE_STREAK} Tage in Folge. "
                 f"Bitte beobachten, ggf. Tierarzt.")
        _notify_health(alert)
    elif state["state"] == "high" and state["streak_high"] == APPETITE_STREAK:
        alert = (f"Auffälliger Heisshunger: {yesterday_total:.0f} g statt üblich "
                 f"~{baseline:.0f} g - {APPETITE_STREAK} Tage in Folge.")
        _notify_health(alert)


def _notify_health(alert: str):
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


def get_appetite() -> dict:
    state = _load_appetite()
    return {k: state.get(k) for k in ("state", "baseline", "yesterday",
                                      "streak_low", "streak_high")}


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
        "appetite": get_appetite(),
    }
