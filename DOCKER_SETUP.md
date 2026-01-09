# CatBoter V3 - Docker Setup & Deployment

## 🚀 Schnellstart

### Voraussetzungen
- Docker (Version 20.10+)
- Docker Compose (Version 2.0+)
- Raspberry Pi (für Hardware-Zugriff) oder Linux System

### System mit Docker starten

```bash
# Einfacher Start
./start-docker.sh

# Oder manuell
docker-compose up -d --build
```

### System stoppen

```bash
# Einfacher Stop
./stop-docker.sh

# Oder manuell
docker-compose down
```

## 📐 Architektur

Das System besteht aus 3 Containern:

```
┌─────────────────────────────────────────┐
│          Nginx Reverse Proxy            │
│            (Port 80/443)                │
│  - Statische Files (React Frontend)    │
│  - API Routing zu Backend              │
└─────────────────────────────────────────┘
              ↓                ↓
    ┌─────────────┐    ┌─────────────┐
    │  Frontend   │    │  Backend    │
    │   (React)   │    │  (Flask)    │
    │             │    │  Port 5000  │
    └─────────────┘    └─────────────┘
```

### URL-Routing

| Anfrage | Ziel | Beschreibung |
|---------|------|--------------|
| `http://localhost/` | Frontend | React App |
| `http://localhost/api/*` | Backend | Flask API (ohne `/api` Prefix) |
| `http://localhost/health` | Backend | Health Check |
| `http://localhost/swagger` | Backend | API Dokumentation |

## 🔧 Konfiguration

### Umgebungsvariablen

Kopiere `.env.example` zu `.env` und passe an:

```bash
cp .env.example .env
nano .env
```

Wichtige Variablen:
- `FLASK_ENV` - production/development
- `LOG_LEVEL` - INFO/DEBUG/WARNING
- `GPIO_ENABLED` - true/false (für Raspberry Pi Hardware)

### Nginx Konfiguration

Die Nginx-Konfiguration befindet sich in:
- `nginx/nginx.conf` - Hauptkonfiguration
- `nginx/conf.d/catboter.conf` - Service-spezifische Konfiguration

## 🏗️ Build & Development

### Frontend Development

```bash
cd frontend

# Installation
npm install

# Development Server (Port 3000)
npm start

# Production Build
npm run build
```

### Backend Development

```bash
cd backend

# Virtual Environment
python3 -m venv env
source env/bin/activate

# Installation
pip install -r requirements.txt

# Starten
python main.py
```

### Docker Build ohne Cache

```bash
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Logs & Monitoring

### Container Logs anzeigen

```bash
# Alle Container
docker-compose logs -f

# Nur Backend
docker-compose logs -f backend

# Nur Nginx
docker-compose logs -f nginx

# Letzte 100 Zeilen
docker-compose logs --tail=100 backend
```

### Container Status

```bash
docker-compose ps
```

### In Container einsteigen

```bash
# Backend
docker-compose exec backend bash

# Nginx
docker-compose exec nginx sh
```

## 🔒 Sicherheit

### Production Checkliste

- [ ] `.env` Datei mit sicheren Credentials erstellen
- [ ] `SECRET_KEY` und `API_KEY` ändern
- [ ] HTTPS aktivieren (siehe unten)
- [ ] Firewall konfigurieren
- [ ] Regelmäßige Updates durchführen

### HTTPS Setup (Optional)

1. SSL-Zertifikate erstellen/erhalten:

```bash
# Self-Signed (für Tests)
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem

# Oder Let's Encrypt verwenden
```

2. HTTPS-Block in `nginx/conf.d/catboter.conf` auskommentieren

3. Ports in `docker-compose.yml` anpassen:
```yaml
ports:
  - "80:80"
  - "443:443"
```

## 🐛 Troubleshooting

### Container startet nicht

```bash
# Logs prüfen
docker-compose logs backend

# Container Status
docker-compose ps

# Ports prüfen
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :5000
```

### Frontend zeigt "Backend nicht erreichbar"

1. Prüfe ob Backend läuft:
```bash
curl http://localhost/api/health
```

2. Prüfe Nginx Logs:
```bash
docker-compose logs nginx | grep error
```

3. Prüfe Backend Logs:
```bash
docker-compose logs backend
```

### GPIO/Hardware funktioniert nicht

1. Prüfe `privileged: true` in `docker-compose.yml`
2. Prüfe Device Mappings:
```bash
docker-compose exec backend ls -l /dev/gpiomem
```

## 🔄 Updates & Wartung

### System Update

```bash
# Container stoppen
docker-compose down

# Code aktualisieren (git)
git pull

# Neu bauen und starten
docker-compose up -d --build
```

### Datenbank Backup

```bash
# Daten sichern
docker-compose exec backend tar -czf /tmp/backup.tar.gz /app/data /app/feedingPlan

# Backup kopieren
docker cp catboter_backend:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz
```

### Container neu bauen

```bash
# Alle Container neu bauen
docker-compose build --no-cache

# Nur Backend neu bauen
docker-compose build --no-cache backend
```

## 📱 Zugriff von anderen Geräten

### Im lokalen Netzwerk

1. Finde die IP-Adresse des Raspberry Pi:
```bash
hostname -I
```

2. Greife von anderen Geräten zu:
```
http://<raspberry-pi-ip>/
```

### Port Forwarding (für externen Zugriff)

⚠️ **Nur mit HTTPS und starker Authentifizierung!**

1. Router konfigurieren: Port 80/443 → Raspberry Pi
2. DynDNS einrichten (z.B. No-IP, DuckDNS)
3. HTTPS aktivieren (siehe oben)

## 🎯 Performance Optimierung

### Container Resources begrenzen

In `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          memory: 256M
```

### Nginx Caching

Bereits konfiguriert für:
- Static Assets: 1 Jahr Cache
- API Responses: Kein Cache
- HTML: Kein Cache (für SPA)

## 📚 Weitere Dokumentation

- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Migration von alten Versionen
- [QUICK_START_MIGRATION.md](QUICK_START_MIGRATION.md) - Schnelle Migration
- [README.md](README.md) - Projekt Übersicht
