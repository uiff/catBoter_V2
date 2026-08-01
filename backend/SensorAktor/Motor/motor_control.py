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
        # Generation-Token: jeder rotate_motor-Lauf bekommt eine neue ID, damit ein
        # überholter (alter) Lauf nicht den Zustand eines neueren Laufs manipuliert
        self._run_id = 0
        # Abbruch-Flag, mit dem stop_motor()/cleanup() auch feed_until_weight beenden kann
        self._abort_feed = False

    # Stillstands-Erkennung: Abbruch, wenn sich das Gewicht über so viele Zyklen
    # (à ca. 1-2 s) überhaupt nicht mehr ändert (Napf entfernt / Sensor eingefroren).
    # Richtungsunabhängig: Auch ein SINKENDES Gewicht (Katze frisst während der
    # Fütterung) zählt als Lebenszeichen und darf die Fütterung nicht abbrechen.
    MAX_STALL_CYCLES = 25
    MIN_CHANGE_GRAMS = 0.5

    def feed_until_weight(self, target_weight_grams, timeout_seconds=300, progress_cb=None):
        """
        Dreht den Motor, bis das gewünschte Gewicht erreicht ist oder Timeout.
        Gibt (success, message, fed_amount) zurück.
        fed_amount ist der PEAK der Nettozunahme (beste je gemessene Förderung) -
        frisst die Katze während der Fütterung, wäre der Endwert sonst zu niedrig
        und ein Retry würde bereits gefressenes Futter erneut fördern.

        progress_cb: optionaler Callback (fed_grams, target_grams, elapsed_s),
        wird einmal pro Regelzyklus aufgerufen. Default None = exakt das
        bisherige Verhalten (Plan-Pfad bleibt unangetastet).
        """
        if not self.gewichtssensor:
            return False, "Kein Gewichtssensor vorhanden", 0.0

        start_time = time.time()
        initial_weight = self.gewichtssensor.get_weight()
        if initial_weight is None:
            return False, "Gewichtssensor liefert keinen Messwert", 0.0
        self._abort_feed = False
        fed_amount = 0.0
        best_fed_amount = 0.0
        last_reading = initial_weight
        stall_cycles = 0

        try:
            self.running = True
            while time.time() - start_time < timeout_seconds:
                if self._abort_feed:
                    return False, (f"Fütterung gestoppt: Nur {best_fed_amount:.1f}g gefüttert "
                                   f"(Soll: {target_weight_grams}g)"), best_fed_amount

                current_weight = self.gewichtssensor.get_weight()
                if current_weight is None:
                    # Einzelne Fehlmessung: als Stillstand werten, aber weiterversuchen
                    stall_cycles += 1
                else:
                    fed_amount = current_weight - initial_weight
                    best_fed_amount = max(best_fed_amount, fed_amount)
                    if progress_cb is not None:
                        try:
                            progress_cb(max(fed_amount, 0.0), target_weight_grams, time.time() - start_time)
                        except Exception:
                            pass
                    if fed_amount >= target_weight_grams:
                        return True, f"{fed_amount:.1f}g gefüttert (Soll: {target_weight_grams}g)", fed_amount
                    # Jede Gewichtsänderung (auf ODER ab) = Napf da, System lebt
                    if abs(current_weight - last_reading) >= self.MIN_CHANGE_GRAMS:
                        stall_cycles = 0
                    else:
                        stall_cycles += 1
                    last_reading = current_weight

                if stall_cycles >= self.MAX_STALL_CYCLES:
                    return False, (f"Abbruch: Gewicht ändert sich nicht mehr (Napf entfernt oder "
                                   f"Sensor defekt?) - nur {best_fed_amount:.1f}g gefüttert "
                                   f"(Soll: {target_weight_grams}g)"), best_fed_amount

                # Langer Vorwärtsschritt
                self.Motor1.TurnStep(Dir='forward', steps=200, stepdelay=0.0005)
                time.sleep(0.2)  # Kurze Pause, damit der Motor zur Ruhe kommt
                # Noch längerer und langsamer Rückwärtsschritt zum Lockern
                self.Motor1.TurnStep(Dir='backward', steps=100, stepdelay=0.002)
                time.sleep(0.05)
            return False, f"Timeout: Nur {best_fed_amount:.1f}g gefüttert (Soll: {target_weight_grams}g)", best_fed_amount
        except Exception as e:
            return False, f"Fehler beim Füttern: {e}", max(best_fed_amount, 0.0)
        finally:
            # Motor wird auf JEDEM Ausstiegspfad stromlos geschaltet
            self.running = False
            self.Motor1.Stop()

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
        # Verwaisten Not-Aus-Timer einer früheren Fütterung entschärfen,
        # damit er nicht mitten in diesem Lauf feuert
        if self.stop_timer:
            self.stop_timer.cancel()

        # Neue Lauf-Generation: ein evtl. noch auslaufender alter Lauf erkennt am
        # Token, dass er überholt wurde, und beendet sich ohne den neuen Lauf zu stören
        self._run_id += 1
        run_id = self._run_id

        self.running = True
        stop_timer = Timer(120, self.stop_motor)
        self.stop_timer = stop_timer

        def run_motor():
            total_runs = 0
            try:
                while self.running and self._run_id == run_id:
                    if total_runs == full_rotation_counts:
                        break

                    # Gewichtssensor-Abfrage (falls vorhanden)
                    if self.gewichtssensor:
                        current_weight = self.gewichtssensor.get_weight()
                        print("aktuelles Gewicht [g]:", current_weight)
                        if current_weight is not None and current_weight > self.max_weight_in_g:
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
            finally:
                # Eigenen Not-Aus-Timer immer entschärfen; gemeinsamen Zustand
                # (running, Motor-Stop) aber nur anfassen, wenn dieser Lauf noch
                # der aktuelle ist - sonst würde ein alter Lauf den neuen abwürgen
                stop_timer.cancel()
                if self._run_id == run_id:
                    self.running = False
                    self.Motor1.Stop()

        # Motor in einem eigenen Thread laufen lassen
        motor_thread = Thread(target=run_motor)
        motor_thread.start()

        # Not-Aus-Timer für 2 Minuten
        stop_timer.start()

    def stop_motor(self):
        """Beendet die Motorbewegung (rotate_motor UND feed_until_weight)."""
        self.running = False
        self._abort_feed = True
        if self.stop_timer:
            self.stop_timer.cancel()
        self.Motor1.Stop()

    def cleanup(self):
        """Stoppt den Motor und entschärft laufende Timer (für Shutdown)."""
        self.stop_motor()


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
