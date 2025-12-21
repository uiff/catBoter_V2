"""
Consumption Data Manager - Platzsparende historische Datenverwaltung
Speichert aggregierte Daten in JSON mit automatischer Retention
"""
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path

class ConsumptionManager:
    def __init__(self, data_dir: str = "backend/data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.history_file = self.data_dir / "consumption_history.json"
        self.current_day_file = self.data_dir / "current_day.json"
        self._load_data()
    
    def _load_data(self):
        """Lädt historische Daten aus JSON"""
        if self.history_file.exists():
            with open(self.history_file, 'r') as f:
                self.history = json.load(f)
        else:
            self.history = {
                "daily": [],
                "weekly": [],
                "monthly": [],
                "yearly": []
            }
        
        if self.current_day_file.exists():
            with open(self.current_day_file, 'r') as f:
                self.current_day = json.load(f)
        else:
            self.current_day = {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "feedings": [],
                "total": 0.0
            }
    
    def _save_data(self):
        """Speichert Daten in JSON"""
        with open(self.history_file, 'w') as f:
            json.dump(self.history, f, indent=2)
        
        with open(self.current_day_file, 'w') as f:
            json.dump(self.current_day, f, indent=2)
    
    def add_feeding(self, amount: float, timestamp: Optional[datetime] = None):
        """Fügt eine Fütterung hinzu"""
        if timestamp is None:
            timestamp = datetime.now()
        
        today = timestamp.strftime("%Y-%m-%d")
        
        # Neuer Tag? Aggregiere vorherigen Tag
        if today != self.current_day["date"]:
            self._aggregate_day(self.current_day)
            self.current_day = {
                "date": today,
                "feedings": [],
                "total": 0.0
            }
        
        # Füge Fütterung hinzu
        self.current_day["feedings"].append({
            "time": timestamp.strftime("%H:%M:%S"),
            "amount": round(amount, 1)
        })
        self.current_day["total"] = round(self.current_day["total"] + amount, 1)
        
        self._save_data()
    
    def _aggregate_day(self, day_data: Dict):
        """Aggregiert einen Tag zu historischen Daten"""
        if day_data["total"] == 0:
            return
        
        feedings = day_data["feedings"]
        amounts = [f["amount"] for f in feedings]
        
        daily_entry = {
            "date": day_data["date"],
            "total": round(day_data["total"], 1),
            "feedings": len(feedings),
            "avg_per_feeding": round(day_data["total"] / len(feedings), 1) if feedings else 0,
            "min": round(min(amounts), 1) if amounts else 0,
            "max": round(max(amounts), 1) if amounts else 0
        }
        
        # Füge zu daily hinzu
        self.history["daily"].append(daily_entry)
        
        # Retention: Nur letzte 90 Tage behalten
        self.history["daily"] = self.history["daily"][-90:]
        
        # Prüfe ob Wochenaggregation nötig
        self._check_weekly_aggregation(day_data["date"])
        
        # Prüfe ob Monatsaggregation nötig
        self._check_monthly_aggregation(day_data["date"])
        
        self._save_data()
    
    def _check_weekly_aggregation(self, date_str: str):
        """Prüft und aggregiert Wochendaten"""
        date = datetime.strptime(date_str, "%Y-%m-%d")
        
        # Am Ende der Woche (Sonntag)
        if date.weekday() == 6:
            week_str = date.strftime("%Y-W%V")
            week_start = date - timedelta(days=6)
            
            # Sammle Daten der letzten 7 Tage
            week_data = [d for d in self.history["daily"] 
                        if week_start.strftime("%Y-%m-%d") <= d["date"] <= date_str]
            
            if week_data:
                weekly_entry = {
                    "week": week_str,
                    "start_date": week_start.strftime("%Y-%m-%d"),
                    "end_date": date_str,
                    "total": round(sum(d["total"] for d in week_data), 1),
                    "avg_daily": round(sum(d["total"] for d in week_data) / len(week_data), 1),
                    "days": len(week_data)
                }
                
                self.history["weekly"].append(weekly_entry)
                
                # Retention: Nur letzte 52 Wochen
                self.history["weekly"] = self.history["weekly"][-52:]
    
    def _check_monthly_aggregation(self, date_str: str):
        """Prüft und aggregiert Monatsdaten"""
        date = datetime.strptime(date_str, "%Y-%m-%d")
        
        # Am letzten Tag des Monats
        next_month = date.replace(day=28) + timedelta(days=4)
        last_day = (next_month - timedelta(days=next_month.day))
        
        if date.day == last_day.day:
            month_str = date.strftime("%Y-%m")
            
            # Sammle Daten des Monats
            month_data = [d for d in self.history["daily"] 
                         if d["date"].startswith(month_str)]
            
            if month_data:
                monthly_entry = {
                    "month": month_str,
                    "total": round(sum(d["total"] for d in month_data), 1),
                    "avg_daily": round(sum(d["total"] for d in month_data) / len(month_data), 1),
                    "days": len(month_data)
                }
                
                self.history["monthly"].append(monthly_entry)
                
                # Retention: Nur letzte 24 Monate
                self.history["monthly"] = self.history["monthly"][-24:]
                
                # Prüfe Jahresaggregation
                self._check_yearly_aggregation(date_str)
    
    def _check_yearly_aggregation(self, date_str: str):
        """Prüft und aggregiert Jahresdaten"""
        date = datetime.strptime(date_str, "%Y-%m-%d")
        
        # Am letzten Tag des Jahres
        if date.month == 12 and date.day == 31:
            year_str = date.strftime("%Y")
            
            # Sammle Daten des Jahres
            year_data = [d for d in self.history["monthly"] 
                        if d["month"].startswith(year_str)]
            
            if year_data:
                yearly_entry = {
                    "year": year_str,
                    "total": round(sum(d["total"] for d in year_data), 1),
                    "avg_monthly": round(sum(d["total"] for d in year_data) / len(year_data), 1),
                    "months": len(year_data)
                }
                
                self.history["yearly"].append(yearly_entry)
    
    def get_daily(self, days: int = 30) -> List[Dict]:
        """Holt tägliche Daten der letzten N Tage"""
        return self.history["daily"][-days:]
    
    def get_weekly(self, weeks: int = 12) -> List[Dict]:
        """Holt wöchentliche Daten der letzten N Wochen"""
        return self.history["weekly"][-weeks:]
    
    def get_monthly(self, months: int = 6) -> List[Dict]:
        """Holt monatliche Daten der letzten N Monate"""
        return self.history["monthly"][-months:]
    
    def get_yearly(self) -> List[Dict]:
        """Holt alle Jahresdaten"""
        return self.history["yearly"]
    
    def get_today_total(self) -> float:
        """Holt Tagesverbrauch"""
        return self.current_day["total"]
    
    def get_stats(self) -> Dict:
        """Holt Statistiken"""
        daily_data = self.history["daily"]
        
        if not daily_data:
            return {
                "avg_daily": 0,
                "avg_weekly": 0,
                "avg_monthly": 0
            }
        
        return {
            "avg_daily": round(sum(d["total"] for d in daily_data[-30:]) / min(30, len(daily_data)), 1),
            "avg_weekly": round(sum(d["total"] for d in daily_data[-7:]) / min(7, len(daily_data)), 1),
            "avg_monthly": round(sum(d["total"] for d in daily_data) / len(daily_data), 1),
            "total_feedings": sum(d["feedings"] for d in daily_data[-30:])
        }

# Globale Instanz
consumption_manager = ConsumptionManager()
