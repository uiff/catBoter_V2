#!/bin/bash

###############################################################################
# CatBoter V3 - Docker Stop Script
# Stoppt das komplette System
###############################################################################

set -e

echo "🐱 CatBoter V3 - Stopping System"
echo "================================="
echo ""

# Verwende docker compose (v2) oder docker-compose (v1)
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
fi

echo "🛑 Stoppe alle Services..."
$DOCKER_COMPOSE down

echo ""
echo "✅ Alle Services gestoppt"
echo ""
echo "💡 Zum erneuten Starten:"
echo "   ./start-docker.sh"
echo ""
