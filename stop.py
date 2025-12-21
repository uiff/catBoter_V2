import subprocess
import os
import signal
import time

def stop_process(name):
    try:
        # Find the process ID (PID) of the running process by its name
        result = subprocess.run(['pgrep', '-f', name], stdout=subprocess.PIPE, text=True)
        pids = result.stdout.split()

        if not pids:
            print(f"No process found with name: {name}")
            return

        # Send the SIGTERM signal to gracefully terminate the processes
        for pid in pids:
            print(f"Attempting to stop process {name} with PID {pid}")
            os.kill(int(pid), signal.SIGTERM)

            # Wait for the process to terminate
            time.sleep(1)

            # Check if the process is still running and force kill if necessary
            try:
                os.kill(int(pid), 0)
                os.kill(int(pid), signal.SIGKILL)
                print(f"Process {name} with PID {pid} was forcefully stopped.")
            except OSError:
                print(f"Process {name} with PID {pid} has been stopped gracefully.")
    except Exception as e:
        print(f"Error stopping process {name}: {e}")

if __name__ == "__main__":
    # Stop the backend
    stop_process('serverWithSwagger.py')
    # Wait a few seconds to ensure the backend has time to stop
    time.sleep(5)
    # Stop the frontend
    stop_process('npm')
    
    print("Both backend and frontend have been stopped.")
