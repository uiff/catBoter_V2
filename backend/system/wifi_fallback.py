#!/usr/bin/env python3
"""
WiFi Fallback System - Automatischer Access Point bei verlorener Verbindung

Dieses Modul überwacht die WiFi-Verbindung und aktiviert automatisch einen
Access Point (Hotspot), wenn keine Verbindung zum konfigurierten Netzwerk
besteht.

Features:
- Überwacht WiFi-Verbindung alle 30 Sekunden
- Aktiviert Access Point nach 3 fehlgeschlagenen Versuchen
- Deaktiviert Access Point automatisch wenn WiFi wiederhergestellt
- Konfigurierbar über JSON-Datei
"""

import subprocess
import time
import logging
import json
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class WiFiFallbackManager:
    """
    Verwaltet automatischen WiFi-Fallback zu Access Point Modus
    """

    def __init__(self, config_path: str = "backend/data/wifi_fallback_config.json"):
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.ap_active = False
        self.failed_checks = 0
        self.max_failed_checks = 3  # Nach 3 Fehlversuchen (90 Sekunden) AP aktivieren

    def _load_config(self) -> dict:
        """Lädt Konfiguration oder erstellt Standard-Konfiguration"""
        default_config = {
            "enabled": True,
            "ssid": "CatBoter-Setup",
            "password": "catboter123",
            "ip_address": "10.0.0.1",
            "netmask": "255.255.255.0",
            "dhcp_range_start": "10.0.0.10",
            "dhcp_range_end": "10.0.0.50",
            "channel": 6,
            "check_interval": 30  # Sekunden
        }

        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                    # Merge mit defaults falls Keys fehlen
                    return {**default_config, **config}
            except Exception as e:
                logger.error(f"Fehler beim Laden der Config: {e}")
                return default_config
        else:
            # Erstelle Config-Datei
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, 'w') as f:
                json.dump(default_config, f, indent=2)
            return default_config

    def save_config(self):
        """Speichert aktuelle Konfiguration"""
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Config: {e}")

    def is_wifi_connected(self) -> bool:
        """
        Prüft ob WiFi-Verbindung besteht

        Returns:
            bool: True wenn verbunden, False sonst
        """
        try:
            # Methode 1: Prüfe ob wlan0 eine IP hat
            result = subprocess.run(
                ['ip', 'addr', 'show', 'wlan0'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                # Prüfe ob "inet " (IPv4) in der Ausgabe ist
                if 'inet ' in result.stdout:
                    # Zusätzlich: Versuche Internet-Verbindung zu prüfen
                    # Ping zu lokalem Gateway (Router)
                    gateway = self._get_default_gateway()
                    if gateway:
                        ping_result = subprocess.run(
                            ['ping', '-c', '1', '-W', '2', gateway],
                            capture_output=True,
                            timeout=5
                        )
                        if ping_result.returncode == 0:
                            logger.debug("WiFi verbunden und Gateway erreichbar")
                            return True
                    else:
                        # Kein Gateway = nicht verbunden
                        logger.debug("WiFi IP vorhanden, aber kein Gateway")
                        return False

            logger.debug("WiFi nicht verbunden")
            return False

        except Exception as e:
            logger.error(f"Fehler bei WiFi-Check: {e}")
            return False

    def _get_default_gateway(self) -> Optional[str]:
        """Ermittelt Standard-Gateway IP"""
        try:
            result = subprocess.run(
                ['ip', 'route', 'show', 'default'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0 and result.stdout:
                # Format: "default via 192.168.1.1 dev wlan0"
                parts = result.stdout.split()
                if len(parts) >= 3 and parts[0] == 'default' and parts[1] == 'via':
                    return parts[2]

            return None
        except Exception as e:
            logger.error(f"Fehler beim Ermitteln des Gateways: {e}")
            return None

    def is_ap_active(self) -> bool:
        """
        Prüft ob Access Point bereits aktiv ist

        Returns:
            bool: True wenn AP aktiv
        """
        try:
            # Prüfe ob hostapd läuft
            result = subprocess.run(
                ['systemctl', 'is-active', 'hostapd'],
                capture_output=True,
                text=True,
                timeout=5
            )

            return result.returncode == 0 and result.stdout.strip() == 'active'

        except Exception as e:
            logger.debug(f"AP Status-Check: {e}")
            return False

    def enable_access_point(self) -> bool:
        """
        Aktiviert Access Point Modus

        Returns:
            bool: True bei Erfolg
        """
        if self.ap_active:
            logger.info("Access Point ist bereits aktiv")
            return True

        logger.info("🔧 Aktiviere Access Point Modus...")

        try:
            # 1. Stoppe wpa_supplicant (WiFi Client)
            logger.debug("Stoppe WiFi Client Modus...")
            subprocess.run(['sudo', 'systemctl', 'stop', 'wpa_supplicant'], timeout=10)

            # 2. Konfiguriere wlan0 mit statischer IP
            logger.debug(f"Konfiguriere wlan0 mit IP {self.config['ip_address']}...")
            subprocess.run([
                'sudo', 'ip', 'addr', 'flush', 'dev', 'wlan0'
            ], timeout=5)

            subprocess.run([
                'sudo', 'ip', 'addr', 'add',
                f"{self.config['ip_address']}/{self._netmask_to_cidr(self.config['netmask'])}",
                'dev', 'wlan0'
            ], timeout=5)

            subprocess.run(['sudo', 'ip', 'link', 'set', 'wlan0', 'up'], timeout=5)

            # 3. Erstelle hostapd Konfiguration
            hostapd_conf = self._generate_hostapd_config()
            hostapd_conf_path = '/tmp/catboter_hostapd.conf'

            with open(hostapd_conf_path, 'w') as f:
                f.write(hostapd_conf)

            # 4. Erstelle dnsmasq Konfiguration (DHCP + DNS)
            dnsmasq_conf = self._generate_dnsmasq_config()
            dnsmasq_conf_path = '/tmp/catboter_dnsmasq.conf'

            with open(dnsmasq_conf_path, 'w') as f:
                f.write(dnsmasq_conf)

            # 5. Starte dnsmasq
            logger.debug("Starte DHCP Server (dnsmasq)...")
            subprocess.run([
                'sudo', 'dnsmasq',
                '-C', dnsmasq_conf_path,
                '-x', '/var/run/catboter_dnsmasq.pid'
            ], timeout=10)

            # 6. Starte hostapd
            logger.debug("Starte Access Point (hostapd)...")
            subprocess.Popen([
                'sudo', 'hostapd',
                hostapd_conf_path,
                '-B'  # Background
            ])

            time.sleep(3)  # Warte auf Start

            # 7. Prüfe ob erfolgreich
            if self.is_ap_active():
                self.ap_active = True
                logger.info(f"✅ Access Point aktiv: SSID='{self.config['ssid']}' | IP={self.config['ip_address']}")
                logger.info(f"   Verbinden Sie sich mit dem WiFi und öffnen Sie: http://{self.config['ip_address']}:5173")
                return True
            else:
                logger.error("❌ Access Point konnte nicht gestartet werden")
                return False

        except Exception as e:
            logger.error(f"Fehler beim Aktivieren des Access Points: {e}")
            return False

    def disable_access_point(self) -> bool:
        """
        Deaktiviert Access Point und kehrt zu WiFi Client zurück

        Returns:
            bool: True bei Erfolg
        """
        if not self.ap_active:
            logger.debug("Access Point ist bereits deaktiviert")
            return True

        logger.info("🔧 Deaktiviere Access Point Modus...")

        try:
            # 1. Stoppe hostapd
            subprocess.run(['sudo', 'pkill', 'hostapd'], timeout=5)

            # 2. Stoppe dnsmasq
            if os.path.exists('/var/run/catboter_dnsmasq.pid'):
                with open('/var/run/catboter_dnsmasq.pid', 'r') as f:
                    pid = f.read().strip()
                    subprocess.run(['sudo', 'kill', pid], timeout=5)

            # 3. Entferne statische IP
            subprocess.run(['sudo', 'ip', 'addr', 'flush', 'dev', 'wlan0'], timeout=5)

            # 4. Starte wpa_supplicant neu (WiFi Client)
            subprocess.run(['sudo', 'systemctl', 'start', 'wpa_supplicant'], timeout=10)
            subprocess.run(['sudo', 'systemctl', 'restart', 'dhcpcd'], timeout=10)

            time.sleep(5)  # Warte auf WiFi-Verbindung

            self.ap_active = False
            logger.info("✅ Access Point deaktiviert, WiFi Client Modus wiederhergestellt")
            return True

        except Exception as e:
            logger.error(f"Fehler beim Deaktivieren des Access Points: {e}")
            return False

    def _generate_hostapd_config(self) -> str:
        """Generiert hostapd Konfigurationsdatei"""
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
        """Generiert dnsmasq Konfigurationsdatei"""
        return f"""# CatBoter Fallback DHCP/DNS Configuration
interface=wlan0
dhcp-range={self.config['dhcp_range_start']},{self.config['dhcp_range_end']},255.255.255.0,24h
dhcp-option=3,{self.config['ip_address']}
dhcp-option=6,{self.config['ip_address']}
server=8.8.8.8
log-queries
log-dhcp
listen-address={self.config['ip_address']}

# Captive Portal - alle DNS Anfragen zu uns umleiten
address=/#/{self.config['ip_address']}
"""

    def _netmask_to_cidr(self, netmask: str) -> int:
        """Konvertiert Netzmaske zu CIDR Notation"""
        return sum([bin(int(x)).count('1') for x in netmask.split('.')])

    def run_monitoring_loop(self):
        """
        Hauptschleife: Überwacht WiFi und schaltet bei Bedarf auf AP um

        Diese Methode läuft in Dauerschleife und sollte in eigenem Thread
        oder als systemd Service gestartet werden.
        """
        if not self.config['enabled']:
            logger.info("WiFi Fallback System ist deaktiviert")
            return

        logger.info("🔄 WiFi Fallback Monitoring gestartet")
        logger.info(f"   Check-Interval: {self.config['check_interval']}s")
        logger.info(f"   Fallback AP SSID: {self.config['ssid']}")

        while True:
            try:
                # Prüfe WiFi-Verbindung
                wifi_connected = self.is_wifi_connected()

                if wifi_connected:
                    # WiFi verbunden
                    self.failed_checks = 0

                    # Wenn AP aktiv, deaktiviere ihn
                    if self.ap_active:
                        logger.info("📡 WiFi-Verbindung wiederhergestellt!")
                        self.disable_access_point()

                else:
                    # WiFi nicht verbunden
                    self.failed_checks += 1
                    logger.warning(f"⚠️  WiFi nicht verbunden (Versuch {self.failed_checks}/{self.max_failed_checks})")

                    # Nach mehreren Fehlversuchen: AP aktivieren
                    if self.failed_checks >= self.max_failed_checks and not self.ap_active:
                        logger.warning("🔴 WiFi-Verbindung dauerhaft verloren!")
                        self.enable_access_point()

                # Warte bis zum nächsten Check
                time.sleep(self.config['check_interval'])

            except KeyboardInterrupt:
                logger.info("Monitoring beendet durch Benutzer")
                if self.ap_active:
                    self.disable_access_point()
                break
            except Exception as e:
                logger.error(f"Fehler im Monitoring Loop: {e}")
                time.sleep(self.config['check_interval'])


def main():
    """Hauptfunktion für standalone Ausführung"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    manager = WiFiFallbackManager()
    manager.run_monitoring_loop()


if __name__ == '__main__':
    main()
