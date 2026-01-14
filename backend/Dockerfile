# Optimized Single-Stage Build für Raspberry Pi
FROM python:3.11-slim-bookworm

# Setze Zeitzone auf Europe/Zurich
ENV TZ=Europe/Zurich
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Setze Arbeitsverzeichnis
WORKDIR /app

# Build und Runtime Dependencies in einem Schritt (optimiert für Raspberry Pi)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build Dependencies (werden später entfernt)
    gcc \
    g++ \
    git \
    # Runtime Dependencies (bleiben im Image)
    libgpiod2 \
    i2c-tools \
    curl \
    # Network Tools für WiFi-Status
    wireless-tools \
    iproute2 \
    wpasupplicant \
    && rm -rf /var/lib/apt/lists/*

# Python Dependencies installieren
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Build Dependencies entfernen um Image zu verkleinern
RUN apt-get purge -y gcc g++ git \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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
