"""Fress-Episoden mit Signatur - Grundlage der Katzen-Erkennung über die Waage.

Aus den 5-s-Gewichtssamples werden Fress-Episoden erkannt und je Episode
Signatur-Merkmale gesammelt:
- Fressgeschwindigkeit (g/min) und mittlere "Bissgrösse" (g je Abnahme-Schritt)
- Pausenmuster (Anzahl >30-s-Lücken zwischen Abnahmen)
- Anlehn-Spitze (max. kurzzeitige Gewichts-ZUNAHME = Kopf/Pfote am Napf)
- Dauer und Tageszeit

Der Nutzer labelt Episoden in der App ("das war Ayla"); ab genügend Labels
je Katze ordnet ein Nearest-Centroid-Klassifikator (reine Mathematik, keine
ML-Bibliothek) neue Episoden mit Konfidenz zu. Unsichere bleiben unbekannt.
"""
import json
import logging
import os
import threading
import time
import uuid
from datetime import datetime

from core.config import DATA_DIR

EPISODES_FILE = DATA_DIR / "eating_episodes.json"
MAX_EPISODES = 200
MIN_CONSUMED_G = 2.0        # kleinere Episoden sind Messrauschen
MAX_CONSUMED_G = 100.0      # grössere "Episoden" sind physikalisch kein Fressen
DECREASE_G = 0.5            # ab so viel Abnahme zählt ein "Biss"
MAX_BITE_G = 8.0            # mehr Abnahme in 5 s = Napf entnommen, kein Fressen
EPISODE_END_GAP_S = 180     # 3 min ohne Abnahme = Episode beendet
PAUSE_GAP_S = 30            # Lücke, die als Fresspause zählt
MIN_LABELS_PER_CAT = 8      # ab dann klassifiziert der Centroid
CONFIDENCE_MIN = 0.65       # darunter bleibt die Zuordnung "unbekannt"

# Hand-Nachfüllung: ANHALTENDER Anstieg (>= 3 Samples ~15 s) ab dieser Menge.
# Kurze Spitzen (Katze lehnt an) gehen wieder zurück und zählen als Spike;
# was liegen bleibt, wurde von Hand in den Napf gegeben und zählt als Fütterung.
HAND_REFILL_MIN_G = 3.0
HAND_REFILL_MAX_G = 50.0    # mehr = Katze/Fremdkörper AUF der Waage, keine Buchung
HAND_REFILL_SAMPLES = 3
# Ruhefenster nach einem Dosier-Signal: Anstiege stammen dann vom MOTOR und
# werden nur in die Baseline übernommen, nie als Hand-Fütterung gebucht
POST_DOSING_QUIET_S = 60

FEATURES = ("rate", "mean_bite", "duration_s", "pauses", "max_spike")

_lock = threading.Lock()
_state = {
    "active": False,
    "start_ts": 0.0,
    "start_weight": 0.0,
    "last_weight": None,
    "last_decrease_ts": 0.0,
    "bites": 0,
    "pauses": 0,
    "max_spike": 0.0,
    "baseline": None,  # gleitender Napf-Pegel zur Spike-Erkennung
    "increase_streak": 0,  # aufeinanderfolgende Samples mit anhaltendem Anstieg
    "last_dosing_ts": 0.0,  # letztes Dosier-Signal (Motor/feeding_lock)
}


def _load():
    try:
        if EPISODES_FILE.exists():
            with open(EPISODES_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError):
        pass
    return []


def _save(episodes):
    try:
        tmp = EPISODES_FILE.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(episodes[-MAX_EPISODES:], f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, EPISODES_FILE)
    except OSError as e:
        logging.warning(f"Fress-Episoden speichern fehlgeschlagen: {e}")


