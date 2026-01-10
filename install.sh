#!/bin/bash

###############################################################################
# CatBoter V3 - Installations-Script
# Automatische Installation und Konfiguration für Raspberry Pi
###############################################################################

set -e  # Bei Fehler abbrechen

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║         CatBoter V3 Installation           ║"
echo "║    Automatischer Katzenfutterspender       ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

REBOOT_REQUIRED=false

###############################################################################
# Funktion: Prüfe ob auf Raspberry Pi
###############################################################################
check_raspberry_pi() {
    echo -e "${BLUE}📋 Prüfe System...${NC}"

    if [ -f /proc/device-tree/model ]; then
        MODEL=$(cat /proc/device-tree/model)
        echo -e "${GREEN}✅ Raspberry Pi erkannt: ${MODEL}${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Warnung: Kein Raspberry Pi erkannt${NC}"
        read -p "Trotzdem fortfahren? (j/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Jj]$ ]]; then
            echo -e "${RED}Installation abgebrochen${NC}"
            exit 1
        fi
        return 1
    fi
}

###############################################################################
# Funktion: Prüfe und aktiviere I2C
###############################################################################
setup_i2c() {
    echo ""
    echo -e "${BLUE}🔌 Prüfe I2C Interface...${NC}"

    if i2cdetect -y 1 &>/dev/null; then
        echo -e "${GREEN}✅ I2C ist bereits aktiviert${NC}"
        return 0
    else
        echo -e "${YELLOW}❌ I2C ist nicht aktiviert${NC}"
        echo "   I2C wird für den Gewichtssensor (HX711) benötigt"

        read -p "I2C jetzt aktivieren? (j/n) " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Jj]$ ]]; then
            echo "   Aktiviere I2C..."

            # Methode 1: raspi-config (bevorzugt)
            if command -v raspi-config &> /dev/null; then
                sudo raspi-config nonint do_i2c 0
                echo -e "${GREEN}✅ I2C aktiviert (Neustart erforderlich)${NC}"
                REBOOT_REQUIRED=true
            else
                # Methode 2: Manuelle Konfiguration
                echo "   raspi-config nicht gefunden, verwende manuelle Konfiguration..."

                # /boot/config.txt oder /boot/firmware/config.txt
                CONFIG_FILE="/boot/config.txt"
                if [ ! -f "$CONFIG_FILE" ]; then
                    CONFIG_FILE="/boot/firmware/config.txt"
                fi

                if [ -f "$CONFIG_FILE" ]; then
                    if ! grep -q "^dtparam=i2c_arm=on" "$CONFIG_FILE"; then
                        echo "dtparam=i2c_arm=on" | sudo tee -a "$CONFIG_FILE" > /dev/null
                        echo -e "${GREEN}✅ I2C in $CONFIG_FILE aktiviert${NC}"
                    fi

                    # i2c-dev Modul aktivieren
                    if ! grep -q "^i2c-dev" /etc/modules; then
                        echo "i2c-dev" | sudo tee -a /etc/modules > /dev/null
                    fi

                    # Sofort laden (ohne Neustart für Test)
                    sudo modprobe i2c-dev 2>/dev/null || true

                    echo -e "${GREEN}✅ I2C konfiguriert (Neustart erforderlich)${NC}"
                    REBOOT_REQUIRED=true
                else
                    echo -e "${RED}❌ Boot-Konfigurationsdatei nicht gefunden${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  I2C wurde nicht aktiviert - Gewichtssensor wird nicht funktionieren${NC}"
        fi
    fi
}

###############################################################################
# Funktion: Prüfe und aktiviere SPI
###############################################################################
setup_spi() {
    echo ""
    echo -e "${BLUE}🔌 Prüfe SPI Interface...${NC}"

    if [ -e /dev/spidev0.0 ]; then
        echo -e "${GREEN}✅ SPI ist bereits aktiviert${NC}"
        return 0
    else
        echo -e "${YELLOW}❌ SPI ist nicht aktiviert${NC}"
        echo "   SPI wird für optionale Hardware-Erweiterungen benötigt"

        read -p "SPI jetzt aktivieren? (j/n) " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Jj]$ ]]; then
            echo "   Aktiviere SPI..."

            # Methode 1: raspi-config (bevorzugt)
            if command -v raspi-config &> /dev/null; then
                sudo raspi-config nonint do_spi 0
                echo -e "${GREEN}✅ SPI aktiviert (Neustart erforderlich)${NC}"
                REBOOT_REQUIRED=true
            else
                # Methode 2: Manuelle Konfiguration
                CONFIG_FILE="/boot/config.txt"
                if [ ! -f "$CONFIG_FILE" ]; then
                    CONFIG_FILE="/boot/firmware/config.txt"
                fi

                if [ -f "$CONFIG_FILE" ]; then
                    if ! grep -q "^dtparam=spi=on" "$CONFIG_FILE"; then
                        echo "dtparam=spi=on" | sudo tee -a "$CONFIG_FILE" > /dev/null
                        echo -e "${GREEN}✅ SPI in $CONFIG_FILE aktiviert${NC}"
                    fi

                    echo -e "${GREEN}✅ SPI konfiguriert (Neustart erforderlich)${NC}"
                    REBOOT_REQUIRED=true
                else
                    echo -e "${RED}❌ Boot-Konfigurationsdatei nicht gefunden${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  SPI wurde nicht aktiviert${NC}"
        fi
    fi
}

