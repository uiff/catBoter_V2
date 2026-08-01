"""Backup-Endpoints: herunterladen, Info, wiederherstellen."""
import logging

from flask import Blueprint, jsonify, request, send_file

from services import backup_service, event_log, power_service

bp = Blueprint("backup", __name__)


@bp.route("/backup/info")
def info():
    return jsonify(backup_service.backup_info())


@bp.route("/backup/download")
def download():
    """Erstellt das Backup frisch (überschreibt die eine Gerätekopie) und streamt es."""
    try:
        path = backup_service.create_backup()
    except OSError as e:
        logging.error(f"Backup fehlgeschlagen: {e}")
        return jsonify({"error": f"Backup fehlgeschlagen: {e}"}), 500
    return send_file(
        path,
        as_attachment=True,
        download_name="catboter-backup.tar.gz",
        mimetype="application/gzip",
    )


@bp.route("/backup/restore", methods=["POST"])
def restore():
    """Backup einspielen (multipart 'file'); bei Erfolg startet das Backend neu."""
    upload = request.files.get("file")
    if upload is None:
        return jsonify({"error": "Keine Datei empfangen"}), 400

    # Nicht während einer laufenden Fütterung restaurieren - der Feed würde
    # die frisch eingespielten Daten sofort wieder überschreiben
    from core.locks import feeding_lock
    if not feeding_lock.acquire(blocking=False):
        return jsonify({"error": "Gerade läuft eine Fütterung - bitte kurz warten"}), 409
    try:
        ok, message, count = backup_service.restore_backup(upload.read())
    finally:
        feeding_lock.release()
    if not ok:
        return jsonify({"error": message}), 400

    event_log.log_event("backend_start", f"Backup wiederhergestellt ({count} Dateien) - Neustart")
    power_service.restart_backend()
    return jsonify({"success": True,
                    "message": f"{message} - Backend startet neu"})
