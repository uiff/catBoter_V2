# Multi-Stage Build für optimiertes Backend Image
FROM python:3.11-slim-bookworm AS base

# Setze Arbeitsverzeichnis
WORKDIR /app

# System Dependencies für Hardware-Zugriff
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    git \
    libgpiod2 \
    i2c-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production Stage
FROM python:3.11-slim-bookworm

WORKDIR /app

# Kopiere installierte Packages vom Builder
COPY --from=base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=base /usr/local/bin /usr/local/bin

# Installiere nur Runtime Dependencies
RUN apt-get update && apt-get install -y \
    libgpiod2 \
    i2c-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Kopiere Anwendungscode
COPY . .

# Erstelle notwendige Verzeichnisse
RUN mkdir -p /app/data /app/feedingPlan /app/logs

# Berechtigungen setzen
RUN chmod -R 755 /app

# Non-root User für Sicherheit (außer bei GPIO Zugriff)
# RUN useradd -m -u 1000 catboter && chown -R catboter:catboter /app
# USER catboter

# Exponiere Port
EXPOSE 5000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Starte Anwendung
CMD ["python", "main.py"]
