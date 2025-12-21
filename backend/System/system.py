import psutil
import subprocess
import socket
import re
import logging
import json
import threading
import time
from pathlib import Path

# Konfiguriere Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Thread-Sicherheit für Netzwerk-Operationen
network_lock = threading.Lock()

def get_cpu_info():
    """Holt CPU-Auslastung mit Fehlerbehandlung"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        return round(cpu_percent, 2)
    except Exception as e:
        logging.error(f"Fehler bei CPU-Info: {e}")
        return None

def get_cpu_temperature():
    """Holt CPU-Temperatur mit verbesserter Fehlerbehandlung"""
    try:
        result = subprocess.run(
            ["vcgencmd", "measure_temp"], 
            capture_output=True, 
            text=True, 
            timeout=5  # Timeout nach 5 Sekunden
        )
        if result.returncode == 0:
            temp_str = result.stdout.strip()
            temp = float(temp_str.replace("temp=", "").replace("'C", ""))
            return round(temp, 1)
        else:
            logging.warning(f"vcgencmd Fehler: {result.stderr}")
            return None
    except subprocess.TimeoutExpired:
        logging.error("Timeout bei CPU-Temperatur-Abfrage")
        return None
    except subprocess.CalledProcessError as e:
        logging.error(f"Fehler bei der Abfrage der CPU-Temperatur: {e}")
        return None
    except ValueError as e:
        logging.error(f"Fehler bei der Verarbeitung der Temperaturdaten: {e}")
        return None
    except FileNotFoundError:
        logging.warning("Befehl 'vcgencmd' nicht gefunden (läuft nicht auf Raspberry Pi?)")
        return None
    except Exception as e:
        logging.error(f"Unerwarteter Fehler bei CPU-Temperatur: {e}")
        return None

def get_ram_info():
    """Holt RAM-Informationen mit Fehlerbehandlung"""
    try:
        mem = psutil.virtual_memory()
        return {
            'total': round(mem.total / (1024 ** 2), 2),  # MB
            'available': round(mem.available / (1024 ** 2), 2),
            'percent': round(mem.percent, 2),
            'used': round(mem.used / (1024 ** 2), 2),
            'free': round(mem.free / (1024 ** 2), 2)
        }
    except Exception as e:
        logging.error(f"Fehler bei RAM-Info: {e}")
        return None

def get_disk_info(path='/'):
    """Holt Festplatten-Informationen mit konfigurierbarem Pfad"""
    try:
        disk = psutil.disk_usage(path)
        return {
            'total': round(disk.total / (1024 ** 3), 2),  # GB
            'used': round(disk.used / (1024 ** 3), 2),
            'free': round(disk.free / (1024 ** 3), 2),
            'percent': round(disk.percent, 2),
            'path': path
        }
    except Exception as e:
        logging.error(f"Fehler bei Festplatten-Info für {path}: {e}")
        return None

def get_network_info():
    """
    Thread-sichere Netzwerk-Informationen mit verbesserter Fehlerbehandlung
    """
    with network_lock:
        interfaces = {}
        
        try:
            # IP-Adressen über 'ip a' abrufen
            result = subprocess.run(
                ['ip', 'a'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            if result.returncode == 0:
                interfaces = _parse_ip_output(result.stdout)
            else:
                logging.warning("'ip a' Befehl fehlgeschlagen")
        except subprocess.TimeoutExpired:
            logging.error("Timeout bei Netzwerk-Info-Abfrage")
        except subprocess.CalledProcessError as e:
            logging.error(f"Fehler beim Abrufen der Netzwerkinformationen: {e}")
        except Exception as e:
            logging.error(f"Unerwarteter Fehler bei Netzwerk-Info: {e}")

        # WLAN SSID hinzufügen
        interfaces['wifi_ssid'] = get_wifi_ssid()

        # Aktuelle IP-Adresse hinzufügen
        try:
            # Versuche verschiedene Methoden für die aktuelle IP
            current_ip = _get_current_ip()
            if current_ip:
                interfaces['current_ip'] = current_ip
        except Exception as e:
            logging.warning(f"Fehler beim Ermitteln der aktuellen IP: {e}")

        return interfaces

def _parse_ip_output(output):
    """Parst die Ausgabe von 'ip a'"""
    interfaces = {}
    ip_regex = re.compile(r'inet (\d+\.\d+\.\d+\.\d+)')
    
    current_interface = None
    for line in output.splitlines():
        # Interface-Namen erkennen
        if ': eth0' in line:
            current_interface = 'eth0'
            interfaces[current_interface] = {}
        elif ': wlan0' in line:
            current_interface = 'wlan0'  
            interfaces[current_interface] = {}
        elif current_interface and 'inet ' in line:
            # IP-Adresse extrahieren
            match = ip_regex.search(line)
            if match:
                interfaces[current_interface]['ip_address'] = match.group(1)
                # Zusätzliche Informationen
                if 'scope global' in line:
                    interfaces[current_interface]['scope'] = 'global'
                elif 'scope link' in line:
                    interfaces[current_interface]['scope'] = 'link'
    
    return interfaces

def _get_current_ip():
    """Ermittelt die aktuelle IP-Adresse mit mehreren Fallback-Methoden"""
    methods = [
        lambda: socket.gethostbyname(socket.gethostname()),
        lambda: _get_ip_via_route(),
        lambda: _get_ip_via_socket()
    ]
    
    for method in methods:
        try:
            ip = method()
            if ip and ip != '127.0.0.1':
                return ip
        except Exception:
            continue
    
    return None

def _get_ip_via_route():
    """IP über Default-Route ermitteln"""
    try:
        result = subprocess.run(
            ['ip', 'route', 'get', '8.8.8.8'], 
            capture_output=True, 
            text=True, 
            timeout=5
        )
        if result.returncode == 0:
            match = re.search(r'src (\d+\.\d+\.\d+\.\d+)', result.stdout)
            if match:
                return match.group(1)
    except:
        pass
    return None

def _get_ip_via_socket():
    """IP über Socket-Verbindung ermitteln"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except:
        pass
    return None

