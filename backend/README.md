# CatBoter Backend

Dieses Backend steuert und überwacht das CatBoter-System (Fütterungsautomat).

## Features

- Steuerung von Motor, Distanzsensor und Gewichtssensor
- Verwaltung von Fütterungsplänen
- REST-API für das Frontend
- Autostart-Skripte für systemd

## Setup

1. Python 3 installieren
2. Abhängigkeiten installieren:
   ```bash
   pip install -r requirements.txt
   ```
3. Konfigurationsdateien in `config/` anpassen

## Starten

```bash
python3 start.py
```

Beenden:
```bash
python3 stop.py
```

## Autostart einrichten

Mit Root-Rechten:
```bash
sudo python3 enable_autostart.py
```
Autostart deaktivieren:
```bash
sudo python3 disable_autostart.py
```
Status prüfen:
```bash
python3 check_autostart_status.py
```

## API

Die API-Spezifikation befindet sich in `api/swagger.yaml`.

## Verzeichnisstruktur

- `feedingPlan/` – Fütterungspläne
- `SensorAktor/` – Sensor- und Aktorsteuerung
- `logic/` – Steuerungslogik
- `System/` – Systemfunktionen

## Lizenz

MIT License
