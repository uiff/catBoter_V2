# 🐱 CatBoter

> Intelligentes automatisches Fütterungssystem für Haustiere mit Web-Interface

[![Version](https://img.shields.io/badge/version-3.0-blue.svg)](https://github.com/iotueli/catBoterV3)
[![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red.svg)](https://www.raspberrypi.org/)

---

## 📖 Was ist CatBoter?

Vollautomatisches Fütterungssystem für Haustiere auf Raspberry Pi Basis mit:
- ⏰ **Automatische Fütterungspläne** mit präziser Gewichtskontrolle
- 📱 **Web-Interface** für alle Geräte (Desktop/Tablet/Mobile)
- 📡 **WiFi Fallback** - Automatischer Hotspot bei Verbindungsverlust
- 📊 **Echtzeit-Monitoring** von Füllstand und Verbrauch
- 🌐 **Netzwerk-Verwaltung** direkt aus der App

---

## 🚀 Installation (5 Minuten)

### Vorbereitung

**1. Raspberry Pi OS installieren:**
- **Raspberry Pi Imager** herunterladen: https://www.raspberrypi.com/software/
- **OS:** Raspberry Pi OS Lite (64-bit) - **Empfohlen** (ohne Desktop spart Ressourcen)
  - Alternative: Raspberry Pi OS with Desktop (mehr Speicher benötigt)
- **SD-Karte:** Mindestens 16 GB (32 GB empfohlen)
- **SSH aktivieren** im Imager (Settings → Enable SSH)
- **WiFi konfigurieren** im Imager (optional, kann später gemacht werden)

**2. I2C aktivieren (für VL53L0X Sensor):**
```bash
sudo raspi-config
# Interface Options → I2C → Enable → Reboot
```

**3. GPIO-Zugriff sicherstellen:**
```bash
# User zur gpio-Gruppe hinzufügen
sudo usermod -a -G gpio $USER
# Neuanmeldung erforderlich
```

### Automatisches Setup (Empfohlen)

```bash
# Repository klonen
git clone https://github.com/iotueli/catBoterV3.git
cd catBoterV3

# Setup-Wizard starten
chmod +x setup-wizard.sh
./setup-wizard.sh
```

**Das war's!** Der Wizard installiert automatisch:
- ✅ System-Updates
- ✅ Docker & Docker Compose
- ✅ I2C Interface (für Sensoren)
- ✅ CatBoter Container
- ✅ WiFi Fallback System
- ✅ Hostname-Konfiguration (optional)

### Nach Installation

**WebApp öffnen:**
```
http://[RASPBERRY-PI-IP]
```

IP-Adresse herausfinden: `hostname -I`

---

## ⚡ Schnellstart

### 1. Erste Schritte

1. **WebApp öffnen** → `http://[IP]`
2. **Gewichtssensor kalibrieren** → Einstellungen → Gewichtskalibrierung
3. **Tankfüllstand kalibrieren** → Einstellungen → Tankfüllstand Kalibrierung
4. **Fütterungsplan erstellen** → Fütterung → Übersicht → Neuer Plan
5. **Plan aktivieren** → Aktivieren-Button klicken

### 2. WiFi Fallback (Niemals offline!)

**Bei WiFi-Problemen:**
1. CatBoter aktiviert automatisch Hotspot nach 90 Sekunden
2. Verbinde dich mit: **CatBoter-Setup** (Passwort: `catboter123`)
3. Öffne: `http://10.0.0.1`
4. Konfiguriere neues WiFi
5. Hotspot deaktiviert sich automatisch

**Konfiguration:** Einstellungen → WiFi Fallback

---

## ✨ Hauptfunktionen

### 🍽️ Fütterungsmanagement
- **Auto-Pläne:** Feste Zeiten (z.B. 08:00, 12:00, 18:00) - Blau markiert
- **Random-Pläne:** Zufällige Zeiten in Zeitfenstern - Orange markiert
- **Manuelle Fütterung:** Schnellbuttons (5g, 10g, 15g) oder benutzerdefiniert
- **Plan-Übersicht:** Alle Pläne auf einen Blick, schnell wechseln
- **Notfall-Stop:** Motor-Stopp funktioniert IMMER, auch ohne Netzwerk

### 📊 Monitoring
- **Dashboard:** Tankfüllstand, Napfgewicht, Tagesverbrauch
- **Monitoring-Seite:** 7-Tage Trend, Zuverlässigkeit, Konsistenz, Timeline
- **Statistiken:** Wöchentliche/monatliche Auswertungen

### ⚙️ Einstellungen
- **Sensoren:** Gewichts- und Tankfüllstand-Kalibrierung (Min/Max Distanz)
- **Netzwerk:** WiFi, LAN, WiFi Fallback konfigurieren
- **System:** Zeit/Datum, NTP, Neustart, Herunterfahren
- **Tankfüllstand:** Visuelle Kalibrierung mit Live-Vorschau (leer/voll)

---

## 🔧 Hardware-Anforderungen

### Raspberry Pi
**Minimum:**
- **Raspberry Pi 4 Model B** (empfohlen) oder Raspberry Pi 3B+
- **2 GB RAM** minimum (4 GB empfohlen für flüssige Performance)
- **16 GB microSD-Karte** minimum (**32 GB empfohlen**)
  - Class 10 oder besser für schnelle I/O-Operationen
  - SanDisk oder Samsung empfohlen
- **Stromversorgung:** 5V/3A USB-C (Pi 4) oder 5V/2.5A Micro-USB (Pi 3)

**Getestet auf:**
- ✅ Raspberry Pi 4 Model B (4 GB) - **Optimal**
- ✅ Raspberry Pi 3 Model B+ - Funktioniert, aber langsamer
- ⚠️ Raspberry Pi Zero 2 W - Möglich, aber sehr langsam beim Docker-Build

### Sensoren & Aktoren

#### 1. **Gewichtssensor (HX711 Load Cell Amplifier)**
- **Sensor:** HX711 mit 1-5kg Load Cell
- **GPIO-Pins:**
  - **DT (Data):** GPIO 5
  - **SCK (Clock):** GPIO 6
  - **VCC:** 5V
  - **GND:** GND

#### 2. **Füllstandssensor (VL53L0X Time-of-Flight)**
- **Sensor:** VL53L0X ToF Distanzsensor (0-200cm)
- **Anschluss:** I2C
  - **SDA:** GPIO 2 (Pin 3)
  - **SCL:** GPIO 3 (Pin 5)
  - **VCC:** 3.3V (nicht 5V!)
  - **GND:** GND
- **I2C aktivieren:**
  ```bash
  sudo raspi-config
  # Interface Options → I2C → Enable
  ```

#### 3. **Motor (Futterspender-Antrieb)**
- **Typ:** Schrittmotor oder Servo
- **GPIO-Pins:**
  - **IN1/IN2/IN3/IN4:** GPIO 17, 18, 27, 22 (für Schrittmotor)
  - Oder **PWM-Pin** GPIO 18 (für Servo)
  - **VCC:** Externe 5V/12V Stromversorgung (je nach Motor)
  - **GND:** Gemeinsames GND mit Raspberry Pi

> **⚠️ Wichtig:** Motor benötigt externe Stromversorgung! Niemals direkt vom Pi mit Strom versorgen.

### Optionale Hardware
- **Externe WiFi-Antenne** (für besseren Empfang)
- **Gehäuse mit Lüfter** (Pi 4 wird warm bei Docker)
- **Backup-Powerbank** (für unterbrechungsfreien Betrieb)

### Verkabelungsdiagramm

```
Raspberry Pi 4 GPIO Layout
┌─────────────────────────────────┐
│  3.3V  (1) (2)  5V              │  ← Stromversorgung
│  SDA   (3) (4)  5V              │  ← I2C für VL53L0X
│  SCL   (5) (6)  GND             │
│  GPIO4 (7) (8)  GPIO14          │
│  GND   (9) (10) GPIO15          │
│  GPIO17(11)(12) GPIO18          │  ← Motor/Servo
│  GPIO27(13)(14) GND             │
│  GPIO22(15)(16) GPIO23          │
│  3.3V  (17)(18) GPIO24          │
│  GPIO10(19)(20) GND             │
│  GPIO9 (21)(22) GPIO25          │
│  GPIO11(23)(24) GPIO8           │
│  GND   (25)(26) GPIO7           │
│  GPIO5 (29)(30) GND             │  ← HX711 DT
│  GPIO6 (31)(32) GPIO12          │  ← HX711 SCK
│  ...                            │
└─────────────────────────────────┘

Anschlussplan:
┌────────────────────────────────────────────────┐
│ HX711 (Gewichtssensor)                         │
│  VCC  → Pin 2  (5V)                           │
│  GND  → Pin 6  (GND)                          │
│  DT   → Pin 29 (GPIO 5)                       │
│  SCK  → Pin 31 (GPIO 6)                       │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ VL53L0X (Distanzsensor)                        │
│  VCC  → Pin 1  (3.3V) ⚠️ NICHT 5V!            │
│  GND  → Pin 9  (GND)                          │
│  SDA  → Pin 3  (GPIO 2 / SDA)                 │
│  SCL  → Pin 5  (GPIO 3 / SCL)                 │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ Schrittmotor (über Treiber-Board)              │
│  IN1  → GPIO 17                               │
│  IN2  → GPIO 18                               │
│  IN3  → GPIO 27                               │
│  IN4  → GPIO 22                               │
│  VCC  → Externe 5V/12V Stromquelle            │
│  GND  → Gemeinsam mit Pi GND                  │
└────────────────────────────────────────────────┘
```

> **⚠️ Sicherheitshinweise:**
> - VL53L0X nur an 3.3V anschließen! 5V zerstört den Sensor
> - Motor niemals direkt am Pi anschließen - nutze Treiber-Board
> - Gemeinsames GND für alle Komponenten erforderlich
> - Externe Stromversorgung für Motor zwingend notwendig

---

## 🛠️ Technologie-Stack

**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion
**Backend:** Flask + Python 3.11 + RPi.GPIO
**System:** Docker + Docker Compose + Nginx
**WiFi:** hostapd + dnsmasq + wpa_supplicant

---

## 🐛 Troubleshooting

### Container-Verwaltung
```bash
# Status anzeigen
sudo docker-compose ps

# Logs ansehen
sudo docker-compose logs -f

# Container neustarten
sudo docker-compose restart

# Container neu bauen
sudo docker-compose up -d --build
```

### Backend nicht erreichbar
```bash
# Health-Check
curl http://localhost:5000/health

# Backend Logs
sudo docker-compose logs backend
```

### Frontend zeigt Fehler
```bash
# Frontend neu bauen
cd frontend-new && npm run build

# Frontend deployen
sudo docker-compose restart nginx
```

### WiFi Fallback aktivieren
```bash
# Status prüfen
curl http://localhost:5000/system/wifi_fallback/status

# Manuell aktivieren
curl -X POST http://localhost:5000/system/wifi_fallback/enable_ap
```

---

## 📚 Dokumentation

### Wichtige Dateien
```
Config:         backend/data/wifi_fallback_config.json
Pläne:          backend/feedingPlan/feedingPlans.json
Kalibrierung:   backend/backend/data/calibration.json
Tank-Kalibrierung: backend/backend/data/tank_calibration.json
```

### Wichtige Befehle
```bash
# Container Status
sudo docker-compose ps

# Logs ansehen
sudo docker-compose logs -f

# Container stoppen
sudo docker-compose down

# Container starten
sudo docker-compose up -d
```

---

## 🎯 Quick Reference

### WiFi Fallback
```
SSID:      CatBoter-Setup
Passwort:  catboter123
WebApp:    http://10.0.0.1
```

### Standardports
```
Frontend:  http://[IP]
Backend:   http://[IP]:5000
```

---

## 📞 Support

**GitHub Issues:** [github.com/iotueli/catBoterV3/issues](https://github.com/iotueli/catBoterV3/issues)
**Website:** [www.iotueli.ch](http://www.iotueli.ch)

---

## 📄 Lizenz

MIT License - Siehe [LICENSE](LICENSE) für Details

---

**Version:** 3.0
**Stand:** Januar 2026
**Made with ❤️ for Cats** 🐱

---

## 🆕 Änderungen in Version 3.0

### Sicherheit
- ✅ **Notfall-Stop immer verfügbar** - Motor kann IMMER gestoppt werden, unabhängig von Netzwerkstatus
- ✅ **Verbesserte Fehlerbehandlung** - Keine falschen 0.0g Fütterungseinträge mehr

### Benutzerfreundlichkeit
- ✅ **Visuelles Farbschema** - Auto-Pläne (Blau) vs Random-Pläne (Orange)
- ✅ **Custom Icon** - Neues CatBoter-Logo mit Katze und Napf
- ✅ **Tankfüllstand-Kalibrierung** - Einfache visuelle Kalibrierung (leer/voll)
- ✅ **Bessere Sensor-Anzeige** - Korrekte Null-Wert-Behandlung für offline Sensoren

### Installation
- ✅ **Automatischer Setup-Wizard** - Vollständige Installation in 5 Minuten
- ✅ **Hostname-Konfiguration** - Zugriff über http://catboter.local möglich