def get_wifi_ssid():
    """Holt WLAN-SSID mit Fehlerbehandlung"""
    try:
        result = subprocess.run(
            ['iwgetid', '-r'], 
            capture_output=True, 
            text=True, 
            timeout=5
        )
        if result.returncode == 0:
            ssid = result.stdout.strip()
            return ssid if ssid else None
        return None
    except subprocess.TimeoutExpired:
        logging.warning("Timeout bei WLAN-SSID-Abfrage")
        return None
    except subprocess.CalledProcessError:
        logging.debug("Keine WLAN-Verbindung oder iwgetid nicht verfügbar")
        return None
    except Exception as e:
        logging.error(f"Fehler beim Abrufen der WLAN-SSID: {e}")
        return None

def configure_lan(use_dhcp, ip=None, netmask=None, gateway=None, dns=None, interface='eth0'):
    """
    LAN-Konfiguration mit verbesserter Fehlerbehandlung und Validierung
    """
    try:
        # Eingabe-Validierung
        if not use_dhcp:
            if not all([ip, netmask, gateway]):
                raise ValueError("IP, Netmask und Gateway sind für statische Konfiguration erforderlich")
            
            # IP-Adressen validieren
            for addr, name in [(ip, "IP"), (gateway, "Gateway")]:
                try:
                    socket.inet_aton(addr)
                except socket.error:
                    raise ValueError(f"Ungültige {name}-Adresse: {addr}")

        logging.info(f"Konfiguriere {interface} - DHCP: {use_dhcp}")

        if use_dhcp:
            # DHCP aktivieren
            result = subprocess.run(
                ['sudo', 'dhclient', interface], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, "dhclient", result.stderr)
        else:
            # Statische IP konfigurieren
            commands = [
                ['sudo', 'ifconfig', interface, ip, 'netmask', netmask],
                ['sudo', 'route', 'add', 'default', 'gw', gateway]
            ]
            
            for cmd in commands:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                if result.returncode != 0:
                    raise subprocess.CalledProcessError(result.returncode, " ".join(cmd), result.stderr)
            
            # DNS konfigurieren falls angegeben
            if dns:
                try:
                    socket.inet_aton(dns)  # DNS-Adresse validieren
                    with open('/etc/resolv.conf', 'w') as f:
                        f.write(f"nameserver {dns}\n")
                    logging.info(f"DNS auf {dns} gesetzt")
                except (socket.error, PermissionError) as e:
                    logging.warning(f"DNS-Konfiguration fehlgeschlagen: {e}")

        logging.info("LAN-Konfiguration erfolgreich abgeschlossen")
        return True

    except subprocess.CalledProcessError as e:
        error_msg = f"Befehl fehlgeschlagen: {e.stderr}"
        logging.error(f"Fehler bei LAN-Konfiguration: {error_msg}")
        return False
    except ValueError as e:
        logging.error(f"Validierungsfehler: {e}")
        return False
    except Exception as e:
        logging.error(f"Unerwarteter Fehler bei LAN-Konfiguration: {e}")
        return False

