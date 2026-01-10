# 🐱 CatBoter V3

> Intelligentes automatisches Fütterungssystem für Haustiere mit Web-Interface und WiFi-Fallback

[![Version](https://img.shields.io/badge/version-3.0-blue.svg)](https://github.com/iotueli/catBoterV3)
[![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red.svg)](https://www.raspberrypi.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📖 Inhaltsverzeichnis

- [Übersicht](#-übersicht)
- [Hauptfunktionen](#-hauptfunktionen)
- [Hardware-Anforderungen](#-hardware-anforderungen)
- [Installation](#-installation)
- [Schnellstart](#-schnellstart)
- [Funktionen im Detail](#-funktionen-im-detail)
- [WiFi Fallback System](#-wifi-fallback-system)
- [WebApp Bedienung](#-webapp-bedienung)
- [Technologie-Stack](#-technologie-stack)
- [Konfiguration](#-konfiguration)
- [Troubleshooting](#-troubleshooting)
- [Dokumentation](#-dokumentation)

---

## 📖 Übersicht

CatBoter V3 ist ein vollautomatisches Fütterungssystem für Haustiere, das Hardware-Sensoren mit einer modernen Web-Oberfläche kombiniert. Das System läuft auf einem Raspberry Pi und bietet intelligente Funktionen wie:

- **Automatische Fütterungspläne** mit präziser Gewichtskontrolle
- **WiFi Fallback System** - Niemals offline durch automatischen Access Point
- **Echtzeit-Monitoring** von Füllstand und Verbrauch
- **Web-Interface** für Desktop, Tablet und Smartphone
- **Netzwerk-Verwaltung** direkt aus der App

---

## ✨ Hauptfunktionen

### 🍽️ Fütterungsmanagement

#### Automatische Fütterungspläne
- **Auto-Pläne:** Feste Fütterungszeiten mit konfigurierbaren Mengen
- **Random-Pläne:** Zufällige Zeiten innerhalb definierter Zeitfenster
- **Gewichtsverteilung:** Automatische Aufteilung der Tagesmenge
- **Wochenpläne:** Unterschiedliche Zeiten für jeden Wochentag
- **Sound-Optionen:** Akustisches Signal vor der Fütterung

#### Manuelle Steuerung
- **Portionen-Buttons:** 5g, 10g, 15g für schnelle Fütterung
- **Benutzerdefiniert:** Beliebige Grammzahl eingeben
- **Stop-Funktion:** Fütterung jederzeit abbrechen
- **Echtzeit-Feedback:** Live-Anzeige der gefütterten Menge

### 📊 Monitoring & Statistiken

#### Dashboard
- **Gewichtssensor:** Echtzeit-Gewicht mit Tara-Funktion
- **Distanzsensor:** Füllstand-Überwachung
- **Tagesverbrauch:** Aktuelle Futtermenge
- **System-Status:** CPU, RAM, Temperatur, Speicher

#### Monitoring-Seite (Neu!)
- **7-Tage Trend:** Grafische Darstellung des Verbrauchs
- **Zuverlässigkeit:** Erfolgsrate der Fütterungen (%)
- **Konsistenz-Score:** Gleichmäßigkeit der Fütterungen
- **Aktivitäten-Timeline:** Alle Fütterungen des Tages
- **Speicherplatz-Überwachung:** Warnung bei geringem Speicher

### 📡 WiFi Fallback System

**Niemals offline!** Das System erkennt automatisch Verbindungsprobleme und aktiviert einen Access Point.

#### Funktionsweise
```
WiFi verloren → Nach 90 Sek → Access Point aktiviert
├─ SSID: CatBoter-Setup
├─ Passwort: catboter123
├─ IP: 10.0.0.1
└─ WebApp: http://10.0.0.1:5173
```

#### Use Cases
- Router-Passwort geändert
- Umzug in neue Wohnung
- Router-Ausfall oder Neustart
- Vor-Ort-Wartung ohne Netzwerk

**Mehr Details:** Siehe [WIFI_FALLBACK.md](WIFI_FALLBACK.md)

### 🌐 Netzwerk-Konfiguration

#### WiFi-Verwaltung
- Netzwerk-Scan direkt in der App
- Passwort-Eingabe mit Sichtbarkeits-Toggle
- Verbindungsstatus in Echtzeit
- Automatische Wiederverbindung

#### LAN (Ethernet)
- DHCP oder statische IP
- Gateway und DNS konfigurierbar
- Verbindungsstatus-Anzeige

### ⚙️ System-Einstellungen

#### Sensoren
- **Gewichtssensor-Kalibrierung:** 2-Punkt-Kalibrierung
- **Tara-Funktion:** Nullstellung bei leerem Napf
- **Sensor-Test:** Echtzeit-Messwerte

#### Zeit & Datum
- NTP-Synchronisation
- Manuelle Zeiteinstellung
- Zeitzone-Auswahl
- DST (Sommerzeit) Unterstützung

#### System
- **Neustart:** System neu starten
- **Herunterfahren:** Sicheres Shutdown
- **Updates:** Verfügbar über SSH
- **Logs:** Zugriff auf System-Logs

---

## 🔧 Hardware-Anforderungen

### Minimum
- **Raspberry Pi 3B** oder neuer
- **1 GB RAM** (2 GB empfohlen)
- **8 GB SD-Karte** (16 GB empfohlen)
- **HX711 Load Cell Amplifier** für Gewichtssensor
- **VL53L0X ToF Sensor** für Distanzmessung
- **Servo Motor** oder Schrittmotor für Futterspender

### Empfohlen
- **Raspberry Pi 4** (2 GB RAM oder mehr)
- **32 GB SD-Karte** (für Logs und Daten)
- **Ethernet-Verbindung** (stabiler als WiFi)
- **Stromversorgung:** 5V 3A offizielles Netzteil

### Getestet auf
- ✅ Raspberry Pi 4 Model B (4 GB)
- ✅ Raspberry Pi Zero 2 W
- ✅ Raspberry Pi 3 Model B+

---

## 🚀 Installation

### Option 1: Automatisches Installations-Script (Empfohlen)

Das Script richtet **alles automatisch** ein:

```bash
# Repository klonen
git clone https://github.com/iotueli/catBoterV3.git
cd catBoterV3

# Installations-Script ausführen
chmod +x install.sh
./install.sh
```

**Das Script:**
- ✅ Erkennt Raspberry Pi Modell
- ✅ Aktiviert I2C Interface (für Gewichtssensor)
- ✅ Aktiviert SPI Interface (optional)
- ✅ Installiert Docker & Docker Compose
- ✅ Installiert System-Abhängigkeiten
- ✅ Erstellt Docker Container
- ✅ Startet CatBoter automatisch

**Nach Installation:**
```
📱 WebApp verfügbar unter: http://[RASPBERRY-PI-IP]:5173
🔧 Backend API: http://[RASPBERRY-PI-IP]:5000
```

**Detaillierte Anleitung:** Siehe [INSTALL.md](INSTALL.md)

### Option 2: Einzeiler-Installation (Zukünftig)

```bash
curl -fsSL https://raw.githubusercontent.com/iotueli/catBoterV3/main/install.sh | bash
```

⚠️ **URL nach GitHub Upload anpassen!**

### Option 3: Manuelle Installation

Siehe [INSTALL.md](INSTALL.md) für detaillierte manuelle Schritte.

---

## ⚡ Schnellstart

### 1. Nach Installation

**IP-Adresse herausfinden:**
```bash
hostname -I
```

**WebApp öffnen:**
```
http://[IP-ADRESSE]:5173
```
Beispiel: `http://192.168.1.100:5173`

### 2. Erste Schritte

1. **Gewichtssensor kalibrieren**
   - Einstellungen → Sensor-Kalibrierung
   - Folge der 2-Punkt-Kalibrierung
   - Teste mit bekanntem Gewicht

2. **WiFi konfigurieren** (optional)
   - Einstellungen → WiFi-Verbindung
   - Netzwerk auswählen
   - Passwort eingeben

3. **Fütterungsplan erstellen**
   - Fütterung → Plan erstellen
   - Auto oder Random Plan wählen
   - Zeiten und Mengen festlegen
   - Plan aktivieren (▶️)

4. **Erste Testfütterung**
   - Fütterung → Manuelle Fütterung
   - 10g Button klicken
   - Prüfe ob Motor läuft
   - Prüfe Gewichtsanzeige

### 3. Container-Verwaltung

```bash
# Status anzeigen
docker-compose ps

# Logs ansehen
docker-compose logs -f

# Container stoppen
docker-compose down

# Container neustarten
docker-compose restart

# Container neu bauen
docker-compose up -d --build
```

---

## 🎯 Funktionen im Detail

### Fütterungspläne

#### Auto-Plan
Feste Fütterungszeiten für jeden Wochentag.

**Beispiel:**
```
Montag:    08:00 (15g), 12:00 (10g), 18:00 (20g)
Dienstag:  08:30 (15g), 13:00 (10g), 19:00 (20g)
Samstag:   10:00 (20g), 14:00 (15g), 20:00 (20g)
```

**Features:**
- Bis zu 10 Fütterungen pro Tag
- Sound-Signal vor Fütterung
- Unterschiedliche Pläne für jeden Tag
- Gewichtsverteilung: Tagesmenge → automatische Aufteilung

#### Random-Plan
Zufällige Fütterungszeiten innerhalb von Zeitfenstern.

**Beispiel:**
```
Morgens:     06:00 - 10:00  (15g)
Mittags:     11:00 - 14:00  (10g)
Abends:      17:00 - 21:00  (20g)
```

**Features:**
- 3-5 Zeitfenster pro Tag
- Zufallszeit wird täglich neu berechnet
- Verhindert Routine (gut für Gewichtsmanagement)
- Sound-Signal optional

#### Plan-Verwaltung

**Nur EIN Plan kann aktiv sein!**
- Automatische Deaktivierung anderer Pläne
- Plan-Status: Aktiv (grün) oder Inaktiv (grau)
- Aktivierung via ▶️ Button
- Bearbeiten während Plan aktiv möglich
- Löschen nur bei inaktiven Plänen

### Manuelle Fütterung

**Schnell-Buttons:**
- 5g, 10g, 15g für häufige Mengen
- Ein Klick → sofortige Fütterung

**Benutzerdefiniert:**
- Beliebige Grammzahl (1-100g)
- Eingabefeld + "Füttern" Button

**Stop-Funktion:**
- Große rote STOP-Taste
- Unterbricht laufende Fütterung
- Speichert tatsächlich gefütterte Menge

**Gewichts-Feedback:**
- Live-Anzeige während Fütterung
- Vergleich: Geplant vs. Tatsächlich
- Historie aller Fütterungen

---

## 📡 WiFi Fallback System

### Warum wichtig?

**Problem-Szenarien:**
- ❌ WiFi-Passwort geändert → CatBoter offline
- ❌ Router neu gestartet → neue IP, nicht erreichbar
- ❌ Umzug in neue Wohnung → kein bekanntes Netzwerk
- ❌ Router-Ausfall → keine Zugriffsmöglichkeit

**Lösung: Automatischer Access Point!**

### Wie funktioniert's?

```
1. System überwacht WiFi alle 30 Sekunden
2. Keine Verbindung erkannt
3. Nach 3 Fehlversuchen (90 Sekunden):
   → Access Point wird automatisch aktiviert
4. Du verbindest dich mit dem Hotspot
5. WebApp unter 10.0.0.1:5173 erreichbar
6. Neue WiFi-Daten eingeben
7. System verbindet sich neu
8. Access Point deaktiviert automatisch
```

### Zugangsdaten

**WiFi Access Point:**
- **SSID:** `CatBoter-Setup`
- **Passwort:** `catboter123`
- **Verschlüsselung:** WPA2

**WebApp im AP-Modus:**
- **Frontend:** `http://10.0.0.1:5173`
- **Backend API:** `http://10.0.0.1:5000`

**IP-Bereich:**
- CatBoter: `10.0.0.1`
- Deine Geräte: `10.0.0.10` - `10.0.0.50` (DHCP)

### Konfiguration

**In der WebApp:**
Einstellungen → WiFi Fallback

**Änderbare Parameter:**
- SSID (Netzwerkname)
- Passwort (min. 8 Zeichen)
- WiFi-Kanal (1-11)
- Prüf-Intervall (Sekunden)
- Ein/Aus-Schalter

**Manuelle Steuerung:**
- "AP Manuell Aktivieren" Button
- "AP Deaktivieren" Button
- Status-Anzeige in Echtzeit

**Mehr Details:** [WIFI_FALLBACK.md](WIFI_FALLBACK.md)

---

## 💻 WebApp Bedienung

### Dashboard (Übersicht)

**Sensoren:**
- Gewicht (aktuell, min, max, Ø)
- Füllstand (cm oder %)
- Tara-Funktion

**System:**
- CPU-Auslastung
- RAM-Nutzung
- Temperatur
- Speicherplatz

**Heute:**
- Gefütterte Menge
- Anzahl Fütterungen
- Nächste geplante Fütterung

### Fütterung

**Tabs:**
1. **Manuelle Fütterung** - Sofort-Fütterung
2. **Auto-Pläne** - Feste Zeiten
3. **Random-Pläne** - Zufallszeiten

**Aktionen:**
- ➕ Neuer Plan
- ✏️ Plan bearbeiten
- ▶️ Plan aktivieren
- 🗑️ Plan löschen

**Plan-Status:**
- 🟢 Aktiv (grüner Badge)
- ⚪ Inaktiv (grauer Badge)

### Monitoring (Neu!)

**4 Haupt-Karten:**
- **Heute gefüttert:** Gesamtmenge + Anzahl
- **7-Tage Durchschnitt:** Ø pro Tag
- **Zuverlässigkeit:** Erfolgsrate in %
- **Konsistenz:** Gleichmäßigkeit

**Diagramme:**
- **7-Tage Trend:** Balkendiagramm
- **Heutige Aktivitäten:** Timeline mit Status

**Typen:**
- 🔵 Auto (geplante Fütterungen)
- 🟣 Random (zufällige geplante)
- 🟠 Manuell (von Hand ausgelöst)

### Einstellungen

**Kategorien:**
1. **System-Einstellungen**
   - Neustart / Herunterfahren
   - System-Name

2. **Sensor-Kalibrierung**
   - Gewichtssensor kalibrieren
   - Tara-Funktion
   - Test-Messungen

3. **WiFi-Verbindung**
   - Netzwerk-Scan
   - Verbindung herstellen
   - Status anzeigen

4. **WiFi Fallback** (Neu!)
   - AP Ein/Aus
   - SSID & Passwort
   - Manueller AP-Modus

5. **LAN-Verbindung**
   - DHCP / Statisch
   - IP, Gateway, DNS

6. **System-Benachrichtigungen**
   - E-Mail / Push (zukünftig)

7. **Zeit & Datum**
   - NTP-Synchronisation
   - Manuelle Einstellung
   - Zeitzone

---

## 🛠️ Technologie-Stack

### Frontend
- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool & Dev Server
- **Tailwind CSS** - Styling
- **Framer Motion** - Animationen
- **Lucide Icons** - Icon Library
- **Sonner** - Toast Notifications

### Backend
- **Flask** - Python Web Framework
- **Python 3.11** - Runtime
- **RPi.GPIO** - GPIO Control
- **HX711** - Gewichtssensor Library
- **VL53L0X** - Distanzsensor Library
- **Flask-CORS** - CORS Support

### System
- **Raspberry Pi OS** - Betriebssystem
- **systemd** - Service Management
- **hostapd** - Access Point
- **dnsmasq** - DHCP/DNS Server
- **wpa_supplicant** - WiFi Client

### Optional (für Produktion)
- **Docker** - Containerisierung
- **Docker Compose** - Multi-Container
- **Nginx** - Reverse Proxy
- **Let's Encrypt** - SSL Zertifikate

---

## ⚙️ Konfiguration

### Umgebungsvariablen

```bash
# Backend
FLASK_ENV=production
FLASK_DEBUG=0
LOG_LEVEL=INFO

# Hardware
GPIO_ENABLED=true
I2C_ENABLED=true

# Security
SECRET_KEY=change-this-in-production
API_KEY=your-api-key
```

### WiFi Fallback Config

```json
{
  "enabled": true,
  "ssid": "CatBoter-Setup",
  "password": "catboter123",
  "ip_address": "10.0.0.1",
  "channel": 6,
  "check_interval": 30
}
```

Datei: `backend/data/wifi_fallback_config.json`

### Netzwerk-Konfiguration

**Development:**
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- CORS aktiviert

**Production:**
- Reverse Proxy über Nginx
- Frontend & Backend über Port 80/443
- SSL optional

---

## 🐛 Troubleshooting

### Backend nicht erreichbar

```bash
# Prüfe Backend Health
curl http://localhost:5000/health

# Prüfe Logs
tail -f /tmp/catboter_backend.log

# Prüfe ob Backend läuft
pgrep -f "python.*main.py"

# Backend neu starten
cd backend && source env/bin/activate
python3 main.py
```

### Frontend zeigt Fehler

```bash
# Prüfe Console (F12 → Console)
# Prüfe Netzwerk-Tab (F12 → Network)

# Frontend neu bauen
cd frontend-new
npm run build

# Dev-Server neu starten
npm run dev
```

### WiFi Fallback funktioniert nicht

```bash
# Prüfe Status
curl http://localhost:5000/system/wifi_fallback/status

# Logs prüfen
sudo journalctl -u catboter-wifi-fallback -f

# Service Status
sudo systemctl status catboter-wifi-fallback

# Manuell aktivieren
curl -X POST http://localhost:5000/system/wifi_fallback/enable_ap
```

### GPIO funktioniert nicht

```bash
# I2C aktiviert?
ls /dev/i2c-*

# I2C Tools installiert?
i2cdetect -y 1

# Berechtigungen
sudo usermod -a -G gpio,i2c,spi $USER
```

### Gewichtssensor liefert keine Werte

```bash
# Kalibrierung vorhanden?
cat backend/backend/data/calibration.json

# Test-Messung
curl http://localhost:5000/sensors/weight

# Verkabelung prüfen:
# - VCC → 3.3V
# - GND → GND
# - DT → GPIO 5
# - SCK → GPIO 6
```

**Mehr Hilfe:** [Troubleshooting Guide](TROUBLESHOOTING.md)

---

## 📚 Dokumentation

### Haupt-Dokumentation
- **[README.md](README.md)** - Dieses Dokument (Übersicht)
- **[INSTALL.md](INSTALL.md)** - Detaillierte Installation
- **[WIFI_FALLBACK.md](WIFI_FALLBACK.md)** - WiFi Fallback System

### Erweiterte Dokumentation
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Docker Setup & Deployment
- **[OPTIMIZATIONS.md](OPTIMIZATIONS.md)** - Durchgeführte Optimierungen
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migration von V2 → V3

### API Dokumentation
- **Swagger UI:** `http://localhost:5000/swagger` (zukünftig)
- **API Endpoints:** Siehe Backend Code (`backend/main.py`)

### Hardware
- **Schaltpläne:** `docs/schematics/` (zukünftig)
- **3D-Modelle:** `docs/3d-models/` (zukünftig)

---

## 🎯 Roadmap

### Version 3.1 (Geplant)
- [ ] Mobile App (iOS/Android)
- [ ] Push-Benachrichtigungen
- [ ] Fütterungs-Fotos (Kamera-Integration)
- [ ] Mehrere Haustiere / Profile
- [ ] Cloud-Sync (optional)

### Version 3.2 (Geplant)
- [ ] Spracherkennung (Alexa/Google Home)
- [ ] IFTTT Integration
- [ ] Erweiterte Statistiken
- [ ] Export als PDF/CSV
- [ ] Benutzer-Verwaltung

---

## 🤝 Entwicklung

### Lokale Development

**Frontend:**
```bash
cd frontend-new
npm install
npm run dev  # Port 3000
```

**Backend:**
```bash
cd backend
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
python3 main.py  # Port 5000
```

### Code-Qualität

- TypeScript für Type Safety
- ESLint & Prettier (Frontend)
- Python Type Hints (Backend)
- Production-Safe Logging

### Git Workflow

```bash
# Feature Branch
git checkout -b feature/neue-funktion

# Commit
git add .
git commit -m "feat: Neue Funktion hinzugefügt"

# Push
git push origin feature/neue-funktion

# Pull Request erstellen
```

---

## 📄 Lizenz

[MIT License](LICENSE)

---

## 👥 Autoren

**Ueli - IoT Entwickler**
- Website: [www.iotueli.ch](http://www.iotueli.ch)
- GitHub: [@iotueli](https://github.com/iotueli)

---

## 🙏 Danksagungen

- Raspberry Pi Foundation
- React & TypeScript Community
- Flask Community
- Alle Open-Source Contributors

---

## 📞 Support & Kontakt

### GitHub Issues
**Bug melden oder Feature vorschlagen:**
[https://github.com/iotueli/catBoterV3/issues](https://github.com/iotueli/catBoterV3/issues)

### Community
- **Website:** [www.iotueli.ch](http://www.iotueli.ch)
- **Diskussionen:** GitHub Discussions (zukünftig)

### Logs sammeln (bei Support-Anfrage)

```bash
# System-Info
uname -a
cat /proc/device-tree/model

# Docker-Version
docker --version
docker-compose --version

# Container-Status
docker-compose ps

# Container-Logs
docker-compose logs > catboter-logs.txt

# System-Logs
dmesg | tail -50 > system-logs.txt
```

---

## 🎉 Quick Reference Card

### Erste Schritte
```bash
1. Installation:     ./install.sh
2. WebApp öffnen:    http://[IP]:5173
3. Sensor kalibrieren: Einstellungen → Kalibrierung
4. Plan erstellen:   Fütterung → Auto-Plan → Erstellen
5. Plan aktivieren:  ▶️ Button klicken
```

### WiFi Fallback
```
SSID:      CatBoter-Setup
Passwort:  catboter123
WebApp:    http://10.0.0.1:5173
```

### Wichtige Befehle
```bash
# Container Status
docker-compose ps

# Logs ansehen
docker-compose logs -f

# Neustart
docker-compose restart

# Stoppen
docker-compose down
```

### Wichtige Dateien
```
Config:         backend/data/wifi_fallback_config.json
Pläne:          backend/feedingPlan/feedingPlans.json
Kalibrierung:   backend/backend/data/calibration.json
Verbrauch:      backend/backend/data/current_day.json
```

---

**Version:** 3.0
**Stand:** Januar 2026
**Optimiert mit:** React, TypeScript, Flask, WiFi Fallback

**Made with ❤️ for Cats** 🐱