def sample(weight, feeding_active: bool):
    """Vom 5-s-Polling-Loop: Episoden erkennen und Signatur sammeln.

    feeding_active: während der Motor dosiert, STEIGT das Gewicht - das ist
    keine Fress-Signatur und wird ausgeklammert.
    """
    if weight is None or feeding_active:
        if feeding_active:
            # Nur den Zeitpunkt merken - das Signal kann auch der kurze
            # Scheduler-Lock ohne echte Fütterung sein, ein hartes Reset
            # würde laufende Episoden grundlos zerhacken. Anstiege im
            # Ruhefenster danach werden absorbiert statt gebucht.
            with _lock:
                _state["last_dosing_ts"] = time.time()
        return
    now = time.time()

    with _lock:
        s = _state
        last = s["last_weight"]
        s["last_weight"] = weight
        if last is None:
            s["baseline"] = weight
            return

        decrease = last - weight
        baseline = s["baseline"] if s["baseline"] is not None else weight
        increase = weight - baseline

        if not s["active"]:
            if decrease > MAX_BITE_G:
                # Napf entnommen / Katze von der Waage gestiegen - kein Fressen
                s["baseline"] = weight
                s["increase_streak"] = 0
            elif decrease >= DECREASE_G and last >= MIN_CONSUMED_G:
                # Unerklärter Anstieg direkt vor dem Fressen? Dann wurde von
                # Hand geschüttet und eine Katze hat SOFORT losgelegt - der
                # Anstieg war nie lange genug stabil für die normale Buchung.
                # Differenz zum letzten erklärten Pegel jetzt nachbuchen.
                rise = last - baseline
                if (HAND_REFILL_MIN_G <= rise <= HAND_REFILL_MAX_G
                        and now - s["last_dosing_ts"] >= POST_DOSING_QUIET_S):
                    _register_hand_refill(round(rise, 1))
                # Episode beginnt
                s.update(active=True, start_ts=now, start_weight=last,
                         last_decrease_ts=now, bites=1, pauses=0,
                         max_spike=0.0, baseline=weight, increase_streak=0)
            elif increase > HAND_REFILL_MAX_G:
                # Katze steht auf der Waage - ignorieren, Baseline behalten,
                # damit der Rücksprung danach nicht als Fressen zählt
                s["increase_streak"] = 0
            elif increase >= HAND_REFILL_MIN_G:
                if now - s["last_dosing_ts"] < POST_DOSING_QUIET_S:
                    # Anstieg stammt vom Motor (frisch dosiert) - absorbieren
                    s["baseline"] = weight
                    s["increase_streak"] = 0
                    return
                # Baseline NICHT nachziehen, sonst ist der Anstieg unsichtbar
                s["increase_streak"] += 1
                if s["increase_streak"] >= HAND_REFILL_SAMPLES:
                    _register_hand_refill(round(increase, 1))
                    s["baseline"] = weight
                    s["increase_streak"] = 0
            else:
                s["baseline"] = weight
                s["increase_streak"] = 0
            return

        # laufende Episode
        if decrease > MAX_BITE_G:
            # Napf mitten in der Episode entnommen: am Pegel VOR dem Sprung
            # abschliessen, sonst zählt der Sprung als riesige "Mahlzeit"
            _finish_episode(last, now)
            s["baseline"] = weight
            s["increase_streak"] = 0
            return
        if decrease >= DECREASE_G:
            gap = now - s["last_decrease_ts"]
            if gap >= PAUSE_GAP_S:
                s["pauses"] += 1
            s["bites"] += 1
            s["last_decrease_ts"] = now
            s["baseline"] = weight
            s["increase_streak"] = 0
        elif increase > HAND_REFILL_MAX_G:
            # Katze steht auf der Waage - ignorieren (siehe oben)
            s["increase_streak"] = 0
        elif increase >= HAND_REFILL_MIN_G:
            if now - s["last_dosing_ts"] < POST_DOSING_QUIET_S:
                # Motor hat mitten in die Episode dosiert: Episode am Pegel
                # VOR dem Anstieg beenden, Anstieg absorbieren (keine Buchung -
                # die Plan-Fütterung hat ihre Menge selbst getrackt)
                _finish_episode(baseline, now)
                s["baseline"] = weight
                s["increase_streak"] = 0
                return
            s["increase_streak"] += 1
            if s["increase_streak"] >= HAND_REFILL_SAMPLES:
                # Nutzer hat während der Episode von Hand nachgefüllt:
                # Episode am Pegel VOR dem Anstieg beenden, Anstieg verbuchen
                _finish_episode(baseline, now)
                _register_hand_refill(round(increase, 1))
                s["baseline"] = weight
                s["increase_streak"] = 0
                return
        else:
            s["increase_streak"] = 0
            if increase > s["max_spike"] and increase > 0:
                # kurzzeitige Zunahme = Katze lehnt an/steckt den Kopf in den Napf
                s["max_spike"] = round(increase, 1)

        if now - s["last_decrease_ts"] >= EPISODE_END_GAP_S or weight <= 0.5:
            _finish_episode(weight, now)


def _register_hand_refill(grams):
    """Von Hand nachgefülltes Futter als eigene Fütterungsart verbuchen.

    Der Nutzer öffnet teils den Tank und wirft Futter direkt in den Napf -
    ohne diese Buchung würden Tagesmenge, Statistik und Diät-Budget lügen.
    """
    try:
        from services.consumption_manager import consumption_manager
        from services import event_log
        consumption_manager.add_feeding(grams, source="hand")
        event_log.log_event("hand_feed", f"Von Hand nachgefüllt: {grams} g", grams=grams)
        logging.info(f"Hand-Nachfüllung erkannt: {grams} g")
    except Exception as e:
        logging.warning(f"Hand-Nachfüllung verbuchen fehlgeschlagen: {e}")


