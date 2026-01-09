# 🐱 CatBoter V3

> Automatisches Fütterungssystem für Haustiere mit Web-Interface

## 📖 Übersicht

CatBoter V3 ist eine vollständige Web-Anwendung zur Verwaltung automatischer Fütterungspläne für Haustiere. Das System kombiniert Hardware-Sensoren (Gewicht, Distanz) mit einer benutzerfreundlichen Web-Oberfläche zur Steuerung und Überwachung.

### ✨ Hauptfunktionen

- 📅 **Fütterungsplan-Verwaltung:** Erstellen, bearbeiten und löschen Sie Fütterungspläne mit anpassbaren Zeiten, Gewichten und Sound-Optionen
- ⚖️ **Gewichtssensor-Integration:** Echtzeit-Überwachung des Futtergewichts mit HX711 Load Cell
- 📏 **Distanzsensor:** VL53L0X zur Überwachung des Füllstands
- 🎯 **Automatische Verteilung:** Automatische Verteilung des täglichen Futtergewichts auf alle Fütterungszeiten
- 📊 **Dashboard:** Echtzeit-Monitoring von System-Status, Sensordaten und Verbrauch
- 🌐 **Netzwerk-Konfiguration:** WiFi und LAN direkt aus der App konfigurieren
- 🔄 **Automatisierung:** Zeitgesteuerte automatische Fütterung mit Raspberry Pi

## 🚀 Schnellstart mit Docker

### Voraussetzungen
- Docker & Docker Compose
- Raspberry Pi (empfohlen) oder Linux System
- Node.js 18+ (für lokale Entwicklung)
- Python 3.11+ (für lokale Entwicklung)

### System starten

```bash
# Einfacher Start
./start-docker.sh

# Zugriff
open http://localhost
```

### System stoppen

```bash
./stop-docker.sh
```

**Detaillierte Anleitung:** Siehe [DOCKER_SETUP.md](DOCKER_SETUP.md)

## 🏗️ Architektur

```
┌─────────────────────────────────────────┐
│     Nginx Reverse Proxy (Port 80)      │
│  - React Frontend (Static Files)       │
│  - API Routing (/api → Backend)        │
└─────────────────────────────────────────┘
              ↓                ↓
    ┌─────────────┐    ┌─────────────┐
    │  Frontend   │    │  Backend    │
    │   React     │    │   Flask     │
    │ TypeScript  │    │   Python    │
    └─────────────┘    └─────────────┘
                            ↓
              ┌──────────────────────┐
              │  Hardware (RasPi)    │
              │  - GPIO              │
              │  - I2C Sensoren      │
              │  - Servo Motor       │
              └──────────────────────┘
```

## 🛠️ Technologie-Stack

### Frontend
- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Material-UI v5** - UI Components
- **Axios** - HTTP Client
- **React Router** - Navigation
- **Chart.js** - Visualisierung

### Backend
- **Flask** - Python Web Framework
- **Flask-CORS** - Cross-Origin Resource Sharing
- **Swagger** - API Dokumentation
- **RPi.GPIO** - Raspberry Pi GPIO Control
- **Psutil** - System Information

### Infrastructure
- **Docker & Docker Compose** - Containerisierung
- **Nginx** - Reverse Proxy & Static File Server

### Hardware
- **Raspberry Pi** - Hauptrechner
- **VL53L0X** - Time-of-Flight Distanzsensor
- **HX711** - Load Cell Amplifier
- **Servo Motor** - Futterspender

## 📦 Installation & Setup

### Option 1: Docker (Empfohlen)

```bash
# Repository klonen
git clone <repository-url>
cd catBoterV3

# Umgebungsvariablen konfigurieren
cp .env.example .env
nano .env

# System starten
./start-docker.sh
```

### Option 2: Manuelle Installation

#### Frontend

```bash
cd frontend
npm install
npm run build
```

#### Backend

```bash
cd backend
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
python main.py
```

**Detaillierte Anleitung:** Siehe [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)

## 📱 Verwendung

### Web-Interface

Nach dem Start ist die Anwendung erreichbar unter:
- **Hauptseite:** http://localhost
- **API Dokumentation:** http://localhost/swagger
- **Health Check:** http://localhost/health

### Haupt-Features

1. **Dashboard:** Übersicht über System-Status und aktuelle Sensordaten
2. **Fütterungspläne:** Erstellen und verwalten Sie Fütterungspläne
3. **Motor-Steuerung:** Manuell oder automatisch Futter ausgeben
4. **Monitoring:** Echtzeit-Überwachung von Gewicht und Füllstand
5. **Einstellungen:** System-, Netzwerk- und Zeit-Konfiguration

## 🔧 Konfiguration

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

### Netzwerk-Konfiguration

- **Production:** Reverse Proxy über `/api`
- **Development:** Direkte Backend-Verbindung auf Port 5000
- **Keine statischen IPs mehr erforderlich!**

## 📊 Optimierungen (Januar 2026)

Siehe [OPTIMIZATIONS.md](OPTIMIZATIONS.md) für Details:

- ✅ Nginx Reverse Proxy implementiert
- ✅ Keine statischen IPs mehr
- ✅ Memory Leaks behoben
- ✅ Production-Safe Logging
- ✅ Docker-Containerisierung
- ✅ Performance-Optimierungen (Gzip, Caching)
- ✅ Security Headers
- ✅ TypeScript Type Safety verbessert

## 🐛 Troubleshooting

### Häufige Probleme

**Backend nicht erreichbar:**
```bash
# Prüfe Backend Health
curl http://localhost/api/health

# Prüfe Logs
docker-compose logs backend
```

**Frontend zeigt Fehler:**
```bash
# Prüfe Nginx Logs
docker-compose logs nginx

# Prüfe Browser Console
# (F12 → Console)
```

**GPIO funktioniert nicht:**
```bash
# Prüfe Berechtigungen
docker-compose exec backend ls -l /dev/gpiomem
```

Weitere Hilfe: [DOCKER_SETUP.md](DOCKER_SETUP.md#troubleshooting)

## 📚 Dokumentation

- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Docker Setup & Deployment Guide
- **[OPTIMIZATIONS.md](OPTIMIZATIONS.md)** - Durchgeführte Optimierungen
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migration von älteren Versionen
- **[QUICK_START_MIGRATION.md](QUICK_START_MIGRATION.md)** - Schnellstart Migration

## 🤝 Entwicklung

### Lokale Development

```bash
# Frontend
cd frontend
npm start  # Port 3000

# Backend
cd backend
source env/bin/activate
python main.py  # Port 5000
```

### Code-Qualität

- TypeScript für Type Safety
- ESLint & Prettier (Frontend)
- Python Type Hints (Backend)
- Production-Safe Logging

## 📄 Lizenz

[Lizenz hier einfügen]

## 👥 Autoren

[Autoren hier einfügen]

## 🔗 Links

- GitHub: [Repository URL]
- Website: http://www.iotueli.ch

---

**Version:** 3.0
**Stand:** Januar 2026
**Optimiert mit:** Docker, Nginx, TypeScript
