import os
import subprocess
import sys

SERVICE_NAME = "catboter_autostart"
SERVICE_FILE = f"/etc/systemd/system/{SERVICE_NAME}.service"

def require_root():
    if os.geteuid() != 0:
        print("Dieses Skript muss mit root-Rechten ausgeführt werden (sudo).")
        sys.exit(1)

def stop_and_disable_service():
    subprocess.run(["systemctl", "stop", SERVICE_NAME], check=False)
    subprocess.run(["systemctl", "disable", SERVICE_NAME], check=False)
    print(f"Service {SERVICE_NAME} gestoppt und deaktiviert.")

def remove_service_file():
    if os.path.exists(SERVICE_FILE):
        os.remove(SERVICE_FILE)
        print(f"Service-Datei entfernt: {SERVICE_FILE}")
    else:
        print(f"Service-Datei nicht gefunden: {SERVICE_FILE}")

def reload_systemd():
    subprocess.run(["systemctl", "daemon-reload"], check=True)
    print("systemd neu geladen.")

if __name__ == "__main__":
    require_root()
    stop_and_disable_service()
    remove_service_file()
    reload_systemd()
    print("Autostart deaktiviert.")