def _finish_episode(end_weight, now):
    """Episode abschliessen und mit Signatur ablegen (Lock wird gehalten)."""
    s = _state
    s["active"] = False
    consumed = round(max(0.0, s["start_weight"] - max(end_weight, 0.0)), 1)
    duration = max(1.0, s["last_decrease_ts"] - s["start_ts"])
    if consumed < MIN_CONSUMED_G or consumed > MAX_CONSUMED_G:
        return

    episode = {
        "id": uuid.uuid4().hex[:8],
        "ts": datetime.fromtimestamp(s["start_ts"]).isoformat(timespec="seconds"),
        "consumed": consumed,
        "duration_s": round(duration),
        "rate": round(consumed / (duration / 60.0), 2),
        "mean_bite": round(consumed / max(1, s["bites"]), 2),
        "pauses": s["pauses"],
        "max_spike": s["max_spike"],
        "hour": datetime.fromtimestamp(s["start_ts"]).hour,
        "label": None,
        "auto_label": None,
        "confidence": None,
    }

    episodes = _load()
    episodes.append(episode)
    auto, confidence = _classify(episode, episodes)
    if auto is not None:
        episode["auto_label"] = auto
        episode["confidence"] = confidence
    _save(episodes)
    logging.info(f"Fress-Episode: {consumed} g in {episode['duration_s']} s "
                 f"(Rate {episode['rate']} g/min, Spike {episode['max_spike']} g"
                 + (f", auto: {auto} {confidence}" if auto else "") + ")")


# ---------- Labeln & Klassifikator ----------

def list_episodes(days=7):
    from datetime import timedelta
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    with _lock:
        return [e for e in reversed(_load()) if e.get("ts", "") >= cutoff]


def set_label(episode_id, label):
    """label: Katzenname oder None (= unbekannt). Re-klassifiziert danach alles."""
    with _lock:
        episodes = _load()
        target = next((e for e in episodes if e.get("id") == episode_id), None)
        if target is None:
            return False
        target["label"] = label or None
        # Alle ungelabelten mit dem neuen Wissen frisch zuordnen
        for episode in episodes:
            if episode.get("label") is None:
                auto, confidence = _classify(episode, episodes)
                episode["auto_label"] = auto
                episode["confidence"] = confidence
        _save(episodes)
    return True


def _centroids(episodes):
    """Mittelwert-Signatur je gelabelter Katze (z-normalisiert)."""
    labeled = [e for e in episodes if e.get("label")]
    by_cat = {}
    for episode in labeled:
        by_cat.setdefault(episode["label"], []).append(episode)
    if len(by_cat) < 2 or any(len(v) < MIN_LABELS_PER_CAT for v in by_cat.values()):
        return None, None, None

    values = {f: [e.get(f, 0) or 0 for e in labeled] for f in FEATURES}
    means = {f: sum(v) / len(v) for f, v in values.items()}
    stds = {f: (sum((x - means[f]) ** 2 for x in v) / len(v)) ** 0.5 or 1.0
            for f, v in values.items()}

    def normalize(episode):
        return [((episode.get(f, 0) or 0) - means[f]) / stds[f] for f in FEATURES]

    centroids = {cat: [sum(vec[i] for vec in map(normalize, eps)) / len(eps)
                       for i in range(len(FEATURES))]
                 for cat, eps in by_cat.items()}
    return centroids, means, stds


def _classify(episode, episodes):
    """Nearest-Centroid mit Konfidenz aus dem Abstands-Verhältnis."""
    centroids, means, stds = _centroids(episodes)
    if centroids is None:
        return None, None

    vector = [((episode.get(f, 0) or 0) - means[f]) / stds[f] for f in FEATURES]
    distances = {cat: sum((a - b) ** 2 for a, b in zip(vector, centroid)) ** 0.5
                 for cat, centroid in centroids.items()}
    ranked = sorted(distances.items(), key=lambda kv: kv[1])
    best_cat, best_d = ranked[0]
    second_d = ranked[1][1]
    confidence = round(second_d / (best_d + second_d + 1e-9), 2)
    if confidence < CONFIDENCE_MIN:
        return None, None
    return best_cat, confidence


def per_cat_today():
    """Heutiger Verbrauch je Katze (Label vor Auto-Label), Rest 'unbekannt'."""
    today = datetime.now().date().isoformat()
    totals = {}
    with _lock:
        for episode in _load():
            if not episode.get("ts", "").startswith(today):
                continue
            cat = episode.get("label") or episode.get("auto_label") or "unbekannt"
            totals[cat] = round(totals.get(cat, 0) + episode.get("consumed", 0), 1)
    return totals


def classifier_status():
    with _lock:
        episodes = _load()
    labeled = {}
    for episode in episodes:
        if episode.get("label"):
            labeled[episode["label"]] = labeled.get(episode["label"], 0) + 1
    active = len(labeled) >= 2 and all(v >= MIN_LABELS_PER_CAT for v in labeled.values())
    return {"labels": labeled, "needed_per_cat": MIN_LABELS_PER_CAT, "active": active}
