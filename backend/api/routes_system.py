"""System-Endpoints: Infos, Netzwerk/WLAN, WiFi-Fallback (dateibasiert),
Power (Restart/Reboot/Shutdown), Zeit (read-only), App-Einstellungen."""
import json
import logging
import os
import time
from datetime import datetime

from flask import Blueprint, jsonify, request

from core.config import DATA_DIR
from services import power_service, settings_service, system_service, wifi_service

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
    # Maskenwert "********" = unverändert lassen (kommt aus dem GET zurück)
    if data.get("password") and data["password"] != "********":
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
    settings = settings_service.get_settings()
    # MQTT-Passwort nie zurückgeben
    mqtt = dict(settings.get("mqtt") or {})
    if mqtt.get("password"):
        mqtt["password"] = "********"
    settings["mqtt"] = mqtt
    return jsonify(settings)


@bp.route("/system/settings", methods=["POST"])
def set_app_settings():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Keine Daten empfangen"}), 400

    changes = {}

    if "tank_warn_percent" in data:
        try:
            warn = int(data["tank_warn_percent"])
        except (TypeError, ValueError):
            return jsonify({"error": "Ungültige Tank-Warnschwelle"}), 400
        if not (5 <= warn <= 90):
            return jsonify({"error": "Tank-Warnschwelle muss zwischen 5 und 90 % liegen"}), 400
        changes["tank_warn_percent"] = warn

    if "smart_feed" in data:
        changes["smart_feed"] = bool(data["smart_feed"])

    if "paused_until" in data:
        value = data["paused_until"]
        if value is not None:
            # Zeitzonenbehaftete Eingaben (z. B. '...Z') zu naiver Lokalzeit
            # normalisieren - der Scheduler vergleicht naiv
            from logic.feedingControl import parse_pause_timestamp
            until = parse_pause_timestamp(value)
            if until is None:
                return jsonify({"error": "Ungültiger Pause-Zeitpunkt"}), 400
            if until <= datetime.now():
                return jsonify({"error": "Pause-Zeitpunkt muss in der Zukunft liegen"}), 400
            value = until.isoformat()
        changes["paused_until"] = value

    if "untouched_alert_hours" in data:
        try:
            hours = float(data["untouched_alert_hours"])
        except (TypeError, ValueError):
            return jsonify({"error": "Ungültiger Stundenwert"}), 400
        if not (0 <= hours <= 72):
            return jsonify({"error": "Stundenwert muss zwischen 0 und 72 liegen"}), 400
        changes["untouched_alert_hours"] = hours

    if "mqtt" in data:
        incoming = data["mqtt"]
        if not isinstance(incoming, dict):
            return jsonify({"error": "Ungültige MQTT-Konfiguration"}), 400
        current = dict(settings_service.get_settings().get("mqtt") or {})
        current["enabled"] = bool(incoming.get("enabled", current.get("enabled", False)))
        if "host" in incoming:
            current["host"] = str(incoming["host"]).strip()
        if "port" in incoming:
            try:
                port = int(incoming["port"])
            except (TypeError, ValueError):
                return jsonify({"error": "Ungültiger MQTT-Port"}), 400
            if not (1 <= port <= 65535):
                return jsonify({"error": "MQTT-Port muss zwischen 1 und 65535 liegen"}), 400
            current["port"] = port
        if "username" in incoming:
            current["username"] = str(incoming["username"]).strip()
        # Passwort nur übernehmen wenn gesetzt (leer/Maske = unverändert)
        if incoming.get("password") and incoming["password"] != "********":
            current["password"] = str(incoming["password"])
        if current["enabled"] and not current.get("host"):
            return jsonify({"error": "MQTT-Host fehlt"}), 400
        changes["mqtt"] = current

    if "ha_discovery" in data:
        changes["ha_discovery"] = bool(data["ha_discovery"])

    if "cat_profiles" in data:
        incoming = data["cat_profiles"]
        if not isinstance(incoming, dict):
            return jsonify({"error": "Ungültige Katzenprofile"}), 400

        profiles = {"kcal_per_100g": None, "cats": []}
        if "kcal_per_100g" in incoming and incoming["kcal_per_100g"] is not None:
            try:
                kcal = float(incoming["kcal_per_100g"])
            except (TypeError, ValueError):
                return jsonify({"error": "Ungültiger kcal-Wert"}), 400
            if not (50 <= kcal <= 700):
                return jsonify({"error": "kcal/100 g muss zwischen 50 und 700 liegen"}), 400
            profiles["kcal_per_100g"] = kcal

        cats = incoming.get("cats")
        if not isinstance(cats, list) or not (1 <= len(cats) <= 4):
            return jsonify({"error": "1 bis 4 Katzenprofile erwartet"}), 400
        for cat in cats:
            if not isinstance(cat, dict):
                return jsonify({"error": "Ungültiges Katzenprofil"}), 400
            entry = {
                "name": str(cat.get("name") or "Katze")[:30],
                "weight_kg": None,
                "age_years": None,
                "activity": "normal",
            }
            for key, low, high in (("weight_kg", 0.5, 20), ("age_years", 0, 30)):
                value = cat.get(key)
                if value is not None:
                    try:
                        value = float(value)
                    except (TypeError, ValueError):
                        return jsonify({"error": f"Ungültiger Wert für {key}"}), 400
                    if not (low <= value <= high):
                        return jsonify({"error": f"{key} ausserhalb des gültigen Bereichs"}), 400
                entry[key] = value
            if cat.get("activity") in ("ruhig", "normal", "aktiv"):
                entry["activity"] = cat["activity"]
            profiles["cats"].append(entry)
        changes["cat_profiles"] = profiles

    if "diet" in data:
        incoming = data["diet"]
        if not isinstance(incoming, dict):
            return jsonify({"error": "Ungültige Diät-Konfiguration"}), 400
        current = dict(settings_service.get_settings().get("diet") or {})
        diet = {
            "enabled": bool(incoming.get("enabled", current.get("enabled", False))),
            "target_grams": current.get("target_grams"),
            "weekly_reduction_pct": current.get("weekly_reduction_pct", 5),
            "start_date": current.get("start_date"),
            "start_grams": current.get("start_grams"),
        }
        for key, low, high in (("target_grams", 5, 200), ("start_grams", 5, 300)):
            if key in incoming:
                value = incoming[key]
                if value is not None:
                    try:
                        value = float(value)
                    except (TypeError, ValueError):
                        return jsonify({"error": f"Ungültiger Wert für {key}"}), 400
                    if not (low <= value <= high):
                        return jsonify({"error": f"{key} muss zwischen {low} und {high} g liegen"}), 400
                diet[key] = value
        if "weekly_reduction_pct" in incoming:
            try:
                pct = float(incoming["weekly_reduction_pct"])
            except (TypeError, ValueError):
                return jsonify({"error": "Ungültige Reduktion"}), 400
            # Sicherheitsgrenze: schnellere Reduktion ist für Katzen gefährlich
            if not (0 <= pct <= 5):
                return jsonify({"error": "Reduktion max. 5 % pro Woche (Katzen-Sicherheit)"}), 400
            diet["weekly_reduction_pct"] = pct
        if diet["enabled"] and not diet["target_grams"]:
            return jsonify({"error": "Diät braucht ein Tagesziel (target_grams)"}), 400
        if (diet["target_grams"] and diet["start_grams"]
                and diet["start_grams"] < diet["target_grams"]):
            return jsonify({"error": "Startmenge muss über dem Tagesziel liegen"}), 400
        # Rampen-Startpunkt: setzen, wenn die Startmenge neu gesetzt/geändert wird
        if ("start_grams" in incoming and incoming["start_grams"] is not None
                and incoming["start_grams"] != current.get("start_grams")):
            diet["start_date"] = datetime.now().date().isoformat()
        elif diet["start_grams"] and not diet["start_date"]:
            diet["start_date"] = datetime.now().date().isoformat()
        changes["diet"] = diet

    try:
        settings = settings_service.update_settings(changes)
    except OSError as e:
        return jsonify({"error": f"Speichern fehlgeschlagen: {e}"}), 500

    if "paused_until" in changes:
        from services import event_log
        if changes["paused_until"]:
            event_log.log_event("pause", f"Fütterungen pausiert bis {changes['paused_until']}")
        else:
            event_log.log_event("pause", "Pause aufgehoben")

    if "diet" in changes:
        from services import event_log
        if changes["diet"].get("enabled"):
            event_log.log_event("diet", f"Diät-Modus aktiv - Ziel "
                                        f"{changes['diet'].get('target_grams')} g/Tag")
        else:
            event_log.log_event("diet", "Diät-Modus deaktiviert")

    # MQTT-Verbindung neu aufbauen, wenn sich die Konfiguration geändert hat
    if "mqtt" in changes or "ha_discovery" in changes:
        from services import mqtt_service
        mqtt_service.apply_settings()

    # Antwort mit maskiertem MQTT-Passwort
    masked = dict(settings)
    mqtt = dict(masked.get("mqtt") or {})
    if mqtt.get("password"):
        mqtt["password"] = "********"
    masked["mqtt"] = mqtt
    return jsonify({"success": True, **masked})
