# Single-Stage Build für Raspberry Pi mit Netzwerk-Management
FROM python:3.11-slim-bookworm

# Setze Arbeitsverzeichnis
WORKDIR /app

# System Dependencies für Hardware-Zugriff und Netzwerk-Management
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    git \
    libgpiod2 \
    i2c-tools \
    curl \
    iproute2 \
    wireless-tools \
    iw \
    wpasupplicant \
    dbus \
    network-manager \
    sudo \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopiere Anwendungscode
COPY . .

# Erstelle notwendige Verzeichnisse
RUN mkdir -p /app/data /app/feedingPlan /app/logs

# Berechtigungen setzen
RUN chmod -R 755 /app

# Exponiere Port
EXPOSE 5000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Starte Anwendung
CMD ["python", "main.py"]