def scan_wifi(interface='wlan0', timeout=30):
    """
    WLAN-Scan mit verbesserter Parsing-Logic und Fehlerbehandlung
    """
    networks = []
    try:
        logging.info(f"Starte WLAN-Scan auf {interface}...")
        
        result = subprocess.run(
            ['sudo', 'iwlist', interface, 'scan'], 
            capture_output=True, 
            text=True, 
            timeout=timeout
        )
        
        if result.returncode != 0:
            logging.error(f"iwlist Fehler: {result.stderr}")
            return networks

        networks = _parse_iwlist_output(result.stdout)
        logging.info(f"{len(networks)} WLAN-Netzwerke gefunden")
        
    except subprocess.TimeoutExpired:
        logging.error(f"WLAN-Scan Timeout nach {timeout} Sekunden")
    except subprocess.CalledProcessError as e:
        logging.error(f"Fehler beim Scannen von WLAN-Netzwerken: {e}")
    except Exception as e:
        logging.error(f"Unerwarteter Fehler beim WLAN-Scan: {e}")
    
    return networks

def _parse_iwlist_output(output):
    """Parst iwlist scan Ausgabe robuster"""
    networks = []
    cells = output.split('Cell ')
    
    for cell in cells[1:]:  # Überspringe ersten leeren Teil
        try:
            network = {}
            
            # ESSID extrahieren
            essid_match = re.search(r'ESSID:"([^"]*)"', cell)
            if essid_match:
                network['ssid'] = essid_match.group(1)
            else:
                continue  # Kein ESSID = verstecktes Netzwerk
            
            # Signal Level extrahieren
            signal_match = re.search(r'Signal level=(-?\d+)', cell)
            if signal_match:
                network['signal'] = int(signal_match.group(1))
            else:
                network['signal'] = 0
            
            # Quality extrahieren
            quality_match = re.search(r'Quality=(\d+/\d+)', cell)
            if quality_match:
                network['quality'] = quality_match.group(1)
            else:
                network['quality'] = "0/0"
            
            # Verschlüsselung prüfen
            network['encrypted'] = 'Encryption key:on' in cell
            
            # Verschlüsselungstyp ermitteln
            if 'WPA2' in cell:
                network['encryption_type'] = 'WPA2'
            elif 'WPA' in cell:
                network['encryption_type'] = 'WPA'
            elif 'WEP' in cell:
                network['encryption_type'] = 'WEP'
            elif network['encrypted']:
                network['encryption_type'] = 'Unknown'
            else:
                network['encryption_type'] = 'Open'
            
            # Frequenz extrahieren
            freq_match = re.search(r'Frequency:(\d+\.?\d*) GHz', cell)
            if freq_match:
                network['frequency'] = float(freq_match.group(1))
            
            networks.append(network)
            
        except Exception as e:
            logging.warning(f"Fehler beim Parsen einer WLAN-Zelle: {e}")
            continue
    
    # Nach Signalstärke sortieren (stärkste zuerst)
    networks.sort(key=lambda x: x.get('signal', -100), reverse=True)
    return networks

