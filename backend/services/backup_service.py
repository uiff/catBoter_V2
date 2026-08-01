"""Backup & Wiederherstellung der Laufzeitdaten - direkt aus der Web-App.

Regeln (Nutzer-Vorgabe):
- Es existiert immer genau EIN Backup auf dem Gerät (fester Dateiname,
  jedes neue überschreibt das alte).
- Inhalt: nur Laufzeitdaten (JSONs aus DATA_DIR + Fütterungspläne) - <1 MB.
- Restore: strenge Validierung (Whitelist, kein Pfad-Traversal, JSON-Parse),
  danach sauberer Backend-Neustart.
"""
import io
import json
import logging
import os
import shutil
import tarfile
import tempfile
import time
from pathlib import Path

from core.config import DATA_DIR, FEEDING_PLAN_DIR

BACKUP_FILE = DATA_DIR / "catboter-backup.tar.gz"
MAX_RESTORE_BYTES = 20 * 1024 * 1024

# Nur diese Dateien wandern ins Backup und dürfen wiederhergestellt werden
DATA_WHITELIST = {
    "kalibrierung.json",
    "tank_calibration.json",
    "tank_stats.json",
    "app_settings.json",
    "consumption_history.json",
    "current_day.json",
    "wifi_fallback_config.json",
    "events.jsonl",
    "health_stats.json",
    "push_subscriptions.json",
}
PLAN_WHITELIST = {"feedingPlans.json", "randomPlans.json"}


def create_backup() -> Path:
    """Erstellt das Backup frisch und überschreibt die eine Gerätekopie."""
    # Eindeutige tmp-Datei (parallel laufende Downloads dürfen sich nicht
    # gegenseitig zerschreiben), Aufräumen bei Fehlern garantiert
    fd, tmp_name = tempfile.mkstemp(dir=str(DATA_DIR), suffix=".tar.gz.tmp")
    os.close(fd)
    try:
        with tarfile.open(tmp_name, "w:gz") as tar:
            for name in sorted(DATA_WHITELIST):
                path = DATA_DIR / name
                if path.exists():
                    tar.add(path, arcname=f"data/{name}")
            for name in sorted(PLAN_WHITELIST):
                path = FEEDING_PLAN_DIR / name
                if path.exists():
                    tar.add(path, arcname=f"feedingPlan/{name}")
        os.replace(tmp_name, BACKUP_FILE)
    except BaseException:
        try:
            os.remove(tmp_name)
        except OSError:
            pass
        raise
    logging.info(f"Backup erstellt: {BACKUP_FILE} ({BACKUP_FILE.stat().st_size} Bytes)")
    return BACKUP_FILE


def backup_info() -> dict:
    if not BACKUP_FILE.exists():
        return {"exists": False}
    stat = BACKUP_FILE.stat()
    return {
        "exists": True,
        "size": stat.st_size,
        "created": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(stat.st_mtime)),
    }


def _validate_member(member: tarfile.TarInfo):
    """Sicherheit: nur reguläre Whitelist-Dateien, keine Pfad-Tricks."""
    if not member.isreg():
        return None
    name = member.name.lstrip("./")
    if name.startswith("/") or ".." in Path(name).parts:
        raise ValueError(f"Unzulässiger Pfad im Backup: {member.name}")
    parts = Path(name).parts
    if len(parts) != 2:
        return None
    folder, filename = parts
    if folder == "data" and filename in DATA_WHITELIST:
        return (DATA_DIR, filename)
    if folder == "feedingPlan" and filename in PLAN_WHITELIST:
        return (FEEDING_PLAN_DIR, filename)
    return None


def restore_backup(file_bytes: bytes):
    """Validiert und spielt ein Backup ein. Returns (ok, message, restored_count)."""
    if len(file_bytes) > MAX_RESTORE_BYTES:
        return False, "Datei zu gross (max. 20 MB)", 0

    try:
        tar = tarfile.open(fileobj=io.BytesIO(file_bytes), mode="r:gz")
    except tarfile.TarError:
        return False, "Keine gültige Backup-Datei (tar.gz erwartet)", 0

    with tar, tempfile.TemporaryDirectory(dir=str(DATA_DIR)) as tmpdir:
        staged = []  # (tmp_path, target_dir, filename)
        try:
            for member in tar.getmembers():
                target = _validate_member(member)
                if target is None:
                    continue
                # Dekompressions-Bomben abwehren: deklarierte Grösse VOR dem
                # Lesen prüfen UND begrenzt lesen (die Deklaration kann lügen)
                if member.size > MAX_RESTORE_BYTES:
                    return False, f"Datei {member.name} zu gross", 0
                target_dir, filename = target
                extracted = tar.extractfile(member)
                if extracted is None:
                    continue
                content = extracted.read(MAX_RESTORE_BYTES + 1)
                if len(content) > MAX_RESTORE_BYTES:
                    return False, f"Datei {filename} zu gross", 0
                # JSON-Dateien müssen parsebar sein (jsonl zeilenweise)
                if filename.endswith(".json"):
                    json.loads(content.decode("utf-8"))
                elif filename.endswith(".jsonl"):
                    for line in content.decode("utf-8").splitlines():
                        if line.strip():
                            json.loads(line)
                tmp_path = Path(tmpdir) / f"{len(staged)}_{filename}"
                tmp_path.write_bytes(content)
                staged.append((tmp_path, target_dir, filename))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as e:
            return False, f"Backup ungültig: {e}", 0

        if not staged:
            return False, "Backup enthält keine bekannten Dateien", 0

        # Erst nach vollständiger Validierung einsetzen. shutil.move statt
        # os.replace: feedingPlan/ ist ein ANDERER Bind-Mount als data/ -
        # rename(2) über Mount-Grenzen scheitert mit EXDEV
        for tmp_path, target_dir, filename in staged:
            target_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(tmp_path), str(target_dir / filename))

    logging.info(f"Backup wiederhergestellt: {len(staged)} Dateien")
    return True, f"{len(staged)} Dateien wiederhergestellt", len(staged)
