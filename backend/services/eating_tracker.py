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
import math
import os
import threading
import time
import uuid
from datetime import datetime

from core.config import DATA_DIR

EPISODES_FILE = DATA_DIR / "eating_episodes.json"
MAX_EPISODES = 200
MAX_LABELED_EPISODES = 200  # Trainingsmaterial: überlebt die normale Rotation
MIN_CONSUMED_G = 2.0        # kleinere Episoden sind Messrauschen
MAX_CONSUMED_G = 100.0      # grössere "Episoden" sind physikalisch kein Fressen
DECREASE_G = 0.5            # ab so viel Abnahme zählt ein "Biss"
MAX_BITE_G = 8.0            # mehr Abnahme in 5 s = Napf entnommen, kein Fressen
EPISODE_END_GAP_S = 180     # 3 min ohne Abnahme = Episode beendet
PAUSE_GAP_S = 30            # Lücke, die als Fresspause zählt
MIN_LABELS_PER_CAT = 8      # ab dann klassifiziert der Centroid
CONFIDENCE_MIN = 0.65       # darunter bleibt die Zuordnung "unbekannt"
# Einzelschritt-Fragmente (1 "Biss", Dauer ~1 s, z. B. zwischen zwei
# Hand-Schüben) tragen keine echte Signatur: Rate/Bissgrösse sind dann
# Abtast-Artefakte. Sie zählen für Mengen, aber nicht fürs Lernen.
MIN_SIGNATURE_DURATION_S = 5

# Hand-Nachfüllung: Die entscheidende Physik ist RÜCKKEHR vs. BLEIBEN.
# Ein Maul-/Pfoten-Druck gegen die Waage (3-50 g, auch länger anhaltend!)
# kehrt beim Loslassen zur Ausgangslage zurück - Futter bleibt liegen.
# Gebucht wird darum NUR: (a) wenn der Anstieg GEFRESSEN wird (Episoden-
# Start-Nachbuchung) oder (b) nach 3 min anhaltender Erhöhung ohne Rückkehr.
# Die frühere 15-s-Sofort-Buchung erzeugte Phantom-Fütterungen, wenn eine
# Katze das Maul gegen den leeren Napf drückte (Praxis-Vorfall 03.08. 18:49).
HAND_REFILL_MIN_G = 3.0
HAND_REFILL_MAX_G = 50.0    # mehr = Katze/Fremdkörper AUF der Waage, keine Buchung
HAND_REFILL_PERSIST_SAMPLES = 36   # ~180 s liegen geblieben -> wirklich Futter
LEAN_RETURN_TOLERANCE_G = 1.0      # so nah an der Baseline = zurückgekehrt
# Ruhefenster nach einem Dosier-Signal: Anstiege stammen dann vom MOTOR und
# werden nur in die Baseline übernommen, nie als Hand-Fütterung gebucht
POST_DOSING_QUIET_S = 60

FEATURES = ("rate", "mean_bite", "duration_s", "pauses", "max_spike",
            "hour_sin", "hour_cos")
# Für die LIVE-Vermutung während des Fressens: nur Merkmale, die sich schon
# nach wenigen Bissen stabilisieren (Dauer/Pausen kennt man erst am Ende).
# Die Tageszeit steht ab Sekunde 1 fest und ist rauschfrei - Katzen haben
# oft getrennte Fresszeiten.
LIVE_FEATURES = ("rate", "mean_bite", "hour_sin", "hour_cos")


def _feat(episode, name):
    """Merkmalswert einer Episode. Die Stunde wird ZYKLISCH kodiert
    (sin/cos: 23 Uhr und 1 Uhr liegen nah beieinander) - gespeicherte
    Episoden tragen 'hour' seit jeher, bleiben also kompatibel."""
    if name == "hour_sin":
        return math.sin(2 * math.pi * (episode.get("hour") or 0) / 24)
    if name == "hour_cos":
        return math.cos(2 * math.pi * (episode.get("hour") or 0) / 24)
    return episode.get(name, 0) or 0
LIVE_MIN_DURATION_S = 15
LIVE_MIN_CONSUMED_G = 2.0

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
        # GELABELTE Episoden sind das Trainingsmaterial des Klassifikators -
        # sie dürfen NICHT aus dem 200er-Fenster herausrollen (sonst würde
        # die Erkennung nach Wochen still wieder deaktiviert). Ungelabelte
        # füllen den Rest des Fensters auf, chronologisch sortiert.
        labeled = [e for e in episodes if e.get("label")][-MAX_LABELED_EPISODES:]
        unlabeled_keep = max(50, MAX_EPISODES - len(labeled))
        unlabeled = [e for e in episodes if not e.get("label")][-unlabeled_keep:]
        kept = sorted(labeled + unlabeled, key=lambda e: e.get("ts", ""))

        tmp = EPISODES_FILE.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(kept, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, EPISODES_FILE)
    except OSError as e:
        logging.warning(f"Fress-Episoden speichern fehlgeschlagen: {e}")


