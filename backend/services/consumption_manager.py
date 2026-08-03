"""
Consumption Data Manager - Platzsparende historische Datenverwaltung
Speichert aggregierte Daten in JSON mit automatischer Retention.

Verschoben aus backend/data/ (im Daten-Volume liegt kein Code mehr).
Neu: source-Feld je Fütterung ('plan' | 'manual') für korrekte Statistiken.
"""
import json
import logging
import os
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path

from core.config import DATA_DIR


class ConsumptionManager:
    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = Path(data_dir) if data_dir is not None else DATA_DIR
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.history_file = self.data_dir / "consumption_history.json"
        self.current_day_file = self.data_dir / "current_day.json"
        # RLock: _aggregate_day ruft _save_data innerhalb von add_feeding auf
        self._lock = threading.RLock()
        self._load_data()

    def _load_json_or_default(self, path: Path, default):
        """Lädt eine JSON-Datei; bei Korruption wird sie gesichert und der Default verwendet."""
        if not path.exists():
            return default
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            logging.error(f"ConsumptionManager: {path.name} korrupt ({e}) - sichere als .corrupt und starte leer")
            try:
                os.replace(path, path.with_suffix(path.suffix + '.corrupt'))
            except OSError:
                pass
            return default

    def _load_data(self):
        """Lädt historische Daten aus JSON"""
        self.history = self._load_json_or_default(self.history_file, {
            "daily": [],
            "weekly": [],
            "monthly": [],
            "yearly": []
        })
        self.current_day = self._load_json_or_default(self.current_day_file, {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "feedings": [],
            "total": 0.0
        })

    def _atomic_write(self, path: Path, data):
        """Schreibt JSON atomar (tmp-Datei + os.replace) - kein korruptes JSON bei Stromausfall"""
        tmp_path = path.with_suffix(path.suffix + '.tmp')
        with open(tmp_path, 'w') as f:
            json.dump(data, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)

    def _save_data(self):
        """Speichert Daten in JSON"""
        with self._lock:
            self._atomic_write(self.history_file, self.history)
            self._atomic_write(self.current_day_file, self.current_day)

    def add_feeding(self, amount: float, source: str = "plan", timestamp: Optional[datetime] = None):
        """Fügt eine Fütterung hinzu (source: 'plan' | 'manual')"""
        if timestamp is None:
            timestamp = datetime.now()

        with self._lock:
            today = timestamp.strftime("%Y-%m-%d")

            # Neuer Tag? Aggregiere vorherigen Tag
            if today != self.current_day["date"]:
                self._aggregate_day(self.current_day)
                self.current_day = {
                    "date": today,
                    "feedings": [],
                    "total": 0.0
                }

            self.current_day["feedings"].append({
                "time": timestamp.strftime("%H:%M:%S"),
                "amount": round(amount, 1),
                "source": source
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

        self.history["daily"].append(daily_entry)
        # Retention: Nur letzte 90 Tage behalten
        self.history["daily"] = self.history["daily"][-90:]

        self._check_weekly_aggregation(day_data["date"])
        self._check_monthly_aggregation(day_data["date"])

        self._save_data()

    def _check_weekly_aggregation(self, date_str: str):
        """Prüft und aggregiert Wochendaten"""
        date = datetime.strptime(date_str, "%Y-%m-%d")

        # Am Ende der Woche (Sonntag)
        if date.weekday() == 6:
            week_str = date.strftime("%Y-W%V")
            week_start = date - timedelta(days=6)

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
                self.history["weekly"] = self.history["weekly"][-52:]

    def _check_monthly_aggregation(self, date_str: str):
        """Prüft und aggregiert Monatsdaten"""
        date = datetime.strptime(date_str, "%Y-%m-%d")

        next_month = date.replace(day=28) + timedelta(days=4)
        last_day = (next_month - timedelta(days=next_month.day))

        if date.day == last_day.day:
            month_str = date.strftime("%Y-%m")
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
                self.history["monthly"] = self.history["monthly"][-24:]
                self._check_yearly_aggregation(date_str)

    def _check_yearly_aggregation(self, date_str: str):
        """Prüft und aggregiert Jahresdaten"""
        date = datetime.strptime(date_str, "%Y-%m-%d")

        if date.month == 12 and date.day == 31:
            year_str = date.strftime("%Y")
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
        """Holt tägliche Daten der letzten N KALENDERTAGE.

        Bewusst per Datums-Fenster statt "letzte N Einträge": die Historie
        ist lückig (nur Tage mit Fütterungen) - sonst zeigt ein
        "7-Tage-Trend" monatealte Einträge an.
        """
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        with self._lock:
            return [d for d in self.history["daily"] if d["date"] >= cutoff]

    def get_today_feedings(self) -> List[Dict]:
        """Holt alle heutigen Einzelfütterungen (inkl. source)"""
        with self._lock:
            if self.current_day["date"] != datetime.now().strftime("%Y-%m-%d"):
                return []
            return list(self.current_day["feedings"])

    def get_today_total(self) -> float:
        """Holt Tagesverbrauch"""
        with self._lock:
            if self.current_day["date"] != datetime.now().strftime("%Y-%m-%d"):
                return 0.0
            return self.current_day["total"]

    def get_stats(self) -> Dict:
        """Holt Statistiken"""
        with self._lock:
            daily_data = self.history["daily"]

            if not daily_data:
                return {
                    "avg_daily": 0,
                    "avg_weekly": 0,
                    "avg_monthly": 0,
                    "total_feedings": 0
                }

            return {
                "avg_daily": round(sum(d["total"] for d in daily_data[-30:]) / min(30, len(daily_data)), 1),
                "avg_weekly": round(sum(d["total"] for d in daily_data[-7:]) / min(7, len(daily_data)), 1),
                "avg_monthly": round(sum(d["total"] for d in daily_data) / len(daily_data), 1),
                "total_feedings": sum(d["feedings"] for d in daily_data[-30:])
            }


# Globale Instanz
consumption_manager = ConsumptionManager()
