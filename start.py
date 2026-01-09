import subprocess
import os
import time

def start_backend():
    backend_dir = os.path.join(os.getcwd(), 'backend')
    # Start backend with virtual environment activation
    process = subprocess.Popen(['bash', '-c', 'source env/bin/activate && python main.py'], cwd=backend_dir)
    return process

def start_frontend():
    frontend_dir = os.path.join(os.getcwd(), 'frontend-new')
    # Start frontend with dev server
    process = subprocess.Popen(['npm', 'run', 'dev'], cwd=frontend_dir)
    return process

if __name__ == "__main__":
    # Start the backend
    backend_process = start_backend()
    # Wait a few seconds to ensure the backend has time to start
    time.sleep(5)
    # Start the frontend
    frontend_process = start_frontend()

    print("Both backend and frontend have been started.")

    # Keep the script running to show logs
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        backend_process.terminate()
        frontend_process.terminate()
        print("Both backend and frontend have been stopped.")
