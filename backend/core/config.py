"""Zentrale Konfiguration: Pfade und Konstanten.

DATA_DIR ist im Container /app/data (Volume-Mount) via CATBOTER_DATA_DIR;
lokal/standalone fällt es auf backend/data zurück.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = Path(os.environ.get("CATBOTER_DATA_DIR", str(BASE_DIR / "data")))

FEEDING_PLAN_DIR = BASE_DIR / "feedingPlan"
FEEDING_PLAN_FILE = FEEDING_PLAN_DIR / "feedingPlans.json"

# Manuelle Fütterung
MIN_MANUAL_GRAMS = 1.0
MAX_MANUAL_GRAMS = 100.0
FEED_TIMEOUT_SECONDS = 300

# Tank-Füllstand (Einheit: cm; min = Sensorabstand bei vollem Tank, max = leer)
TANK_DEFAULT_MIN_CM = 3.0
TANK_DEFAULT_MAX_CM = 23.0
TANK_LOW_PERCENT = 25
TANK_EMPTY_PERCENT = 10

# App-Einstellungen (Frontend-relevante Schwellwerte + Feature-Konfiguration)
APP_SETTINGS_FILE = DATA_DIR / "app_settings.json"
APP_SETTINGS_DEFAULTS = {
    "tank_warn_percent": 20,
    # Smart-Feed: Napf-Reste werden bei Plan-Fütterungen vom Ziel abgezogen
    "smart_feed": True,
    # Urlaubsmodus: ISO-Zeitpunkt bis zu dem Plan-Fütterungen pausieren (None = aus)
    "paused_until": None,
    # Gesundheits-Monitor: Warnung wenn Napf so viele Stunden unberührt (0 = aus)
    "untouched_alert_hours": 12,
    # MQTT-Integration (Home Assistant & Co.)
    "mqtt": {
        "enabled": False,
        "host": "",
        "port": 1883,
        "username": "",
        "password": "",
    },
    "ha_discovery": False,
    # Katzenprofil für den Kalorienrechner
    "cat_profile": {
        "weight_kg": None,
        "age_years": None,
        "activity": "normal",
        "kcal_per_100g": None,
    },
}
