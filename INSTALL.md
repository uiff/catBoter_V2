# 🚀 CatBoter V3 - Installationsanleitung

## 📋 Überblick

Diese Anleitung beschreibt die Installation von CatBoter V3 auf einem Raspberry Pi. Das automatische Installations-Script kümmert sich um alle notwendigen Schritte.

---

## 🎯 Schnellstart (Empfohlen)

### Einzeiler-Installation

```bash
curl -fsSL https://raw.githubusercontent.com/USERNAME/catBoterV3/main/install.sh | bash
```

⚠️ **Hinweis:** URL nach Upload des Projekts auf GitHub anpassen!

---

## 🛠️ Manuelle Installation mit Script

### 1. Repository herunterladen

```bash
# Via Git
git clone https://github.com/USERNAME/catBoterV3.git
cd catBoterV3

# Oder als ZIP herunterladen und entpacken
wget https://github.com/USERNAME/catBoterV3/archive/main.zip
unzip main.zip
cd catBoterV3-main
```

### 2. Installations-Script ausführen

```bash
chmod +x install.sh
./install.sh
```

### 3. Folgen Sie den Anweisungen

Das Script führt Sie durch folgende Schritte:

1. ✅ **System-Prüfung** - Erkennt Raspberry Pi Modell
2. ✅ **I2C Interface** - Aktivierung für Gewichtssensor
3. ✅ **SPI Interface** - Aktivierung für zusätzliche Hardware
4. ✅ **Docker Installation** - Falls noch nicht vorhanden
5. ✅ **Docker Compose** - Container-Orchestrierung
6. ✅ **System-Abhängigkeiten** - i2c-tools, git, etc.
7. ✅ **Container-Start** - Baut und startet CatBoter

---

## 📱 Nach der Installation

### WebApp öffnen

```bash
# IP-Adresse herausfinden
hostname -I

# Im Browser öffnen:
# http://[IP-ADRESSE]:5173  (Frontend)
# http://[IP-ADRESSE]:5000  (Backend API)
```

**Beispiel:** Wenn IP = `192.168.1.100`
- Frontend: http://192.168.1.100:5173
- Backend: http://192.168.1.100:5000

### Container-Verwaltung

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

## ⚙️ Was macht das Installations-Script?

### I2C Interface

**Wofür?** Kommunikation mit Gewichtssensor (HX711)

**Aktivierung:**
- Fügt `dtparam=i2c_arm=on` zu `/boot/config.txt` hinzu
- Lädt `i2c-dev` Kernel-Modul
- ⚠️ Neustart erforderlich!

**Prüfen:**
```bash
# I2C Geräte scannen
i2cdetect -y 1

# Sollte Grid mit Adressen zeigen
```

### SPI Interface

**Wofür?** Optionale Hardware-Erweiterungen

**Aktivierung:**
- Fügt `dtparam=spi=on` zu `/boot/config.txt` hinzu
- ⚠️ Neustart erforderlich!

**Prüfen:**
```bash
ls /dev/spidev*
# Sollte /dev/spidev0.0 und /dev/spidev0.1 zeigen
```

### Docker Installation

**Was wird installiert:**
- Docker Engine (Container Runtime)
- Docker Compose (Multi-Container Verwaltung)
- User wird zu `docker` Gruppe hinzugefügt

**Neuanmeldung erforderlich:**
```bash
# Nach Docker-Installation
su - $USER
# Oder komplett abmelden und neu anmelden
```

---

## 🐳 Docker Konfiguration

### docker-compose.yml

Das Script erstellt automatisch eine `docker-compose.yml` mit:

```yaml
services:
  catboter:
    privileged: true        # Hardware-Zugriff
    network_mode: host      # Direkter Netzwerk-Zugriff

    volumes:
      - ./backend/backend/data:/app/backend/backend/data  # Daten
      - ./backend/feedingPlan:/app/backend/feedingPlan    # Pläne
      - /dev:/dev                                         # Hardware
      - /sys:/sys                                         # System

    devices:
      - /dev/i2c-1:/dev/i2c-1      # I2C
      - /dev/gpiomem:/dev/gpiomem  # GPIO
```

**Wichtig:**
- `privileged: true` - Erlaubt Hardware-Zugriff
- `network_mode: host` - Container nutzt Host-Netzwerk
- Volumes - Daten bleiben auch nach Container-Neustart erhalten

---

## 🔧 Manuelle Konfiguration (ohne Script)