###############################################################################
# Funktion: Installiere Docker
###############################################################################
install_docker() {
    echo ""
    echo -e "${BLUE}🐳 Prüfe Docker Installation...${NC}"

    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        echo -e "${GREEN}✅ Docker ist bereits installiert: ${DOCKER_VERSION}${NC}"
        return 0
    else
        echo -e "${YELLOW}❌ Docker ist nicht installiert${NC}"

        read -p "Docker jetzt installieren? (j/n) " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Jj]$ ]]; then
            echo "   Installiere Docker (das kann einige Minuten dauern)..."

            # Offizielles Docker Installations-Script
            curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
            sudo sh /tmp/get-docker.sh
            rm /tmp/get-docker.sh

            # Aktuellen User zur docker Gruppe hinzufügen
            sudo usermod -aG docker $USER

            echo -e "${GREEN}✅ Docker erfolgreich installiert${NC}"
            echo -e "${YELLOW}   Hinweis: Gruppe 'docker' für User '$USER' hinzugefügt${NC}"
            echo -e "${YELLOW}   Sie müssen sich neu anmelden damit dies wirksam wird${NC}"

            return 0
        else
            echo -e "${RED}❌ Docker wird benötigt - Installation abgebrochen${NC}"
            exit 1
        fi
    fi
}

###############################################################################
# Funktion: Installiere Docker Compose
###############################################################################
install_docker_compose() {
    echo ""
    echo -e "${BLUE}🐳 Prüfe Docker Compose Installation...${NC}"

    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        echo -e "${GREEN}✅ Docker Compose ist bereits installiert: ${COMPOSE_VERSION}${NC}"
        return 0
    else
        echo -e "${YELLOW}❌ Docker Compose ist nicht installiert${NC}"

        read -p "Docker Compose jetzt installieren? (j/n) " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Jj]$ ]]; then
            echo "   Installiere Docker Compose..."

            # Installiere docker-compose via apt
            sudo apt-get update
            sudo apt-get install -y docker-compose

            echo -e "${GREEN}✅ Docker Compose erfolgreich installiert${NC}"
            return 0
        else
            echo -e "${RED}❌ Docker Compose wird benötigt - Installation abgebrochen${NC}"
            exit 1
        fi
    fi
}

###############################################################################
# Funktion: Installiere benötigte Pakete
###############################################################################
install_dependencies() {
    echo ""
    echo -e "${BLUE}📦 Prüfe System-Abhängigkeiten...${NC}"

    PACKAGES_TO_INSTALL=""

    # i2c-tools für I2C-Diagnose
    if ! command -v i2cdetect &> /dev/null; then
        PACKAGES_TO_INSTALL="$PACKAGES_TO_INSTALL i2c-tools"
    fi

    # git für Updates
    if ! command -v git &> /dev/null; then
        PACKAGES_TO_INSTALL="$PACKAGES_TO_INSTALL git"
    fi

    if [ -n "$PACKAGES_TO_INSTALL" ]; then
        echo "   Fehlende Pakete:$PACKAGES_TO_INSTALL"
        read -p "Pakete jetzt installieren? (j/n) " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Jj]$ ]]; then
            echo "   Installiere Pakete..."
            sudo apt-get update
            sudo apt-get install -y $PACKAGES_TO_INSTALL
            echo -e "${GREEN}✅ Pakete installiert${NC}"
        fi
    else
        echo -e "${GREEN}✅ Alle benötigten Pakete sind installiert${NC}"
    fi
}

###############################################################################
# Funktion: Erstelle Docker Compose Konfiguration
###############################################################################
create_docker_compose() {
    echo ""
    echo -e "${BLUE}📝 Erstelle Docker Compose Konfiguration...${NC}"

    if [ -f "docker-compose.yml" ]; then
        echo -e "${GREEN}✅ docker-compose.yml existiert bereits${NC}"
        return 0
    fi

    cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  catboter:
    build: .
    container_name: catboter_v3
    restart: unless-stopped
    privileged: true
    network_mode: host

    volumes:
      # Persistente Daten
      - ./backend/backend/data:/app/backend/backend/data
      - ./backend/feedingPlan:/app/backend/feedingPlan

      # Hardware-Zugriff (Raspberry Pi)
      - /dev:/dev
      - /sys:/sys

      # Optional: Boot-Konfiguration (für System-Setup in WebApp)
      - /boot:/boot:ro

    devices:
      - /dev/i2c-1:/dev/i2c-1
      - /dev/gpiomem:/dev/gpiomem

    environment:
      - TZ=Europe/Zurich
      - PYTHONUNBUFFERED=1
      - ENABLE_AUTO_SETUP=false

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF

    echo -e "${GREEN}✅ docker-compose.yml erstellt${NC}"
}