def note_dosing():
    """Dosier-Signal DIREKT stempeln (von feeding_service beim Setzen/Löschen
    der Dosier-Flags). Kurze Motorläufe (2-6 s) können sonst komplett zwischen
    zwei 5-s-Poll-Ticks liegen - last_dosing_ts bliebe stale und der Anstieg
    würde als Hand-Fütterung fehlgebucht."""
    with _lock:
        _state["last_dosing_ts"] = time.time()


def note_dispensed(grams):
    """Vom Motor dosierte Menge EXAKT in die Buchhaltung übernehmen (JIT).

    Statt den Anstieg aus der Waage zu erraten: die laufende Episode zieht
    start_weight mit (consumed bleibt korrekt), die Baseline steigt mit dem
    neuen Napf-Pegel. Kein Raten, keine Phantom-Buchungen.
    """
    if not grams or grams <= 0:
        return
    with _lock:
        s = _state
        s["last_dosing_ts"] = time.time()
        s["increase_streak"] = 0
        if s["active"]:
            s["start_weight"] = round(s["start_weight"] + grams, 2)
        if s["baseline"] is not None:
            s["baseline"] = round(s["baseline"] + grams, 2)


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
                rise = last - baseline
                # ANLEHN-AUFLÖSUNG: der Anstieg kehrt mit diesem Abfall zur
                # Baseline zurück -> Maul/Pfote gegen die Waage, KEIN Futter.
                # Weder buchen noch eine Episode starten.
                if (s["increase_streak"] > 0 and rise >= HAND_REFILL_MIN_G
                        and abs(weight - baseline) <= LEAN_RETURN_TOLERANCE_G):
                    s["increase_streak"] = 0
                    s["baseline"] = weight
                    return
                # Unerklärter Anstieg direkt vor dem Fressen? Dann wurde von
                # Hand geschüttet und eine Katze hat SOFORT losgelegt - der
                # Anstieg war nie lange genug stabil für die normale Buchung.
                # Differenz zum letzten erklärten Pegel jetzt nachbuchen.
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
                # Baseline NICHT nachziehen, sonst ist der Anstieg unsichtbar.
                # Gebucht wird erst nach ~3 min OHNE Rückkehr zur Baseline -
                # ein Maul-Druck hält keine 3 Minuten durch, Futter schon
                s["increase_streak"] += 1
                if s["increase_streak"] >= HAND_REFILL_PERSIST_SAMPLES:
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
            if weight <= 0.5:
                # 0-Sprung des Sensor-Deadbands (letzter Rest -> Anzeige 0):
                # das ist KEIN Biss - Episode am echten Ende schliessen, ohne
                # rate/mean_bite/pauses mit dem Artefakt zu verfälschen
                _finish_episode(weight, now)
                s["baseline"] = weight
                s["increase_streak"] = 0
                return
            if (s["increase_streak"] > 0 and (last - baseline) >= HAND_REFILL_MIN_G
                    and abs(weight - baseline) <= LEAN_RETURN_TOLERANCE_G):
                # Anlehn-Auflösung mitten in der Mahlzeit (Druck kehrt zur
                # Baseline zurück): kein Biss - als Anlehn-Spitze verbuchen
                spike = round(last - baseline, 1)
                if spike > s["max_spike"]:
                    s["max_spike"] = spike
                s["increase_streak"] = 0
                return
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
            s["increase_streak"] += 1
            if now - s["last_dosing_ts"] < POST_DOSING_QUIET_S:
                if s["increase_streak"] >= 2:
                    # Motor hat mitten in die Episode dosiert und der Anstieg
                    # ist stabil (2 Samples - eine Anlehn-Spitze wäre wieder
                    # abgefallen): in die Episoden-Buchhaltung übernehmen,
                    # die Mahlzeit läuft WEITER statt zu fragmentieren.
                    # (JIT-Häppchen werden zusätzlich exakt via note_dispensed
                    # übernommen; dieser Pfad ist der Backstop für Plan-Feeds.)
                    s["start_weight"] = round(s["start_weight"] + increase, 2)
                    s["baseline"] = weight
                    s["increase_streak"] = 0
                    return
            elif s["increase_streak"] >= HAND_REFILL_PERSIST_SAMPLES:
                # Anstieg liegt seit ~3 min unangetastet da: Nutzer hat während
                # der Episode von Hand nachgefüllt - Episode am Pegel VOR dem
                # Anstieg beenden, Anstieg verbuchen
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


def _has_signature(episode):
    """Nur Episoden mit mehreren Bissen taugen als Lern-/Klassifikations-Material."""
    return (episode.get("duration_s") or 0) >= MIN_SIGNATURE_DURATION_S


