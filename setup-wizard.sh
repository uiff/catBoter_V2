#!/bin/bash

###############################################################################
#                                                                             #
#                          CatBoter Setup Wizard                              #
#                                                                             #
#  Dieses Skript installiert automatisch alle Abhängigkeiten und             #
#  konfiguriert CatBoter auf einem frischen Raspberry Pi                     #
#                                                                             #
###############################################################################

set -e  # Bei Fehler abbrechen

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
clear
echo -e "${BLUE}"
cat << "EOF"
   ____      _   ____        _             __     ______
  / ___|__ _| |_| __ )  ___ | |_ ___ _ __ \ \   / /___ \
 | |   / _` | __|  _ \ / _ \| __/ _ \ '__| \ \ / /  __) |
 | |__| (_| | |_| |_) | (_) | ||  __/ |     \ V /  / __/
  \____\__,_|\__|____/ \___/ \__\___|_|      \_/  |_____|

           Automatisches Setup für Raspberry Pi

EOF
echo -e "${NC}"

# Funktion für Statusmeldungen
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Root-Check
if [ "$EUID" -eq 0 ]; then
    print_error "Bitte nicht als root ausführen! Nutze stattdessen sudo wenn nötig."
    exit 1
fi

# Willkommensnachricht
echo ""
print_status "Willkommen beim CatBoter V3 Setup Wizard!"
echo ""
echo "Dieses Skript wird automatisch:"
echo "  • System-Updates installieren"
echo "  • Docker & Docker Compose installieren"
echo "  • I2C und erforderliche Kernel-Module aktivieren"
echo "  • CatBoter V3 konfigurieren und starten"
echo ""
read -p "Möchten Sie fortfahren? (j/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[JjYy]$ ]]; then
    print_warning "Installation abgebrochen."
    exit 0
fi

###############################################################################
# 1. System-Updates
###############################################################################
echo ""
print_status "Schritt 1/6: System-Updates werden installiert..."
sudo apt-get update
sudo apt-get upgrade -y
print_success "System aktualisiert"

###############################################################################
# 2. Docker installieren
###############################################################################
echo ""
print_status "Schritt 2/6: Docker wird installiert..."

if command -v docker &> /dev/null; then
    print_warning "Docker ist bereits installiert ($(docker --version))"
else
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh

    # Aktuellen Benutzer zu docker-Gruppe hinzufügen
    sudo usermod -aG docker $USER
    print_success "Docker installiert"
fi

###############################################################################
# 3. Docker Compose installieren
###############################################################################
echo ""
print_status "Schritt 3/6: Docker Compose wird installiert..."

if command -v docker-compose &> /dev/null; then
    print_warning "Docker Compose ist bereits installiert ($(docker-compose --version))"
else
    sudo apt-get install -y docker-compose
    print_success "Docker Compose installiert"
fi

###############################################################################
# 4. I2C und Kernel-Module aktivieren
###############################################################################
echo ""
print_status "Schritt 4/6: I2C und Kernel-Module werden aktiviert..."

# I2C aktivieren
if ! grep -q "^dtparam=i2c_arm=on" /boot/firmware/config.txt 2>/dev/null && \
   ! grep -q "^dtparam=i2c_arm=on" /boot/config.txt 2>/dev/null; then
    if [ -f /boot/firmware/config.txt ]; then
        echo "dtparam=i2c_arm=on" | sudo tee -a /boot/firmware/config.txt > /dev/null
    else
        echo "dtparam=i2c_arm=on" | sudo tee -a /boot/config.txt > /dev/null
    fi
    print_success "I2C aktiviert"
else
    print_warning "I2C ist bereits aktiviert"
fi

# I2C-Tools installieren
sudo apt-get install -y i2c-tools

# I2C-Modul laden
if ! lsmod | grep -q i2c_dev; then
    sudo modprobe i2c-dev
    echo "i2c-dev" | sudo tee -a /etc/modules > /dev/null
    print_success "I2C-Modul geladen"
else
    print_warning "I2C-Modul ist bereits geladen"
fi

# Benutzer zu i2c-Gruppe hinzufügen
sudo usermod -aG i2c $USER

print_success "I2C konfiguriert"

###############################################################################
# 5. Hostname konfigurieren (optional)
###############################################################################
echo ""
print_status "Schritt 5/6: Hostname-Konfiguration (optional)..."
echo ""
echo "Möchten Sie einen benutzerdefinierten Hostname setzen?"
echo "Dies ermöglicht den Zugriff über z.B. http://catboter.local"
echo ""
read -p "Hostname ändern? (j/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[JjYy]$ ]]; then
    read -p "Neuer Hostname (z.B. 'catboter'): " NEW_HOSTNAME

    if [ ! -z "$NEW_HOSTNAME" ]; then
        # Hostname setzen
        echo "$NEW_HOSTNAME" | sudo tee /etc/hostname > /dev/null
        sudo sed -i "s/127.0.1.1.*/127.0.1.1\t$NEW_HOSTNAME/g" /etc/hosts

        # Avahi (mDNS) installieren für .local Zugriff
        sudo apt-get install -y avahi-daemon avahi-utils
        sudo systemctl enable avahi-daemon
        sudo systemctl start avahi-daemon

        print_success "Hostname auf '$NEW_HOSTNAME' gesetzt"
        print_success "Nach dem Neustart erreichbar unter: http://$NEW_HOSTNAME.local"
    fi
else
    print_warning "Hostname-Konfiguration übersprungen"
fi

###############################################################################
# 6. CatBoter V3 aufsetzen
###############################################################################
echo ""
print_status "Schritt 6/6: CatBoter V3 wird konfiguriert..."

# Zum Projektverzeichnis wechseln
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Docker Images bauen und Container starten
print_status "Docker Images werden gebaut (dies kann einige Minuten dauern)..."
sudo docker-compose build

print_status "Container werden gestartet..."
sudo docker-compose up -d

# Warten bis Container bereit sind
print_status "Warte auf Container-Start..."
sleep 10

# Status prüfen
if sudo docker-compose ps | grep -q "Up"; then
    print_success "CatBoter V3 Container laufen!"
else
    print_error "Container konnten nicht gestartet werden"
    print_status "Führe 'sudo docker-compose logs' aus für Details"
    exit 1
fi

###############################################################################
# Abschluss
###############################################################################
echo ""
echo -e "${GREEN}"
cat << "EOF"
  ___           _        _ _       _   _
 |_ _|_ __  ___| |_ __ _| | | __ _| |_(_) ___  _ __
  | || '_ \/ __| __/ _` | | |/ _` | __| |/ _ \| '_ \
  | || | | \__ \ || (_| | | | (_| | |_| | (_) | | | |
 |___|_| |_|___/\__\__,_|_|_|\__,_|\__|_|\___/|_| |_|

        __           _       _
   ___ / _| ___  ___| |_ ___| |_
  / _ \ |_ / _ \| __| __/ _ \ __|
 |  __/  _| (_) | |_| ||  __/ |_
  \___|_|  \___/ \__|\__\___|\__|

EOF
echo -e "${NC}"

print_success "CatBoter V3 wurde erfolgreich installiert!"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Zugriff auf das Frontend:"
echo "  → http://$(hostname -I | awk '{print $1}')"
if [ ! -z "$NEW_HOSTNAME" ]; then
    echo "  → http://$NEW_HOSTNAME.local (nach Neustart)"
fi
echo ""
echo "  Nützliche Befehle:"
echo "  → Container-Status:    sudo docker-compose ps"
echo "  → Logs ansehen:        sudo docker-compose logs -f"
echo "  → Container stoppen:   sudo docker-compose down"
echo "  → Container starten:   sudo docker-compose up -d"
echo "  → Container neustarten: sudo docker-compose restart"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Neustart empfehlen wenn I2C oder Hostname geändert wurde
if [[ $REPLY =~ ^[JjYy]$ ]] || ! lsmod | grep -q i2c_bcm2835; then
    echo ""
    print_warning "WICHTIG: Ein Neustart wird empfohlen, damit alle Änderungen wirksam werden"
    echo ""
    read -p "Jetzt neu starten? (j/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[JjYy]$ ]]; then
        print_status "System wird neu gestartet..."
        sudo reboot
    else
        print_warning "Bitte führe 'sudo reboot' manuell aus, um alle Änderungen zu aktivieren"
    fi
fi

echo ""
print_success "Setup abgeschlossen! Viel Spaß mit CatBoter V3! 🐱"
echo ""