Falls das Script nicht funktioniert oder Sie alles manuell machen möchten:

### 1. I2C aktivieren

```bash
# Via raspi-config
sudo raspi-config nonint do_i2c 0

# Oder manuell
echo "dtparam=i2c_arm=on" | sudo tee -a /boot/config.txt
echo "i2c-dev" | sudo tee -a /etc/modules
sudo modprobe i2c-dev
```

### 2. SPI aktivieren

```bash
# Via raspi-config
sudo raspi-config nonint do_spi 0

# Oder manuell
echo "dtparam=spi=on" | sudo tee -a /boot/config.txt
```

### 3. Docker installieren

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose
```

### 4. System-Pakete

```bash
sudo apt-get update
sudo apt-get install -y \
    i2c-tools \
    git \
    curl
```

### 5. CatBoter starten

```bash
cd catBoterV3
docker-compose up -d --build
```

---

## 🔍 Troubleshooting

### Problem: I2C nicht verfügbar

```bash
# Prüfen ob aktiviert
ls /dev/i2c-*

# Wenn nicht vorhanden:
sudo raspi-config nonint do_i2c 0
sudo reboot

# Nach Neustart prüfen:
i2cdetect -y 1
```

### Problem: Docker Befehle erfordern sudo

```bash
# User zur docker Gruppe hinzufügen
sudo usermod -aG docker $USER

# Abmelden und neu anmelden
su - $USER

# Prüfen
docker ps  # Sollte ohne sudo funktionieren
```

### Problem: Container startet nicht

```bash
# Logs prüfen
docker-compose logs

# Detaillierte Logs
docker-compose logs -f --tail=100

# Container-Status
docker-compose ps

# Container neu bauen
docker-compose down
docker-compose up -d --build
```

### Problem: Hardware nicht erkannt

```bash
# In Container einloggen
docker exec -it catboter_v3 bash

# I2C prüfen
i2cdetect -y 1

# GPIO prüfen
ls -l /dev/gpiomem

# Sollte Zugriff haben
```

### Problem: Port 5000 oder 5173 bereits belegt

```bash
# Prüfe welcher Prozess den Port verwendet
sudo lsof -i :5000
sudo lsof -i :5173

# Process stoppen oder anderen Port verwenden
# Ports in docker-compose.yml ändern
```

---

## 🔐 Sicherheitshinweise

### Produktions-Umgebung

Für den Produktions-Einsatz empfohlen:

1. **Firewall konfigurieren:**
```bash
sudo ufw allow 5000/tcp
sudo ufw allow 5173/tcp
sudo ufw enable
```

2. **Reverse Proxy mit SSL:**
```bash
# Nginx mit Let's Encrypt
sudo apt-get install nginx certbot
# Konfiguration siehe NGINX_SETUP.md
```

3. **Passwort-Schutz:**
```bash
# In zukünftiger Version verfügbar
# Backend wird Authentifizierung unterstützen
```

---

## 📦 System-Anforderungen

### Minimum

- **Raspberry Pi 3B oder neuer**
- **1 GB RAM** (2 GB empfohlen)
- **8 GB SD-Karte** (16 GB empfohlen)
- **Raspbian OS** (Bookworm oder neuer)
- **Internet-Verbindung** (für Installation)

### Empfohlen

- **Raspberry Pi 4** (2 GB RAM oder mehr)
- **32 GB SD-Karte** (für Logs und Daten)
- **Ethernet-Verbindung** (stabiler als WiFi)

### Getestet auf

- ✅ Raspberry Pi 4 Model B (4 GB)
- ✅ Raspberry Pi Zero 2 W
- ✅ Raspberry Pi 3 Model B+

---

## 🔄 Updates

### Container Update

```bash
cd catBoterV3

# Neueste Version holen
git pull

# Container neu bauen
docker-compose down
docker-compose up -d --build
```

### System Update

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo reboot
```

---

## 📞 Support

### Logs sammeln

Bei Problemen, sende folgende Informationen:

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

### Community

- **GitHub Issues:** [Repository URL]/issues
- **Website:** http://www.iotueli.ch

---

## 🎉 Fertig!

Nach erfolgreicher Installation können Sie:

1. ✅ WebApp im Browser öffnen
2. ✅ Fütterungspläne erstellen
3. ✅ Hardware testen (Sensoren, Motor)
4. ✅ System überwachen

**Viel Spaß mit CatBoter V3!** 🐱

---

**Version:** 1.0
**Letzte Aktualisierung:** Januar 2026
