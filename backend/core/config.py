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
    # Diät-Modus: Tages-Budget für den Haushalt (beide Katzen zusammen).
    # Sanfte Rampe: von start_grams aus max. weekly_reduction_pct pro Woche
    # runter bis target_grams - Crash-Diäten sind für Katzen gefährlich
    # (hepatische Lipidose). Hand- und App-Fütterungen zählen ins Budget.
    "diet": {
        "enabled": False,
        "target_grams": None,
        "weekly_reduction_pct": 5,
        "start_date": None,
        "start_grams": None,
    },
    # Just-in-Time-Dosierung: Napf bleibt leer, Häppchen nur solange die live
    # erkannte Katze Budget hat. Greift NUR, wenn der Klassifikator fertig
    # gelernt hat (>= 8 Labels je Katze) - sonst normale Fütterung.
    "jit": {
        "enabled": False,
        "starter_grams": 3,
    },
    # Katzenprofile für den Kalorienrechner (beide fressen aus demselben
    # Automaten - die Plan-Empfehlung ist die SUMME beider Katzen).
    # budget_g/min_g: Tagesbudget und garantierte Mindestmenge je Katze (JIT).
    "cat_profiles": {
        "kcal_per_100g": None,
        "cats": [
            {"name": "Katze 1", "weight_kg": None, "age_years": None,
             "activity": "normal", "budget_g": None, "min_g": None},
            {"name": "Katze 2", "weight_kg": None, "age_years": None,
             "activity": "normal", "budget_g": None, "min_g": None},
        ],
    },
}
