"""System-Infos (CPU, Temperatur, RAM, Disk, Netzwerk) - sudo-frei.

Ersetzt das nie geladene System-Modul (der alte Import `from System import system`
schlug auf Linux wegen Gross-/Kleinschreibung immer fehl).
"""
import logging
import socket
import subprocess

import psutil


def get_cpu_percent():
    # interval=None: nicht-blockierend (der alte 1s-interval blockierte jede Anfrage)
    return psutil.cpu_percent(interval=None)


def get_cpu_temperature():
    try:
        with open('/sys/class/thermal/thermal_zone0/temp') as f:
            return round(int(f.read().strip()) / 1000, 1)
    except (OSError, ValueError):
        pass
    try:
        out = subprocess.check_output(['vcgencmd', 'measure_temp'], timeout=3).decode()
        return float(out.replace('temp=', '').replace("'C\n", ''))
    except Exception:
        return None


def get_memory_info():
    mem = psutil.virtual_memory()
    return {
        'total': mem.total,
        'available': mem.available,
        'percent': mem.percent,
        'used': mem.used,
        'free': mem.free,
    }


def get_disk_info():
    disk = psutil.disk_usage('/')
    return {
        'total': disk.total,
        'used': disk.used,
        'free': disk.free,
        'percent': round(disk.used / disk.total * 100, 1),
    }


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def get_wifi_ssid(interface='wlan0'):
    try:
        result = subprocess.run(['iwgetid', '-r'], capture_output=True, text=True, timeout=3)
        ssid = result.stdout.strip()
        return ssid or None
    except Exception as e:
        logging.debug(f"iwgetid fehlgeschlagen: {e}")
        return None


def get_wifi_signal(interface='wlan0'):
    """Signalstärke in dBm oder None."""
    try:
        result = subprocess.run(['iwconfig', interface], capture_output=True, text=True, timeout=3)
        for part in result.stdout.split():
            if part.startswith('level='):
                return int(float(part.split('=')[1]))
    except Exception:
        pass
    return None


def get_interfaces():
    """Status je Interface (eth0/wlan0): Link up + IPv4-Adresse."""
    result = {}
    try:
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()
        for iface in ('eth0', 'wlan0'):
            ip = None
            for addr in addrs.get(iface, []):
                if addr.family == socket.AF_INET:
                    ip = addr.address
                    break
            stat = stats.get(iface)
            result[iface] = {'up': bool(stat and stat.isup), 'ip': ip}
    except Exception as e:
        logging.debug(f"Interface-Status fehlgeschlagen: {e}")
    return result


def get_network_info():
    return {
        'current_ip': get_local_ip(),
        'wifi_ssid': get_wifi_ssid(),
        'wifi_signal_dbm': get_wifi_signal(),
        'interfaces': get_interfaces(),
    }
