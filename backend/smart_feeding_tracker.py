"""
Smart Feeding Tracker
Erkennt automatisch Fütterungen und filtert Katzen-Peaks heraus
"""
import logging
import time
import threading
from datetime import datetime
from typing import Optional

class SmartFeedingTracker:
    def __init__(self, weight_sensor, consumption_manager):
        self.weight_sensor = weight_sensor
        self.consumption_manager = consumption_manager
        
        # Tracking State
        self.baseline_weight = None  # Gewicht wenn Katze NICHT isst
        self.current_weight = None
        self.is_cat_eating = False
        self.last_feeding_detected = 0
        
        # Konfiguration
        self.CAT_THRESHOLD = 100.0  # Wenn +100g oder mehr → Katze ist da
        self.STABLE_DURATION = 10.0  # 10 Sekunden stabil = neue Baseline
        self.MIN_FEEDING_AMOUNT = 5.0  # Minimum 5g für gültige Fütterung
        
        # History für Stabilität
        self.weight_history = []
        self.HISTORY_SIZE = 5
        
        self.running = False
        self.thread = None
        
    def start(self):
        """Starte Background-Tracking"""
        if self.running:
            return
            
        self.running = True
        self.thread = threading.Thread(
            target=self._tracking_loop,
            daemon=True,
            name="SmartFeedingTracker"
        )
        self.thread.start()
        logging.info("🎯 Smart Feeding Tracker gestartet")
        
    def stop(self):
        """Stoppe Background-Tracking"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        logging.info("🛑 Smart Feeding Tracker gestoppt")
        
    def _get_stable_weight(self) -> Optional[float]:
        """Holt aktuelles Gewicht vom Sensor"""
        try:
            weight = self.weight_sensor.get_weight()
            if weight is not None and weight >= 0:
                return weight
        except Exception as e:
            logging.debug(f"Fehler beim Gewicht lesen: {e}")
        return None
        
    def _is_weight_stable(self) -> bool:
        """Prüft ob Gewicht stabil ist (keine großen Schwankungen)"""
        if len(self.weight_history) < self.HISTORY_SIZE:
            return False
            
        # Berechne Standardabweichung
        import statistics
        try:
            stdev = statistics.stdev(self.weight_history)
            # Stabil wenn Schwankung < 3g
            return stdev < 3.0
        except:
            return False
            
    def _tracking_loop(self):
        """Haupt-Tracking-Loop"""
        logging.info("🔄 Tracking-Loop gestartet")
        
        while self.running:
            try:
                # Hole aktuelles Gewicht
                weight = self._get_stable_weight()
                
                if weight is None:
                    time.sleep(5)
                    continue
                    
                self.current_weight = weight
                
                # Füge zu History hinzu
                self.weight_history.append(weight)
                if len(self.weight_history) > self.HISTORY_SIZE:
                    self.weight_history.pop(0)
                
                # Initialisiere Baseline beim ersten Mal
                if self.baseline_weight is None:
                    if self._is_weight_stable():
                        self.baseline_weight = weight
                        logging.info(f"📊 Baseline initialisiert: {self.baseline_weight:.1f}g")
                    time.sleep(5)
                    continue
                
                # Berechne Differenz zur Baseline
                diff = weight - self.baseline_weight
                
                # ZUSTAND 1: Katze isst (Peak erkannt)
                if not self.is_cat_eating and diff >= self.CAT_THRESHOLD:
                    self.is_cat_eating = True
                    logging.info(f"🐱 KATZE ERKANNT: +{diff:.1f}g (Baseline: {self.baseline_weight:.1f}g)")
                
                # ZUSTAND 2: Katze weg (Gewicht wieder stabil)
                elif self.is_cat_eating and self._is_weight_stable():
                    # Katze war da, jetzt ist Gewicht wieder stabil
                    new_baseline = statistics.median(self.weight_history)
                    
                    # Berechne gefütterte Menge
                    fed_amount = new_baseline - self.baseline_weight
                    
                    if fed_amount >= self.MIN_FEEDING_AMOUNT:
                        # Gültige Fütterung erkannt!
                        logging.info(f"✅ FÜTTERUNG ERKANNT: {fed_amount:.1f}g (Vorher: {self.baseline_weight:.1f}g, Nachher: {new_baseline:.1f}g)")
                        
                        # Speichere in Consumption Manager
                        if self.consumption_manager:
                            try:
                                self.consumption_manager.add_feeding(fed_amount)
                                self.last_feeding_detected = time.time()
                            except Exception as e:
                                logging.error(f"Fehler beim Speichern der Fütterung: {e}")
                    else:
                        logging.debug(f"Gewichtsänderung zu klein: {fed_amount:.1f}g")
                    
                    # Update Baseline
                    self.baseline_weight = new_baseline
                    self.is_cat_eating = False
                    logging.info(f"📊 Neue Baseline: {self.baseline_weight:.1f}g")
                
                # ZUSTAND 3: Gewicht sinkt (Katze frisst)
                elif self.is_cat_eating:
                    # Katze isst noch, warten...
                    pass
                    
                # ZUSTAND 4: Baseline-Drift korrigieren (langsame Änderungen)
                elif self._is_weight_stable() and abs(diff) < self.CAT_THRESHOLD:
                    # Gewicht hat sich langsam geändert (kein Peak) - update Baseline
                    if abs(diff) > 2.0:  # Nur wenn > 2g Unterschied
                        new_baseline = statistics.median(self.weight_history)
                        logging.debug(f"🔧 Baseline-Drift-Korrektur: {self.baseline_weight:.1f}g → {new_baseline:.1f}g")
                        self.baseline_weight = new_baseline
                
            except Exception as e:
                logging.error(f"Fehler im Tracking-Loop: {e}")
                
            # Warte 5 Sekunden bis zur nächsten Messung
            time.sleep(5)
            
        logging.info("🛑 Tracking-Loop beendet")
        
    def get_status(self) -> dict:
        """Gibt aktuellen Status zurück"""
        return {
            'running': self.running,
            'baseline_weight': self.baseline_weight,
            'current_weight': self.current_weight,
            'is_cat_eating': self.is_cat_eating,
            'last_feeding': self.last_feeding_detected
        }