def _centroids(episodes, features=FEATURES):
    """Mittelwert-Signatur je gelabelter Katze (z-normalisiert)."""
    labeled = [e for e in episodes if e.get("label") and _has_signature(e)]
    by_cat = {}
    for episode in labeled:
        by_cat.setdefault(episode["label"], []).append(episode)
    if len(by_cat) < 2 or any(len(v) < MIN_LABELS_PER_CAT for v in by_cat.values()):
        return None, None, None

    values = {f: [_feat(e, f) for e in labeled] for f in features}
    means = {f: sum(v) / len(v) for f, v in values.items()}
    stds = {f: (sum((x - means[f]) ** 2 for x in v) / len(v)) ** 0.5 or 1.0
            for f, v in values.items()}

    def normalize(episode):
        return [(_feat(episode, f) - means[f]) / stds[f] for f in features]

    centroids = {cat: [sum(vec[i] for vec in map(normalize, eps)) / len(eps)
                       for i in range(len(features))]
                 for cat, eps in by_cat.items()}
    return centroids, means, stds


def _nearest(sample, episodes, features):
    """Nearest-Centroid über die gegebenen Merkmale (sample: dict feature->wert)."""
    centroids, means, stds = _centroids(episodes, features)
    if centroids is None:
        return None, None
    vector = [(_feat(sample, f) - means[f]) / stds[f] for f in features]
    distances = {cat: sum((a - b) ** 2 for a, b in zip(vector, centroid)) ** 0.5
                 for cat, centroid in centroids.items()}
    ranked = sorted(distances.items(), key=lambda kv: kv[1])
    best_cat, best_d = ranked[0]
    second_d = ranked[1][1]
    confidence = round(second_d / (best_d + second_d + 1e-9), 2)
    if confidence < CONFIDENCE_MIN:
        return None, None
    return best_cat, confidence


def _classify(episode, episodes):
    """Nearest-Centroid mit Konfidenz aus dem Abstands-Verhältnis."""
    if not _has_signature(episode):
        # Fragment ohne Signatur: ehrlich "unbekannt" lassen statt raten
        return None, None
    return _nearest(episode, episodes, FEATURES)


def current_activity():
    """Live-Zustand: frisst gerade jemand, und wer vermutlich?

    Vermutung erst ab ein paar Bissen (LIVE_MIN_*) und nur über die
    früh stabilen Merkmale - Grundlage für Anzeige und JIT-Dosierung.
    """
    with _lock:
        s = _state
        if not s["active"] or s["last_weight"] is None:
            return {"eating": False, "consumed": 0.0, "duration_s": 0,
                    "rate": None, "guess": None, "confidence": None}
        duration = max(1.0, s["last_decrease_ts"] - s["start_ts"])
        consumed = round(max(0.0, s["start_weight"] - s["last_weight"]), 1)
        sample = {
            "rate": round(consumed / (duration / 60.0), 2),
            "mean_bite": round(consumed / max(1, s["bites"]), 2),
            "hour": datetime.now().hour,
        }
        episodes = _load()

    guess, confidence = (None, None)
    if duration >= LIVE_MIN_DURATION_S and consumed >= LIVE_MIN_CONSUMED_G:
        guess, confidence = _nearest(sample, episodes, LIVE_FEATURES)
    return {"eating": True, "consumed": consumed, "duration_s": round(duration),
            "rate": sample["rate"], "guess": guess, "confidence": confidence}


def jit_gate(guess, confidence, intake_today, budget_g, min_g):
    """True = NICHT weiter dosieren (Just-in-Time).

    Gesperrt wird NUR, wenn die Katze sicher erkannt ist UND ihr Tagesbudget
    UND ihre Mindestmenge erreicht sind - im Zweifel wird dosiert
    (Erkennungsfehler dürfen Gramm kosten, nie Mahlzeiten).
    """
    if guess is None or confidence is None or confidence < CONFIDENCE_MIN:
        return False
    if budget_g is None or budget_g <= 0:
        return False
    return intake_today >= budget_g and intake_today >= (min_g or 0)


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
    """Zählt nur LERNFÄHIGE Labels (Episoden mit Signatur) - Fragmente würden
    den Fortschrittsbalken füllen, ohne den Klassifikator zu verbessern."""
    with _lock:
        episodes = _load()
    labeled = {}
    for episode in episodes:
        if episode.get("label") and _has_signature(episode):
            labeled[episode["label"]] = labeled.get(episode["label"], 0) + 1
    active = len(labeled) >= 2 and all(v >= MIN_LABELS_PER_CAT for v in labeled.values())
    return {"labels": labeled, "needed_per_cat": MIN_LABELS_PER_CAT, "active": active}
