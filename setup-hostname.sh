#!/bin/bash
# CatBoter V3 - Hostname Setup Script
# Richtet mDNS/Avahi ein damit das System über catboter.local erreichbar ist

set -e

echo "🔧 CatBoter V3 - Hostname Setup"
echo "================================"
echo ""

# Prüfe ob auf Raspberry Pi
if [[ ! -f /proc/device-tree/model ]] || ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "⚠️  Warnung: Dies scheint kein Raspberry Pi zu sein"
    echo "   Das Skript funktioniert am besten auf Raspberry Pi OS"
    read -p "Trotzdem fortfahren? (j/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Jj]$ ]]; then
        exit 1
    fi
fi

echo "📦 Installiere Avahi (mDNS)..."
sudo apt-get update
sudo apt-get install -y avahi-daemon avahi-utils

echo ""
echo "⚙️  Konfiguriere Hostname..."

# Setze Hostname auf catboter
CURRENT_HOSTNAME=$(hostname)
NEW_HOSTNAME="catboter"

if [ "$CURRENT_HOSTNAME" != "$NEW_HOSTNAME" ]; then
    echo "   Aktueller Hostname: $CURRENT_HOSTNAME"
    echo "   Neuer Hostname: $NEW_HOSTNAME"

    read -p "Hostname ändern? (j/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Jj]$ ]]; then
        # Ändere Hostname
        echo "$NEW_HOSTNAME" | sudo tee /etc/hostname > /dev/null
        sudo sed -i "s/$CURRENT_HOSTNAME/$NEW_HOSTNAME/g" /etc/hosts
        sudo hostnamectl set-hostname "$NEW_HOSTNAME"
        echo "   ✅ Hostname geändert"
    fi
else
    echo "   ✅ Hostname ist bereits 'catboter'"
fi

echo ""
echo "🚀 Starte Avahi Dienst..."
sudo systemctl enable avahi-daemon
sudo systemctl restart avahi-daemon

echo ""
echo "🔍 Prüfe mDNS Status..."
sleep 2

if avahi-browse -at 2>/dev/null | grep -q "catboter"; then
    echo "   ✅ mDNS funktioniert!"
else
    echo "   ⚠️  mDNS Status unklar - prüfe manuell mit: avahi-browse -at"
fi

echo ""
echo "✅ Setup abgeschlossen!"
echo ""
echo "📋 Zugriff auf CatBoter:"
echo "   • http://catboter.local        (über mDNS)"
echo "   • http://$(hostname -I | awk '{print $1}')  (über IP)"
echo ""
echo "💡 Tipp: Falls 'catboter.local' nicht funktioniert:"
echo "   1. Stelle sicher dass dein Gerät im gleichen Netzwerk ist"
echo "   2. Manche Windows-Versionen benötigen Bonjour/iTunes"
echo "   3. Verwende die IP-Adresse als Fallback"
echo ""
echo "🔄 System-Neustart empfohlen für vollständige Aktivierung"
read -p "Jetzt neustarten? (j/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    sudo reboot
fi
