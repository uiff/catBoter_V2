import os
import subprocess
import getpass
import sys

SERVICE_NAME = "catboter_autostart"
SERVICE_FILE = f"/etc/systemd/system/{SERVICE_NAME}.service"
SCRIPT_PATH = "/home/iotueli/Desktop/catBoterV3/start.py"
USER_NAME = "iotueli"
WORKING_DIR = "/home/iotueli/Desktop/catBoterV3"

service_content = f"""[Unit]
Description=CatBoter Autostart
After=network.target

[Service]
Type=simple
User={USER_NAME}
WorkingDirectory={WORKING_DIR}
ExecStart=/usr/bin/python3 {SCRIPT_PATH}
Restart=on-failure

[Install]
WantedBy=multi-user.target
"""

def require_root():
    if os.geteuid() != 0:
        print("Dieses Skript muss mit root-Rechten ausgeführt werden (sudo).")
        sys.exit(1)

def write_service_file():
    with open(SERVICE_FILE, "w") as f:
        f.write(service_content)
    print(f"Service-Datei geschrieben: {SERVICE_FILE}")

def enable_and_start_service():
    subprocess.run(["systemctl", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "enable", SERVICE_NAME], check=True)
    subprocess.run(["systemctl", "start", SERVICE_NAME], check=True)
    print(f"Service {SERVICE_NAME} aktiviert und gestartet.")

def show_status():
    subprocess.run(["systemctl", "status", SERVICE_NAME, "--no-pager"])

if __name__ == "__main__":
    require_root()
    write_service_file()
    enable_and_start_service()
    show_status()
