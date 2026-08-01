"""System-Endpoints: Infos, Netzwerk/WLAN, WiFi-Fallback (dateibasiert),
Power (Restart/Reboot/Shutdown), Zeit (read-only), App-Einstellungen."""
import json
import logging
import os
import time
from datetime import datetime

from flask import Blueprint, jsonify, request

from core.config import DATA_DIR, APP_SETTINGS_FILE, APP_SETTINGS_DEFAULTS
from services import power_service, system_service, wifi_service

bp = Blueprint("system", __name__)

FALLBACK_STATUS_FILE = DATA_DIR / "wifi_fallback_status.json"
FALLBACK_CONFIG_FILE = DATA_DIR / "wifi_fallback_config.json"
FALLBACK_COMMAND_FILE = DATA_DIR / "wifi_fallback_command.json"

FALLBACK_CONFIG_DEFAULTS = {
    "enabled": True,
    "ssid": "CatBoter-Setup",
    "password": "catboter123",
    "channel": 6,
    "check_interval": 30,
}


def _read_json(path, default):
    try:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logging.warning(f"{path.name} unlesbar: {e}")
    return default


def _write_json(path, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


# ---------- System-Infos ----------

@bp.route("/system/stats")
def system_stats():
    """Gebündelte System-Infos für die Statistik-Seite (ein Request statt vier)."""
    return jsonify({
        "cpu_percent": system_service.get_cpu_percent(),
        "temperature": system_service.get_cpu_temperature(),
        "memory": system_service.get_memory_info(),
        "disk": system_service.get_disk_info(),
    })


@bp.route("/system/cpu")
def system_cpu():
    return jsonify({"cpu_percent": system_service.get_cpu_percent()})


@bp.route("/system/temperature")
def system_temperature():
    temp = system_service.get_cpu_temperature()
    if temp is None:
        return jsonify({"error": "Temperatur nicht verfügbar"}), 503
    return jsonify({"temperature": temp})


@bp.route("/system/ram")
def system_ram():
    return jsonify(system_service.get_memory_info())


@bp.route("/system/disk")
def system_disk():
    return jsonify(system_service.get_disk_info())


@bp.route("/system/network")
def system_network():
    return jsonify(system_service.get_network_info())


# ---------- WLAN ----------

@bp.route("/system/scan_wifi")
def scan_wifi():
    try:
        return jsonify({"networks": wifi_service.scan_wifi()})
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503


@bp.route("/system/connect_wifi", methods=["POST"])
def connect_wifi():
    data = request.get_json(silent=True) or {}
    ok, message = wifi_service.connect_wifi(data.get("ssid"), data.get("password"))
    if ok:
        return jsonify({"success": True, "message": message,
                        "network": system_service.get_network_info()})
    return jsonify({"error": message}), 400


# ---------- WiFi-Fallback (Host-Service, IPC über Dateien im Daten-Volume) ----------

@bp.route("/system/wifi_fallback/status")
def fallback_status():
    config = _read_json(FALLBACK_CONFIG_FILE, FALLBACK_CONFIG_DEFAULTS)
    status = _read_json(FALLBACK_STATUS_FILE, None)
    if status is None:
        return jsonify({"service_running": False,
                        "message": "Host-Service läuft nicht (keine Statusdatei)"})
    max_age = max(int(config.get("check_interval", 30)), 10) * 3
    stale = (time.time() - float(status.get("ts", 0))) > max_age
    return jsonify({
        "service_running": not stale,
        "network_connected": status.get("network_connected"),
        "ap_active": status.get("ap_active"),
        "failed_checks": status.get("failed_checks"),
        "ssid": status.get("ssid"),
    })


@bp.route("/system/wifi_fallback/config", methods=["GET"])
def fallback_get_config():
    config = _read_json(FALLBACK_CONFIG_FILE, dict(FALLBACK_CONFIG_DEFAULTS))
    masked = dict(config)
    if masked.get("password"):
        masked["password"] = "********"
    return jsonify(masked)


@bp.route("/system/wifi_fallback/config", methods=["POST"])
def fallback_set_config():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Keine Daten empfangen"}), 400

    config = _read_json(FALLBACK_CONFIG_FILE, dict(FALLBACK_CONFIG_DEFAULTS))

    if "enabled" in data:
        config["enabled"] = bool(data["enabled"])
    if "ssid" in data:
        ssid = str(data["ssid"]).strip()
        if not (1 <= len(ssid) <= 32):
            return jsonify({"error": "SSID muss 1-32 Zeichen haben"}), 400
        config["ssid"] = ssid
    if data.get("password"):
        password = str(data["password"])
        if len(password) < 8 or len(password) > 63:
            return jsonify({"error": "AP-Passwort muss 8-63 Zeichen haben"}), 400
        config["password"] = password
    if "channel" in data:
        try:
            channel = int(data["channel"])
        except (TypeError, ValueError):
            return jsonify({"error": "Ungültiger Kanal"}), 400
        if not (1 <= channel <= 13):
            return jsonify({"error": "Kanal muss zwischen 1 und 13 liegen"}), 400
        config["channel"] = channel
    if "check_interval" in data:
        try:
            interval = int(data["check_interval"])
        except (TypeError, ValueError):
            return jsonify({"error": "Ungültiges Prüfintervall"}), 400
        if not (10 <= interval <= 600):
            return jsonify({"error": "Prüfintervall muss zwischen 10 und 600 s liegen"}), 400
        config["check_interval"] = interval

    try:
        _write_json(FALLBACK_CONFIG_FILE, config)
    except OSError as e:
        return jsonify({"error": f"Speichern fehlgeschlagen: {e}"}), 500
    # Passwort nie zurückgeben
    return jsonify({"success": True, "message": "Konfiguration gespeichert"})


def _queue_fallback_command(command):
    try:
        _write_json(FALLBACK_COMMAND_FILE, {"command": command, "ts": time.time()})
        return True, None
    except OSError as e:
        return False, str(e)


@bp.route("/system/wifi_fallback/enable_ap", methods=["POST"])
def fallback_enable_ap():
    ok, error = _queue_fallback_command("enable_ap")
    if not ok:
        return jsonify({"error": error}), 500
    return jsonify({"status": "queued",
                    "message": "Hotspot wird vom Host-Service aktiviert"}), 202


@bp.route("/system/wifi_fallback/disable_ap", methods=["POST"])
def fallback_disable_ap():
    ok, error = _queue_fallback_command("disable_ap")
    if not ok:
        return jsonify({"error": error}), 500
    return jsonify({"status": "queued",
                    "message": "Hotspot wird vom Host-Service deaktiviert"}), 202


# ---------- Power ----------

@bp.route("/system/restart_backend", methods=["POST"])
def restart_backend():
    power_service.restart_backend()
    return jsonify({"success": True,
                    "message": "Backend startet neu (Docker-Restart-Policy)"})


@bp.route("/system/reboot", methods=["POST"])
def reboot():
    power_service.reboot_host()
    return jsonify({"success": True, "message": "Raspberry Pi startet neu"})


@bp.route("/system/shutdown", methods=["POST"])
def shutdown():
    power_service.shutdown_host()
    return jsonify({"success": True, "message": "Raspberry Pi fährt herunter"})


# ---------- Zeit (read-only - der Host verwaltet NTP) ----------

@bp.route("/system/time_status")
def time_status():
    tz = os.environ.get("TZ")
    if not tz:
        try:
            with open("/etc/timezone") as f:
                tz = f.read().strip()
        except OSError:
            tz = None
    return jsonify({
        "current_time": datetime.now().isoformat(),
        "timezone": tz,
        "managed_by": "host",
    })


# ---------- App-Einstellungen (ersetzt localStorage-Placebo) ----------

@bp.route("/system/settings", methods=["GET"])
def get_app_settings():
    settings = dict(APP_SETTINGS_DEFAULTS)
    settings.update(_read_json(APP_SETTINGS_FILE, {}))
    return jsonify(settings)


@bp.route("/system/settings", methods=["POST"])
def set_app_settings():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Keine Daten empfangen"}), 400

    settings = dict(APP_SETTINGS_DEFAULTS)
    settings.update(_read_json(APP_SETTINGS_FILE, {}))

    if "tank_warn_percent" in data:
        try:
            warn = int(data["tank_warn_percent"])
        except (TypeError, ValueError):
            return jsonify({"error": "Ungültige Tank-Warnschwelle"}), 400
        if not (5 <= warn <= 90):
            return jsonify({"error": "Tank-Warnschwelle muss zwischen 5 und 90 % liegen"}), 400
        settings["tank_warn_percent"] = warn

    try:
        _write_json(APP_SETTINGS_FILE, settings)
    except OSError as e:
        return jsonify({"error": f"Speichern fehlgeschlagen: {e}"}), 500
    return jsonify({"success": True, **settings})
