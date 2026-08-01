# CatBoter V3

> Intelligenter Katzenfutterautomat auf Raspberry-Pi-Basis — grammgenaue Fütterung, Mobile-First-App, Notfall-Hotspot.

![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-c51a4a)
![Backend](https://img.shields.io/badge/backend-Flask%20%2B%20Socket.IO-blue)
![Frontend](https://img.shields.io/badge/frontend-React%2019%20PWA-61dafb)

## Funktionen

- **Grammgenaue Fütterung** — geschlossener Regelkreis über Wägezelle: der Motor fördert, bis das Zielgewicht im Napf liegt (mit Stillstands-Erkennung, Not-Aus-Timer und Überfütterungsschutz)
- **Fütterungspläne** — feste Zeiten (Auto-Plan) oder Zufallszeiten im Zeitfenster (Random-Plan) mit Mindestabstand
- **Manuelle Fütterung** — Schnellwahl (10/20/30/50 g) oder freie Menge, mit Live-Fortschritt in der App
- **Live-Dashboard** — Tankfüllstand (%), Napfgewicht, Tagesverbrauch in Echtzeit (Socket.IO)
- **Statistik** — Tagesverlauf, Durchschnitt, Zuverlässigkeit, Systemwerte
- **Messbasierte Tank-Kalibrierung** — „Aktuell = voll / leer" per Knopfdruck, ideal für höhenverstellbare Tanks
- **Notfall-Hotspot** — verliert der CatBoter jede Netzwerkverbindung (WLAN *und* LAN), startet er automatisch den Hotspot `CatBoter-Setup`; über `http://10.0.0.1` ist die volle App erreichbar
- **PWA** — als App auf dem Homescreen installierbar, Hell-/Dunkel-Design automatisch

## Screenshots

| Übersicht | Fütterungspläne | Statistik | System |
|:---:|:---:|:---:|:---:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Pläne](docs/screenshots/plans.png) | ![Statistik](docs/screenshots/stats.png) | ![Einstellungen](docs/screenshots/settings.png) |

## Hardware

| Komponente | Zweck |
|---|---|
| Raspberry Pi (3/4, 64-bit) | Steuerung |
| NEMA17-Schrittmotor + A4988/DRV8825-Treiber | Futterförderung (Schnecke) |
| Wägezelle + HX711 | Napfgewicht (Regelkreis + Verbrauch) |
| VL53L0X (Time-of-Flight) | Tankfüllstand |
| 12-V-Netzteil | Motorversorgung (VMOT) |

### Verdrahtung

![Verdrahtungsplan](docs/wiring.svg)

| Signal | BCM-Pin | Modul |
|---|---|---|
| DIR | GPIO 26 | Motor-Treiber |
| STEP | GPIO 21 | Motor-Treiber |
| ENABLE | GPIO 4 | Motor-Treiber (LOW = aktiv) |
| DT | GPIO 17 | HX711 |
| SCK | GPIO 18 | HX711 |
| SDA / SCL | GPIO 2 / 3 | VL53L0X (I2C) |

**Wichtig:** Alle GND verbinden (Pi, Module, Motor-Netzteil). I2C per `sudo raspi-config` aktivieren.

## Installation

```bash
# 1. Repository klonen
git clone https://github.com/uiff/catBoter_V2.git catBoterV3
cd catBoterV3

# 2. Docker installieren (falls noch nicht vorhanden)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Frontend bauen (Node 20+ nötig; alternativ auf dem PC bauen und dist/ kopieren)
cd frontend-new && npm install && npm run build && cd ..

# 4. WiFi-Fallback-Host-Service installieren (Hotspot-Notfallmodus)
sudo apt install -y hostapd dnsmasq
sudo systemctl disable --now hostapd dnsmasq
sudo cp backend/system/catboter-wifi-fallback.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now catboter-wifi-fallback

# 5. Container starten
docker compose up -d --build
```

Die App ist danach unter `http://<pi-ip>/` erreichbar.

## Erste Einrichtung

1. **Waage kalibrieren:** System → Waage → „Kalibrieren" — Napf leeren, tarieren, Referenzgewicht (z. B. 100 g) auflegen, Wert eintragen.
2. **Tank kalibrieren:** System → Tank — bei vollem Tank „Aktuell = voll übernehmen", bei leerem Tank „Aktuell = leer übernehmen", speichern.
3. **Plan anlegen:** Fütterung → Neu — feste Zeiten oder Zufallsmodus wählen, Tagesmenge festlegen, aktivieren.

## Notfall-Hotspot

Verliert der CatBoter für ~90 Sekunden jede Netzwerkverbindung, startet er automatisch einen eigenen Hotspot:

1. Mit dem WLAN **`CatBoter-Setup`** verbinden (Standard-Passwort in System → Notfall-Hotspot konfigurierbar)
2. `http://10.0.0.1` öffnen → volle App
3. Unter System → Netzwerk das richtige WLAN suchen und verbinden — der Hotspot schaltet sich danach selbst ab

Steckt ein LAN-Kabel mit funktionierender Verbindung, bleibt der Hotspot aus (das Gerät ist ja erreichbar).

## Architektur

```
┌─────────────┐  Socket.IO + REST  ┌──────────────────────────────┐
│  React-PWA  │◄──────────────────►│  Flask-Backend (Container)   │
│  (nginx)    │                    │  api/ · services/ · core/    │
└─────────────┘                    │  ├─ feed_until_weight-Regel- │
                                   │  │  kreis (Motor + Waage)    │
┌──────────────────────────┐       │  ├─ Scheduler (60-s-Tick)    │
│ WiFi-Fallback-Service    │◄─────►│  └─ Daten: /app/data (Volume)│
│ (Host, systemd, nmcli)   │ Datei-└──────────────────────────────┘
│ Hotspot bei Netzverlust  │  IPC
└──────────────────────────┘
```

- **Backend:** Flask + eventlet + Flask-SocketIO, modular (Blueprints/Services), läuft privilegiert im Container (GPIO/I2C)
- **Frontend:** React 19, Vite, Tailwind, zustand + react-query, eine Socket-Verbindung, Bottom-Tab-Navigation
- **Persistenz:** alles unter `backend/data/` (Bind-Mount) — Kalibrierungen, Verbrauchshistorie, Konfigurationen überleben jeden Rebuild
- **Sicherheit der Fütterung:** max. 2 Versuche pro geplanter Fütterung mit Restmengen-Logik, richtungsunabhängige Stillstands-Erkennung (Napf entfernt → Abbruch statt Dauerförderung), Motor-Stopp per `try/finally` auf jedem Pfad

## Backup

```bash
./create-backup.sh   # sichert Projekt + alle Laufzeitdaten als tar.gz auf den Desktop
```

---

*Ein Projekt von [iotueli](https://iotueli.ch)*