###############################################################################
# Funktion: Erstelle Dockerfile
###############################################################################
create_dockerfile() {
    echo ""
    echo -e "${BLUE}📝 Erstelle Dockerfile...${NC}"

    if [ -f "Dockerfile" ]; then
        echo -e "${GREEN}✅ Dockerfile existiert bereits${NC}"
        return 0
    fi

    cat > Dockerfile <<'EOF'
FROM python:3.11-slim

# System-Abhängigkeiten
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    i2c-tools \
    curl \
    nodejs \
    npm \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend Dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Frontend Dependencies
COPY frontend-new/package*.json /app/frontend-new/
WORKDIR /app/frontend-new
RUN npm ci

# Copy Application
WORKDIR /app
COPY . .

# Build Frontend
WORKDIR /app/frontend-new
RUN npm run build

# Startup Script
WORKDIR /app
COPY start.py /app/start.py
RUN chmod +x /app/start.py

EXPOSE 5000 5173

CMD ["python3", "start.py"]
EOF

    echo -e "${GREEN}✅ Dockerfile erstellt${NC}"
}

###############################################################################
# Funktion: Starte CatBoter Container
###############################################################################
start_catboter() {
    echo ""
    echo -e "${BLUE}🚀 Starte CatBoter Container...${NC}"

    # Stoppe alte Container falls vorhanden
    if docker ps -a | grep -q catboter_v3; then
        echo "   Stoppe alten Container..."
        docker-compose down 2>/dev/null || true
    fi

    echo "   Baue und starte Container (das kann beim ersten Mal einige Minuten dauern)..."
    docker-compose up -d --build

    echo ""
    echo -e "${GREEN}✅ CatBoter Container gestartet${NC}"

    # Warte kurz auf Container-Start
    sleep 3

    # Zeige Container Status
    echo ""
    echo -e "${BLUE}📊 Container Status:${NC}"
    docker-compose ps
}

###############################################################################
# Funktion: Zeige Zusammenfassung
###############################################################################
show_summary() {
    echo ""
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════╗"
    echo "║     Installation erfolgreich! 🎉           ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    # IP-Adresse ermitteln
    IP_ADDRESS=$(hostname -I | awk '{print $1}')

    echo -e "${BLUE}📱 WebApp Zugriff:${NC}"
    echo "   Frontend: http://${IP_ADDRESS}:5173"
    echo "   Backend:  http://${IP_ADDRESS}:5000"
    echo ""

    echo -e "${BLUE}🛠️  Nützliche Befehle:${NC}"
    echo "   Container anzeigen:    docker-compose ps"
    echo "   Logs anzeigen:         docker-compose logs -f"
    echo "   Container stoppen:     docker-compose down"
    echo "   Container neustarten:  docker-compose restart"
    echo ""

    if [ "$REBOOT_REQUIRED" = true ]; then
        echo -e "${YELLOW}"
        echo "╔════════════════════════════════════════════╗"
        echo "║  ⚠️  WICHTIG: Neustart erforderlich!      ║"
        echo "╚════════════════════════════════════════════╝"
        echo -e "${NC}"
        echo ""
        echo "Hardware-Schnittstellen (I2C/SPI) wurden aktiviert."
        echo "Ein Neustart ist erforderlich damit diese aktiv werden."
        echo ""

        read -p "Jetzt neu starten? (j/n) " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Jj]$ ]]; then
            echo "Neustart in 5 Sekunden..."
            sleep 5
            sudo reboot
        else
            echo ""
            echo "Bitte führen Sie manuell einen Neustart durch:"
            echo "  sudo reboot"
        fi
    fi
}

###############################################################################
# Hauptprogramm
###############################################################################
main() {
    # Prüfe ob als root ausgeführt
    if [ "$EUID" -eq 0 ]; then
        echo -e "${RED}❌ Bitte nicht als root ausführen!${NC}"
        echo "   Verwenden Sie: ./install.sh"
        exit 1
    fi

    # Prüfe ob in richtigem Verzeichnis
    if [ ! -f "README.md" ]; then
        echo -e "${RED}❌ Bitte im CatBoter Projekt-Verzeichnis ausführen${NC}"
        exit 1
    fi

    # Installations-Schritte
    check_raspberry_pi
    install_dependencies
    setup_i2c
    setup_spi
    install_docker
    install_docker_compose
    create_docker_compose
    create_dockerfile
    start_catboter
    show_summary
}

# Script starten
main
