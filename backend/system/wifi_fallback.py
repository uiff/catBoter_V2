#!/usr/bin/env python3
"""
WiFi Fallback System - Automatischer Access Point bei verlorener Verbindung.

Läuft als HOST-systemd-Service (root, ausserhalb Docker) - der AP-Betrieb muss
wpa_supplicant stoppen und hostapd/dnsmasq fahren, was aus einem Container, der
an genau diesem Netz hängt, strukturell fragil ist. Der Service funktioniert
auch bei Container-/Docker-Ausfall (genau der Notfall, für den er da ist).

IPC mit dem Backend über JSON-Dateien im Daten-Verzeichnis (im Container als
/app/data gemountet):
- wifi_fallback_config.json   Konfiguration (Backend schreibt, Service liest bei Änderung)
- wifi_fallback_status.json   Status (Service schreibt pro Tick atomar)
- wifi_fallback_command.json  Befehle enable_ap/disable_ap (Backend schreibt, Service konsumiert)
"""

import argparse
import json
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class WiFiFallbackManager:
    """Verwaltet automatischen WiFi-Fallback zu Access Point Modus."""

    def __init__(self, data_dir: Path = DEFAULT_DATA_DIR):
        self.data_dir = Path(data_dir)
        self.config_path = self.data_dir / "wifi_fallback_config.json"
        self.status_path = self.data_dir / "wifi_fallback_status.json"
        self.command_path = self.data_dir / "wifi_fallback_command.json"
        self.result_path = self.data_dir / "wifi_fallback_result.json"
        self._config_mtime = 0.0
        self.config = self._load_config()
        self.ap_active = self.is_ap_active()  # Realität statt Annahme (übersteht Service-Restart)
        self.failed_checks = 0
        self.max_failed_checks = 3  # Nach 3 Fehlversuchen AP aktivieren
        self.has_nmcli = self._check_nmcli()

    @staticmethod
    def _check_nmcli() -> bool:
        try:
            return subprocess.run(['nmcli', '--version'], capture_output=True,
                                  timeout=5).returncode == 0
        except Exception:
            return False

    # ---------- Konfiguration ----------

    def _default_config(self) -> dict:
        return {
            "enabled": True,
            "ssid": "CatBoter-Setup",
            "password": "catboter123",
            "ip_address": "10.0.0.1",
            "netmask": "255.255.255.0",
            "dhcp_range_start": "10.0.0.10",
            "dhcp_range_end": "10.0.0.50",
            "channel": 6,
            "check_interval": 30,
        }

    def _load_config(self) -> dict:
        default_config = self._default_config()
        if self.config_path.exists():
            try:
                self._config_mtime = self.config_path.stat().st_mtime
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                return {**default_config, **config}
            except Exception as e:
                logger.error(f"Fehler beim Laden der Config: {e}")
                return default_config
        else:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            try:
                self._atomic_write(self.config_path, default_config)
                self._config_mtime = self.config_path.stat().st_mtime
            except OSError as e:
                logger.error(f"Config konnte nicht angelegt werden: {e}")
            return default_config

    def _reload_config_if_changed(self):
        try:
            mtime = self.config_path.stat().st_mtime
        except OSError:
            return
        if mtime != self._config_mtime:
            logger.info("Konfiguration geändert - lade neu")
            self.config = self._load_config()

    # ---------- Datei-IPC ----------

    @staticmethod
    def _atomic_write(path: Path, data: dict):
        tmp = path.with_suffix(path.suffix + '.tmp')
        with open(tmp, 'w') as f:
            json.dump(data, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)

    def write_status(self):
        try:
            self._atomic_write(self.status_path, {
                "network_connected": self.failed_checks == 0 and not self.ap_active,
                "ap_active": self.ap_active,
                "failed_checks": self.failed_checks,
                "ssid": self._current_ssid(),
                "ts": time.time(),
            })
        except OSError as e:
            logger.error(f"Statusdatei konnte nicht geschrieben werden: {e}")

    def consume_command(self) -> Optional[dict]:
        """Liest und löscht eine anstehende Command-Datei."""
        if not self.command_path.exists():
            return None
        try:
            with open(self.command_path) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Command-Datei unlesbar: {e}")
            data = None
        try:
            os.remove(self.command_path)
        except OSError:
            pass
        return data if isinstance(data, dict) else None

    def write_result(self, command: str, ok: bool, message: str):
        """Ergebnis eines Befehls fürs Backend (z. B. connect_wifi-Ausgang)."""
        try:
            self._atomic_write(self.result_path, {
                "command": command, "ok": ok, "message": message, "ts": time.time(),
            })
        except OSError as e:
            logger.error(f"Result-Datei konnte nicht geschrieben werden: {e}")

    def connect_wifi(self, ssid: str, password: str) -> None:
        """Verbindet per nmcli mit einem WLAN (der Host nutzt NetworkManager -
        direkte wpa_cli-Änderungen würden mit NM kollidieren)."""
        if not ssid:
            self.write_result("connect_wifi", False, "Keine SSID angegeben")
            return
        if not self.has_nmcli:
            self.write_result("connect_wifi", False,
                              "nmcli nicht verfügbar - WLAN-Wechsel nicht möglich")
            return
        try:
            cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid]
            if password:
                cmd += ['password', password]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0:
                logger.info(f"WLAN verbunden: {ssid}")
                self.failed_checks = 0
                self.write_result("connect_wifi", True, f"Mit '{ssid}' verbunden")
            else:
                error = (result.stderr or result.stdout).strip()
                logger.warning(f"WLAN-Verbindung fehlgeschlagen: {error}")
                self.write_result("connect_wifi", False,
                                  f"Verbindung fehlgeschlagen: {error[:200]}")
        except subprocess.TimeoutExpired:
            self.write_result("connect_wifi", False, "Zeitüberschreitung beim Verbinden")
        except Exception as e:
            self.write_result("connect_wifi", False, f"Fehler: {e}")

    # ---------- Checks ----------

    def _current_ssid(self) -> Optional[str]:
        try:
            result = subprocess.run(['iwgetid', '-r'], capture_output=True, text=True, timeout=3)
            return result.stdout.strip() or None
        except Exception:
            return None

    def is_network_connected(self) -> bool:
        """Prüft ob IRGENDEINE Netzwerkverbindung besteht (WLAN ODER Ethernet).

        Steckt ein LAN-Kabel, ist das Gerät erreichbar - dann wäre ein Hotspot
        unnötig und würde nur den WLAN-Client-Modus zerstören.
        Kriterium: Default-Gateway vorhanden und per Ping erreichbar.
        """
        try:
            gateway = self._get_default_gateway()
            if not gateway:
                return False
            ping_result = subprocess.run(
                ['ping', '-c', '1', '-W', '2', gateway],
                capture_output=True, timeout=5
            )
            return ping_result.returncode == 0
        except Exception as e:
            logger.error(f"Fehler bei Netzwerk-Check: {e}")
            return False

    def _get_default_gateway(self) -> Optional[str]:
        try:
            result = subprocess.run(
                ['ip', 'route', 'show', 'default'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0 and result.stdout:
                parts = result.stdout.split()
                if len(parts) >= 3 and parts[0] == 'default' and parts[1] == 'via':
                    return parts[2]
            return None
        except Exception as e:
            logger.error(f"Fehler beim Ermitteln des Gateways: {e}")
            return None

    def is_ap_active(self) -> bool:
        """Prüft ob hostapd läuft (pgrep statt systemd-Unit - hostapd wird
        direkt gestartet; der alte systemctl-Check war deshalb immer False
        und liess den AP alle 30 s neu starten)."""
        try:
            result = subprocess.run(['pgrep', '-x', 'hostapd'],
                                    capture_output=True, timeout=5)
            return result.returncode == 0
        except Exception:
            return False

    # ---------- AP an/aus (läuft als root auf dem Host - kein sudo) ----------

    def enable_access_point(self) -> bool:
        if self.ap_active and self.is_ap_active():
            logger.info("Access Point ist bereits aktiv")
            return True

        logger.info("Aktiviere Access Point Modus...")
        try:
            # 1. WiFi-Client freigeben: auf NetworkManager-Hosts wlan0 auf
            # unmanaged stellen (NM würde sonst dazwischenfunken); sonst
            # klassisch wpa_supplicant stoppen
            if self.has_nmcli:
                subprocess.run(['nmcli', 'dev', 'set', 'wlan0', 'managed', 'no'],
                               capture_output=True, timeout=10)
            else:
                subprocess.run(['systemctl', 'stop', 'wpa_supplicant'], timeout=10)

            # 2. wlan0 mit statischer IP
            subprocess.run(['ip', 'addr', 'flush', 'dev', 'wlan0'], timeout=5)
            subprocess.run([
                'ip', 'addr', 'add',
                f"{self.config['ip_address']}/{self._netmask_to_cidr(self.config['netmask'])}",
                'dev', 'wlan0'
            ], timeout=5)
            subprocess.run(['ip', 'link', 'set', 'wlan0', 'up'], timeout=5)

            # 3./4. Konfigurationen schreiben
            hostapd_conf_path = '/tmp/catboter_hostapd.conf'
            with open(hostapd_conf_path, 'w') as f:
                f.write(self._generate_hostapd_config())
            dnsmasq_conf_path = '/tmp/catboter_dnsmasq.conf'
            with open(dnsmasq_conf_path, 'w') as f:
                f.write(self._generate_dnsmasq_config())

            # 5. dnsmasq starten (alte Instanz vorher beenden)
            self._stop_dnsmasq()
            dnsmasq_result = subprocess.run([
                'dnsmasq', '-C', dnsmasq_conf_path,
                '-x', '/var/run/catboter_dnsmasq.pid'
            ], capture_output=True, text=True, timeout=10)
            if dnsmasq_result.returncode != 0:
                logger.error(f"dnsmasq-Start fehlgeschlagen: {dnsmasq_result.stderr.strip()}")

            # 6. hostapd starten
            hostapd_result = subprocess.run(
                ['hostapd', hostapd_conf_path, '-B'],
                capture_output=True, text=True, timeout=15
            )
            if hostapd_result.returncode != 0:
                logger.error(f"hostapd-Start fehlgeschlagen: {hostapd_result.stderr.strip()}")

            time.sleep(3)

            if self.is_ap_active():
                self.ap_active = True
                logger.info(f"Access Point aktiv: SSID='{self.config['ssid']}' | IP={self.config['ip_address']}")
                return True
            logger.error("Access Point konnte nicht gestartet werden")
            return False
        except Exception as e:
            logger.error(f"Fehler beim Aktivieren des Access Points: {e}")
            return False

    def _stop_dnsmasq(self):
        try:
            if os.path.exists('/var/run/catboter_dnsmasq.pid'):
                with open('/var/run/catboter_dnsmasq.pid') as f:
                    pid = f.read().strip()
                if pid.isdigit():
                    subprocess.run(['kill', pid], capture_output=True, timeout=5)
                os.remove('/var/run/catboter_dnsmasq.pid')
        except Exception as e:
            logger.debug(f"dnsmasq-Stop: {e}")

    def disable_access_point(self) -> bool:
        logger.info("Deaktiviere Access Point Modus...")
        try:
            subprocess.run(['pkill', '-x', 'hostapd'], capture_output=True, timeout=5)
            self._stop_dnsmasq()
            subprocess.run(['ip', 'addr', 'flush', 'dev', 'wlan0'], timeout=5)
            if self.has_nmcli:
                # NetworkManager übernimmt wlan0 wieder und verbindet sich
                # automatisch mit dem bekannten WLAN
                subprocess.run(['nmcli', 'dev', 'set', 'wlan0', 'managed', 'yes'],
                               capture_output=True, timeout=10)
                subprocess.run(['nmcli', 'dev', 'connect', 'wlan0'],
                               capture_output=True, timeout=30)
            else:
                subprocess.run(['systemctl', 'start', 'wpa_supplicant'], timeout=10)
                subprocess.run(['systemctl', 'restart', 'dhcpcd'], capture_output=True, timeout=10)

            time.sleep(5)
            self.ap_active = False
            logger.info("Access Point deaktiviert, WiFi Client Modus wiederhergestellt")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Deaktivieren des Access Points: {e}")
            return False

    def _generate_hostapd_config(self) -> str:
        return f"""# CatBoter Fallback Access Point Configuration
interface=wlan0
driver=nl80211
ssid={self.config['ssid']}
hw_mode=g
channel={self.config['channel']}
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase={self.config['password']}
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
"""

    def _generate_dnsmasq_config(self) -> str:
        return f"""# CatBoter Fallback DHCP/DNS Configuration
interface=wlan0
dhcp-range={self.config['dhcp_range_start']},{self.config['dhcp_range_end']},255.255.255.0,24h
dhcp-option=3,{self.config['ip_address']}
dhcp-option=6,{self.config['ip_address']}
server=8.8.8.8
listen-address={self.config['ip_address']}

# Captive Portal - alle DNS Anfragen zu uns umleiten
address=/#/{self.config['ip_address']}
"""

    def _netmask_to_cidr(self, netmask: str) -> int:
        return sum(bin(int(x)).count('1') for x in netmask.split('.'))

    # ---------- Hauptschleife ----------

    def run_monitoring_loop(self):
        logger.info("WiFi Fallback Monitoring gestartet")
        logger.info(f"   Daten-Verzeichnis: {self.data_dir}")
        logger.info(f"   Check-Interval: {self.config['check_interval']}s")
        logger.info(f"   Fallback AP SSID: {self.config['ssid']}")

        # Schneller Tick (2 s) für interaktive Befehle (z. B. WLAN-Verbinden aus
        # der App); der Netzwerk-Check läuft nur alle check_interval Sekunden
        TICK = 2
        last_check = 0.0
        while True:
            try:
                self._reload_config_if_changed()

                # Manuelle Befehle vom Backend
                command = self.consume_command()
                if command:
                    name = command.get('command')
                    if name == 'enable_ap':
                        logger.info("Befehl vom Backend: enable_ap")
                        ok = self.enable_access_point()
                        self.write_result('enable_ap', ok,
                                          'Hotspot aktiv' if ok else 'Hotspot-Start fehlgeschlagen')
                    elif name == 'disable_ap':
                        logger.info("Befehl vom Backend: disable_ap")
                        ok = self.disable_access_point()
                        self.failed_checks = 0
                        self.write_result('disable_ap', ok,
                                          'Hotspot deaktiviert' if ok else 'Fehler beim Deaktivieren')
                    elif name == 'connect_wifi':
                        logger.info("Befehl vom Backend: connect_wifi")
                        self.connect_wifi(command.get('ssid', ''), command.get('password', ''))
                    self.write_status()

                now = time.time()
                if now - last_check >= max(int(self.config['check_interval']), 10):
                    last_check = now
                    if self.config['enabled'] and not self.ap_active:
                        if self.is_network_connected():
                            self.failed_checks = 0
                        else:
                            self.failed_checks += 1
                            logger.warning(f"Netzwerk nicht verbunden "
                                           f"(Versuch {self.failed_checks}/{self.max_failed_checks})")
                            if self.failed_checks >= self.max_failed_checks:
                                logger.warning("Netzwerk dauerhaft verloren - aktiviere AP")
                                self.enable_access_point()
                    elif self.config['enabled'] and self.ap_active:
                        # AP-Zustand mit Realität abgleichen (hostapd kann sterben)
                        self.ap_active = self.is_ap_active()
                    self.write_status()

                time.sleep(TICK)

            except KeyboardInterrupt:
                logger.info("Monitoring beendet durch Benutzer")
                if self.ap_active:
                    self.disable_access_point()
                self.write_status()
                break
            except Exception as e:
                logger.error(f"Fehler im Monitoring Loop: {e}")
                time.sleep(TICK)


def main():
    parser = argparse.ArgumentParser(description="CatBoter WiFi-Fallback Host-Service")
    parser.add_argument('--data-dir', default=str(DEFAULT_DATA_DIR),
                        help='Verzeichnis für Config-/Status-/Command-Dateien '
                             '(muss dem Docker-Mount /app/data entsprechen)')
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    manager = WiFiFallbackManager(Path(args.data_dir))
    manager.run_monitoring_loop()


if __name__ == '__main__':
    main()
