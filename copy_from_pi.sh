#!/bin/bash
# CatBot - Projekt vom Raspberry Pi kopieren
# Dieses Script hilft beim Kopieren des Projekts vom Pi auf Ihren Computer

echo "========================================"
echo "  CatBot - Projekt vom Pi kopieren"
echo "========================================"
echo ""

# Farben für Terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Raspberry Pi IP abfragen
echo -e "${YELLOW}Schritt 1: Raspberry Pi IP-Adresse${NC}"
read -p "Geben Sie die IP-Adresse Ihres Raspberry Pi ein (z.B. 192.168.1.100): " PI_IP

if [ -z "$PI_IP" ]; then
    echo -e "${RED}Fehler: IP-Adresse darf nicht leer sein!${NC}"
    exit 1
fi

# Zielverzeichnis abfragen
echo ""
echo -e "${YELLOW}Schritt 2: Zielverzeichnis${NC}"
echo "Standardmäßig wird das Projekt nach ~/Desktop/catBoterV3 kopiert"
read -p "Anderes Verzeichnis? (Enter für Standard): " TARGET_DIR

if [ -z "$TARGET_DIR" ]; then
    TARGET_DIR="$HOME/Desktop/catBoterV3"
fi

echo ""
echo -e "${GREEN}Zusammenfassung:${NC}"
echo "  Quelle:      pi@$PI_IP:/home/iotueli/Desktop/catBoterV3/"
echo "  Ziel:        $TARGET_DIR"
echo ""

read -p "Fortfahren? (j/n): " confirm
if [[ ! $confirm =~ ^[jJyY]$ ]]; then
    echo "Abgebrochen."
    exit 0
fi

echo ""
echo -e "${YELLOW}Schritt 3: Projekt kopieren...${NC}"

# Prüfe ob rsync verfügbar ist
if command -v rsync &> /dev/null; then
    echo "Verwende rsync (mit Fortschrittsanzeige)..."
    rsync -avz --progress "pi@$PI_IP:/home/iotueli/Desktop/catBoterV3/" "$TARGET_DIR/"
    COPY_STATUS=$?
else
    echo "rsync nicht gefunden, verwende scp..."
    scp -r "pi@$PI_IP:/home/iotueli/Desktop/catBoterV3" "$TARGET_DIR"
    COPY_STATUS=$?
fi

if [ $COPY_STATUS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Projekt erfolgreich kopiert!${NC}"
    echo ""
    echo -e "${YELLOW}Nächste Schritte:${NC}"
    echo ""
    echo "1. Wechseln Sie ins Verzeichnis:"
    echo "   cd $TARGET_DIR"
    echo ""
    echo "2. Lesen Sie die Migrations-Anleitung:"
    echo "   cat MIGRATION_GUIDE.md"
    echo ""
    echo "3. Setup durchführen:"
    echo "   - Python Virtual Environment erstellen"
    echo "   - Backend-Dependencies installieren"
    echo "   - Frontend builden"
    echo ""
    echo "Detaillierte Anleitung in: $TARGET_DIR/MIGRATION_GUIDE.md"
else
    echo ""
    echo -e "${RED}✗ Fehler beim Kopieren!${NC}"
    echo ""
    echo "Mögliche Ursachen:"
    echo "  - Falsche IP-Adresse"
    echo "  - SSH-Verbindung nicht möglich"
    echo "  - Falsches Passwort"
    echo "  - Raspberry Pi nicht erreichbar"
    echo ""
    echo "Versuchen Sie manuell:"
    echo "  scp -r pi@$PI_IP:/home/iotueli/Desktop/catBoterV3 $TARGET_DIR"
fi
