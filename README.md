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

**Minimum:**
- Raspberry Pi 3B oder neuer
- 1 GB RAM (2 GB empfohlen)
- 8 GB SD-Karte (16 GB empfohlen)
- HX711 Load Cell Amplifier (Gewichtssensor)
- VL53L0X ToF Sensor (Distanzmessung)
- Servo/Schrittmotor für Futterspender

**Getestet auf:**
- ✅ Raspberry Pi 4 Model B (4 GB)
- ✅ Raspberry Pi Zero 2 W
- ✅ Raspberry Pi 3 Model B+

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
