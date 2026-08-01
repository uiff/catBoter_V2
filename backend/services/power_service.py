"""Neustart/Herunterfahren - Container-Realität statt sudo/systemctl.

- Backend-Neustart: sauberer Prozess-Exit; Docker (`restart: unless-stopped`)
  startet den Container neu.
- Host-Reboot/Shutdown: sysrq-Trigger im privileged Container
  (sync -> remount-ro -> reboot/poweroff). Hart, aber gesynct - die alte
  sudo/systemctl-Variante konnte den Host aus dem Container nie erreichen.
"""
import logging
import os
import threading
import time

from services import hardware


def _delayed(fn, delay=1.0):
    t = threading.Timer(delay, fn)
    t.daemon = True
    t.start()


def restart_backend():
    """Beendet den Prozess nach kurzer Verzögerung (Antwort geht noch raus)."""
    def _exit():
        try:
            hardware.cleanup()
        except Exception:
            pass
        logging.info("Backend-Neustart: Prozess beendet sich, Docker startet neu")
        os._exit(0)
    _delayed(_exit, 1.0)


def _sysrq(commands):
    try:
        with open('/proc/sys/kernel/sysrq', 'w') as f:
            f.write('1')
        for cmd in commands:
            with open('/proc/sysrq-trigger', 'w') as f:
                f.write(cmd)
            time.sleep(1)
        return True
    except OSError as e:
        logging.error(f"sysrq fehlgeschlagen: {e}")
        return False


def reboot_host():
    def _go():
        try:
            hardware.cleanup()
        except Exception:
            pass
        _sysrq(['s', 'u', 'b'])  # sync, remount-ro, reboot
    _delayed(_go, 1.0)


def shutdown_host():
    def _go():
        try:
            hardware.cleanup()
        except Exception:
            pass
        _sysrq(['s', 'u', 'o'])  # sync, remount-ro, poweroff
    _delayed(_go, 1.0)
