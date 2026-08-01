"""WLAN: Scan (iwlist, zellenbasierter Parser) und Verbinden.

Verbinden bevorzugt über den WiFi-Fallback-HOST-Service (Datei-IPC + nmcli):
der Pi-Host läuft mit NetworkManager, direkte wpa_cli-Änderungen aus dem
Container würden mit NM kollidieren. Fallback für Hosts ohne den Service:
wpa_cli über den Control-Socket (/var/run/wpa_supplicant, gemountet).
"""
import json
import logging
import os
import subprocess
import time

from core.config import DATA_DIR

WPA_SOCKET_DIR = "/var/run/wpa_supplicant"
INTERFACE = "wlan0"

FALLBACK_STATUS_FILE = DATA_DIR / "wifi_fallback_status.json"
FALLBACK_COMMAND_FILE = DATA_DIR / "wifi_fallback_command.json"
FALLBACK_RESULT_FILE = DATA_DIR / "wifi_fallback_result.json"


def _wpa(*args, timeout=10):
    """wpa_cli-Aufruf; liefert stdout (gestript) oder wirft RuntimeError."""
    cmd = ["wpa_cli", "-i", INTERFACE, *args]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    out = result.stdout.strip()
    if result.returncode != 0 or out == "FAIL":
        raise RuntimeError(f"wpa_cli {' '.join(args[:2])} fehlgeschlagen: {out or result.stderr.strip()}")
    return out


def control_socket_available():
    return os.path.exists(os.path.join(WPA_SOCKET_DIR, INTERFACE))


def scan_wifi():
    """Scannt WLANs. Returns Liste [{ssid, signal_dbm, encrypted}] (stärkstes je SSID)."""
    try:
        result = subprocess.run(['iwlist', INTERFACE, 'scan'],
                                capture_output=True, text=True, timeout=20)
    except (subprocess.TimeoutExpired, OSError) as e:
        raise RuntimeError(f"WLAN-Scan fehlgeschlagen: {e}")

    # Zellenbasiert parsen: eine Cell = ein Netz. (Der alte Parser hängte Netze
    # beim Encryption-Feld an und ordnete SSIDs falschen Signalwerten zu.)
    networks = []
    current = None
    for raw in result.stdout.splitlines():
        line = raw.strip()
        if line.startswith('Cell '):
            if current is not None:
                networks.append(current)
            current = {'ssid': '', 'signal_dbm': None, 'encrypted': False}
        elif current is None:
            continue
        elif 'ESSID:' in line:
            current['ssid'] = line.split('ESSID:', 1)[1].strip().strip('"')
        elif 'Signal level=' in line:
            try:
                level = line.split('Signal level=', 1)[1].split()[0]
                current['signal_dbm'] = int(float(level))
            except (ValueError, IndexError):
                pass
        elif 'Encryption key:on' in line:
            current['encrypted'] = True
    if current is not None:
        networks.append(current)

    # Leere/kaputte SSIDs raus, je SSID das stärkste Signal behalten
    best = {}
    for net in networks:
        ssid = net['ssid']
        if not ssid or '\\x00' in ssid:
            continue
        prev = best.get(ssid)
        if prev is None or (net['signal_dbm'] or -999) > (prev['signal_dbm'] or -999):
            best[ssid] = net
    return sorted(best.values(), key=lambda n: n['signal_dbm'] or -999, reverse=True)


def _host_service_running():
    """Läuft der WiFi-Fallback-Host-Service (frische Statusdatei)?"""
    try:
        with open(FALLBACK_STATUS_FILE) as f:
            status = json.load(f)
        return (time.time() - float(status.get("ts", 0))) < 120
    except (OSError, json.JSONDecodeError, ValueError):
        return False


def _atomic_write(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def _connect_via_host_service(ssid, password):
    """Reicht den Verbindungsauftrag an den Host-Service durch (nmcli) und
    wartet auf dessen Ergebnis. Der Host nutzt NetworkManager - direkte
    wpa_cli-Änderungen aus dem Container würden mit NM kollidieren."""
    try:
        with open(FALLBACK_RESULT_FILE) as f:
            before_ts = float(json.load(f).get("ts", 0))
    except (OSError, json.JSONDecodeError, ValueError):
        before_ts = 0.0

    try:
        _atomic_write(FALLBACK_COMMAND_FILE,
                      {"command": "connect_wifi", "ssid": ssid,
                       "password": password, "ts": time.time()})
    except OSError as e:
        return False, f"Befehl konnte nicht übergeben werden: {e}"

    # Host-Service tickt alle 2 s; nmcli braucht bis ~60 s
    for _ in range(75):
        time.sleep(1)
        try:
            with open(FALLBACK_RESULT_FILE) as f:
                result = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        if (result.get("command") == "connect_wifi"
                and float(result.get("ts", 0)) > before_ts):
            return bool(result.get("ok")), result.get("message", "")
    return False, "Keine Antwort vom Host-Service (Zeitüberschreitung)"


def connect_wifi(ssid, password):
    """Verbindet mit einem WLAN. Returns (ok, message)."""
    if not ssid:
        return False, "Keine SSID angegeben"
    if password and len(password) < 8:
        return False, "WLAN-Passwort muss mindestens 8 Zeichen haben"

    # Bevorzugt: Host-Service mit nmcli (NetworkManager-Host)
    if _host_service_running():
        return _connect_via_host_service(ssid, password)

    # Fallback: direkter wpa_cli-Weg (Hosts ohne NetworkManager/Service)
    if not control_socket_available():
        return False, ("Weder WiFi-Fallback-Host-Service noch wpa_supplicant-"
                       "Control-Socket verfügbar - WLAN-Wechsel nicht möglich")

    net_id = None
    try:
        # Vorherige Netz-IDs merken, um sie nach select_network wieder zu aktivieren
        existing_ids = []
        try:
            for line in _wpa("list_networks").splitlines()[1:]:
                parts = line.split('\t')
                if parts and parts[0].isdigit():
                    existing_ids.append(parts[0])
        except RuntimeError:
            pass

        net_id = _wpa("add_network")
        _wpa("set_network", net_id, "ssid", f'"{ssid}"')
        if password:
            _wpa("set_network", net_id, "psk", f'"{password}"')
        else:
            _wpa("set_network", net_id, "key_mgmt", "NONE")
        _wpa("select_network", net_id)

        # Auf Verbindung warten (max. 30 s)
        connected = False
        for _ in range(30):
            time.sleep(1)
            try:
                status = _wpa("status", timeout=5)
            except RuntimeError:
                continue
            if "wpa_state=COMPLETED" in status:
                connected = True
                break

        # Andere Netze wieder aktivieren (select_network deaktiviert sie)
        for other_id in existing_ids:
            try:
                _wpa("enable_network", other_id)
            except RuntimeError:
                pass

        if connected:
            _wpa("save_config")
            return True, f"Mit '{ssid}' verbunden"

        # Fehlversuch: neues Netz wieder entfernen, alte Config unangetastet lassen
        _wpa("remove_network", net_id)
        return False, f"Verbindung mit '{ssid}' fehlgeschlagen (Passwort falsch oder Netz nicht erreichbar)"

    except (RuntimeError, subprocess.TimeoutExpired, OSError) as e:
        logging.error(f"connect_wifi Fehler: {e}")
        if net_id is not None:
            try:
                _wpa("remove_network", net_id)
            except Exception:
                pass
        return False, f"WLAN-Verbindung fehlgeschlagen: {e}"