def connect_wifi(ssid, password, interface='wlan0'):
    """
    WLAN-Verbindung mit sichererer Passwort-Behandlung
    """
    try:
        if not ssid:
            raise ValueError("SSID ist erforderlich")
        
        logging.info(f"Verbinde mit WLAN: {ssid}")
        
        # wpa_supplicant Konfiguration erstellen
        wpa_conf_content = f'''
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=DE

network={{
    ssid="{ssid}"
    {"psk=" + '"' + password + '"' if password else "key_mgmt=NONE"}
}}
'''
        
        # Temporäre Konfigurationsdatei schreiben
        temp_conf = f"/tmp/wpa_supplicant_{int(time.time())}.conf"
        try:
            with open(temp_conf, 'w') as f:
                f.write(wpa_conf_content)
            
            # wpa_supplicant neu konfigurieren
            result = subprocess.run(
                ['sudo', 'wpa_cli', '-i', interface, 'reconfigure'], 
                capture_output=True, 
                text=True, 
                timeout=15
            )
            
            if result.returncode == 0:
                logging.info("WLAN-Verbindung gestartet")
                return True
            else:
                logging.error(f"wpa_cli Fehler: {result.stderr}")
                return False
                
        finally:
            # Temporäre Datei löschen
            try:
                Path(temp_conf).unlink(missing_ok=True)
            except:
                pass
        
    except ValueError as e:
        logging.error(f"WLAN-Verbindung Validierungsfehler: {e}")
        return False
    except Exception as e:
        logging.error(f"Fehler beim Verbinden mit WLAN: {e}")
        return False

def get_hostname():
    """Hostname mit Fehlerbehandlung"""
    try:
        return socket.gethostname()
    except Exception as e:
        logging.error(f"Fehler beim Abrufen des Hostnamens: {e}")
        return "unknown"

def get_interfaces():
    """Netzwerk-Interfaces mit Fehlerbehandlung"""
    try:
        interfaces = list(psutil.net_if_addrs().keys())
        return interfaces
    except Exception as e:
        logging.error(f"Fehler beim Abrufen der Interfaces: {e}")
        return []

def get_system_info():
    """Sammelt alle System-Informationen"""
    return {
        "cpu": {
            "usage_percent": get_cpu_info(),
            "temperature": get_cpu_temperature()
        },
        "memory": get_ram_info(),
        "disk": get_disk_info(),
        "network": get_network_info(),
        "hostname": get_hostname(),
        "interfaces": get_interfaces(),
        "timestamp": time.time()
    }

def monitor_system(interval=60, callback=None):
    """
    Kontinuierliche System-Überwachung
    
    Args:
        interval: Überwachungsintervall in Sekunden
        callback: Funktion die mit System-Info aufgerufen wird
    """
    logging.info(f"Starte System-Monitoring (Intervall: {interval}s)")
    
    while True:
        try:
            info = get_system_info()
            
            if callback:
                callback(info)
            else:
                # Default: Logge wichtige Metriken
                cpu = info.get("cpu", {})
                mem = info.get("memory", {})
                
                logging.info(f"System-Status - CPU: {cpu.get('usage_percent', 'N/A')}%, "
                           f"RAM: {mem.get('percent', 'N/A')}%, "
                           f"Temp: {cpu.get('temperature', 'N/A')}°C")
            
            time.sleep(interval)
            
        except KeyboardInterrupt:
            logging.info("System-Monitoring beendet")
            break
        except Exception as e:
            logging.error(f"Fehler im System-Monitoring: {e}")
            time.sleep(interval)

# Hauptfunktion für Tests
def main():
    """Hauptfunktion für direkten Aufruf"""
    print("=== CatBot System Information ===")
    
    info = get_system_info()
    
    print(f"CPU-Auslastung: {info['cpu']['usage_percent']}%")
    print(f"CPU-Temperatur: {info['cpu']['temperature']}°C")
    print(f"RAM: {info['memory']['percent']}% belegt")
    print(f"Festplatte: {info['disk']['percent']}% belegt")
    print(f"Hostname: {info['hostname']}")
    print(f"Netzwerk-Interfaces: {', '.join(info['interfaces'])}")
    
    network = info['network']
    if 'eth0' in network:
        print(f"Ethernet IP: {network['eth0'].get('ip_address', 'Nicht verbunden')}")
    if 'wlan0' in network:
        print(f"WLAN IP: {network['wlan0'].get('ip_address', 'Nicht verbunden')}")
    if network.get('wifi_ssid'):
        print(f"WLAN SSID: {network['wifi_ssid']}")

if __name__ == "__main__":
    main()