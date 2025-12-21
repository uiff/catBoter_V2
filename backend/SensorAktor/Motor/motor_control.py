import RPi.GPIO as GPIO
import time
from threading import Thread, Timer

class MotorDriverGPIO:
    def __init__(self, dir_pin=26, step_pin=21, enable_pin=4):
        self.dir_pin = dir_pin
        self.step_pin = step_pin
        self.enable_pin = enable_pin

        # GPIO Setup
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.dir_pin, GPIO.OUT)
        GPIO.setup(self.step_pin, GPIO.OUT)
        GPIO.setup(self.enable_pin, GPIO.OUT)
        
        # Motor standardmäßig deaktivieren
        GPIO.output(self.enable_pin, GPIO.HIGH)  # HIGH = Deaktiviert, LOW = Aktiviert
    
    def TurnStep(self, Dir='forward', steps=200, stepdelay=0.00009):
        """
        Motor dreht sich um 'steps' Schritte.
        :param Dir: 'forward' oder 'backward'
        :param steps: Anzahl der Schritte
        :param stepdelay: Verzögerung zwischen den Schritten
        """
        # Motor aktivieren
        GPIO.output(self.enable_pin, GPIO.LOW)
        
        # Richtung setzen
        if Dir == 'forward':
            GPIO.output(self.dir_pin, GPIO.HIGH)
        else:
            GPIO.output(self.dir_pin, GPIO.LOW)

        # Schritte ausführen
        for _ in range(steps):
            GPIO.output(self.step_pin, GPIO.HIGH)
            time.sleep(stepdelay)
            GPIO.output(self.step_pin, GPIO.LOW)
            time.sleep(stepdelay)
    
    def Stop(self):
        """Motor deaktivieren"""
        GPIO.output(self.enable_pin, GPIO.HIGH)


class MotorController:
    TOTAL_ROTATION = 200  # aus US-17HS441S Schrittmotor-Spezifikation (200 Schritte pro Umdrehung)
    
    def __init__(self, gewichtssensor=None):
        # Statt DRV8825 nutzen wir jetzt die GPIO-basierte Ansteuerung
        self.Motor1 = MotorDriverGPIO(dir_pin=26, step_pin=21, enable_pin=4)

        # Werte aus deinem ursprünglichen Skript
        self.running = False
        self.stop_timer = None
        self.full_rotation = 0
        self.max_weight_in_g = 1000
        self.gewichtssensor = gewichtssensor

    def feed_until_weight(self, target_weight_grams, timeout_seconds=300):
        """
        Dreht den Motor, bis das gewünschte Gewicht erreicht ist oder Timeout.
        Gibt (success, message) zurück.
        """
        if not self.gewichtssensor:
            return False, "Kein Gewichtssensor vorhanden"

        start_time = time.time()
        initial_weight = self.gewichtssensor.get_weight()
        last_weight = initial_weight
        fed_amount = 0.0

        try:
            while time.time() - start_time < timeout_seconds:
                current_weight = self.gewichtssensor.get_weight()
                fed_amount = current_weight - initial_weight
                if fed_amount >= target_weight_grams:
                    self.Motor1.Stop()
                    return True, f"{fed_amount:.1f}g gefüttert (Soll: {target_weight_grams}g)"
                # Langer Vorwärtsschritt
                self.Motor1.TurnStep(Dir='forward', steps=200, stepdelay=0.0005)
                time.sleep(0.2)  # Kurze Pause, damit der Motor zur Ruhe kommt
                # Noch längerer und langsamer Rückwärtsschritt zum Lockern
                self.Motor1.TurnStep(Dir='backward', steps=100, stepdelay=0.002)
                time.sleep(0.05)
            self.Motor1.Stop()
            return False, f"Timeout: Nur {fed_amount:.1f}g gefüttert (Soll: {target_weight_grams}g)"
        except Exception as e:
            self.Motor1.Stop()
            return False, f"Fehler beim Füttern: {e}"

    def update_full_rotation(self, rotation_value: int):
        """
        Aktualisiert den Wert der 'vollen Umdrehung' abhängig von den Schritten.
        """
        self.full_rotation = (self.full_rotation + rotation_value) % self.TOTAL_ROTATION

    def rotational_difference(self):
        return (self.TOTAL_ROTATION - self.full_rotation) % self.TOTAL_ROTATION
    
    def status(self):
        return self.running

    def rotate_motor(self, forewardSteps=1500, backwardSteps=200, full_rotation_counts=10):
        """
        Startet den Motor: 
        - Zuerst vorwärts (forward) um forewardSteps Schritte (lange Förderrichtung)
        - Danach rückwärts (backward) um backwardSteps Schritte (kurzes Lösen)
        - Wiederholt das Ganze full_rotation_counts-mal
        - Beendet sich automatisch nach 2 Minuten über einen Timer oder 
          wenn das Gewicht (falls Sensor vorhanden) zu hoch ist
        """
        self.running = True
        
        def run_motor():
            total_runs = 0
            while self.running:
                if total_runs == full_rotation_counts:
                    break

                # Gewichtssensor-Abfrage (falls vorhanden)
                if self.gewichtssensor:
                    current_weight = self.gewichtssensor.get_weight()
                    print("aktuelles Gewicht [g]:", current_weight)
                    if current_weight > self.max_weight_in_g:
                        break

                # Lange Förderrichtung (vorwärts)
                self.Motor1.TurnStep(Dir='forward',
                                     steps=forewardSteps,
                                     stepdelay=0.001)
                time.sleep(0.5)
                self.update_full_rotation(forewardSteps)

                # Kurzes Lösen (rückwärts)
                self.Motor1.TurnStep(Dir='backward',
                                     steps=backwardSteps,
                                     stepdelay=0.001)
                time.sleep(0.5)
                self.update_full_rotation(-backwardSteps)

                total_runs += 1

            # Am Ende anhalten
            self.Motor1.Stop()

        # Motor in einem eigenen Thread laufen lassen
        motor_thread = Thread(target=run_motor)
        motor_thread.start()
        
        # Timer für 2 Minuten
        self.stop_timer = Timer(120, self.stop_motor)
        self.stop_timer.start()

    def stop_motor(self):
        """Beendet die Motorbewegung."""
        self.running = False
        if self.stop_timer:
            self.stop_timer.cancel()
        self.Motor1.Stop()


if __name__ == "__main__":
    try:
        motor_controller = MotorController()
        motor_controller.rotate_motor()

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        motor_controller.stop_motor()
        GPIO.cleanup()
    finally:
        GPIO.cleanup()
