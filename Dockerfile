# CatBoter V3 - Multi-Stage Docker Build
# Optimiert für Raspberry Pi und x86_64

# Stage 1: Frontend Build
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend-new

# Copy package files
COPY frontend-new/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy frontend source
COPY frontend-new/ ./

# Build frontend
RUN npm run build

# Stage 2: Python Runtime
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    i2c-tools \
    curl \
    git \
    hostapd \
    dnsmasq \
    wireless-tools \
    net-tools \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt /app/backend/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend code
COPY backend/ /app/backend/

# Copy frontend build from builder stage
COPY --from=frontend-builder /app/frontend-new/dist /app/frontend-new/dist
COPY --from=frontend-builder /app/frontend-new/package.json /app/frontend-new/package.json

# Copy other necessary files
COPY start.py /app/start.py
COPY install.sh /app/install.sh

# Create necessary directories
RUN mkdir -p /app/backend/backend/data \
    /app/backend/feedingPlan \
    /app/backend/system \
    /app/logs

# Set permissions
RUN chmod +x /app/start.py /app/install.sh

# Expose ports
EXPOSE 5000 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    FLASK_APP=main.py \
    FLASK_ENV=production \
    TZ=Europe/Zurich

# Run application
CMD ["python3", "/app/start.py"]
