#!/bin/bash

###############################################################################
# CatBoter V3 - Docker Start Script
# Startet das komplette System mit Docker Compose
###############################################################################

set -e  # Beende bei Fehler

echo "🐱 CatBoter V3 - Starting System with Docker Compose"
echo "=================================================="
echo ""

# Prüfe ob Docker läuft
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker ist nicht erreichbar. Bitte starte Docker erst."
    exit 1
fi

# Prüfe ob docker-compose installiert ist
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo "❌ docker-compose ist nicht installiert."
    exit 1
fi

# Verwende docker compose (v2) oder docker-compose (v1)
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
fi

echo "✅ Docker gefunden"
echo "📦 Verwende: $DOCKER_COMPOSE"
echo ""

# Optional: Build Frontend falls noch nicht gebaut
if [ ! -d "./frontend/build" ]; then
    echo "🔨 Frontend Build nicht gefunden, baue Frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
    echo "✅ Frontend gebaut"
    echo ""
fi

# Stoppe alte Container
echo "🛑 Stoppe alte Container..."
$DOCKER_COMPOSE down

echo ""
echo "🚀 Starte Services..."
echo "   - Nginx Reverse Proxy (Port 80)"
echo "   - Backend (Flask API)"
echo "   - Frontend (React App)"
echo ""

# Starte Container
$DOCKER_COMPOSE up -d --build

echo ""
echo "⏳ Warte auf Services..."
sleep 5

# Zeige Status
echo ""
echo "📊 Service Status:"
$DOCKER_COMPOSE ps

echo ""
echo "✅ CatBoter V3 gestartet!"
echo ""
echo "🌐 Zugriff über:"
echo "   - Frontend: http://localhost"
echo "   - Backend API: http://localhost/api"
echo "   - Health Check: http://localhost/health"
echo ""
echo "📝 Logs anzeigen:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stoppen:"
echo "   docker-compose down"
echo ""
