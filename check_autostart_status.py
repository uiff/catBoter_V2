import subprocess

SERVICE_NAME = "catboter_autostart"

def show_status():
    print(f"Status von {SERVICE_NAME}:")
    subprocess.run(["systemctl", "status", SERVICE_NAME, "--no-pager"])

if __name__ == "__main__":
    show_status()
