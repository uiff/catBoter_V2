#!/bin/bash
# CatBoter V3 - Production Start Script
# Startet das System im Produktiv-Modus (Port 80)

set -e

echo "🚀 CatBoter V3 - Production Start"
echo "=================================="
echo ""

# Prüfe ob Docker installiert ist
if ! command -v docker &> /dev/null; then
    echo "❌ Docker nicht installiert!"
    echo "   Führe aus: ./install.sh"
    exit 1
fi

# Wechsle in Projekt-Verzeichnis
cd "$(dirname "$0")"

echo "🛑 Stoppe Development Server..."
pkill -f "vite" 2>/dev/null || true
pkill -f "python.*main.py" 2>/dev/null || true

echo ""
echo "🐳 Stoppe alte Docker Container..."
sudo docker-compose down 2>/dev/null || true

echo ""
echo "🔨 Baue Docker Images..."
sudo docker-compose build

echo ""
echo "▶️  Starte Docker Container..."
sudo docker-compose up -d

echo ""
echo "⏳ Warte auf Services (15 Sekunden)..."
sleep 15

echo ""
echo "✅ Status der Container:"
sudo docker-compose ps

echo ""
echo "📊 Logs (letzte 10 Zeilen):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
sudo docker-compose logs --tail=10

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CatBoter V3 läuft!"
echo ""
echo "📱 Zugriff über:"
echo "   • http://$(hostname -I | awk '{print $1}')"
echo "   • http://catboter.local (nach Hostname-Setup)"
echo ""
echo "💡 Nützliche Befehle:"
echo "   sudo docker-compose logs -f      # Live Logs"
echo "   sudo docker-compose restart      # Neustart"
echo "   sudo docker-compose down         # Stoppen"
echo ""
