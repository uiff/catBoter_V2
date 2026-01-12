#!/bin/bash

# CatBoter Backup Script
BACKUP_NAME="catboter-backup-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/home/iotueli/Desktop/$BACKUP_NAME"

echo "Creating backup: $BACKUP_NAME"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Copy project files
echo "Copying project files..."
cp -r /home/iotueli/Desktop/catBoterV3 "$BACKUP_DIR/"

# Export Docker volumes data
echo "Exporting configuration files..."
mkdir -p "$BACKUP_DIR/docker-data"

# Backend data
sudo cp -r /var/lib/docker/volumes/catboterv3_backend_data/_data "$BACKUP_DIR/docker-data/backend_data" 2>/dev/null || echo "Backend data not found"
sudo cp -r /var/lib/docker/volumes/catboterv3_frontend_dist/_data "$BACKUP_DIR/docker-data/frontend_dist" 2>/dev/null || echo "Frontend dist not found"

# Fix permissions
sudo chown -R iotueli:iotueli "$BACKUP_DIR/docker-data"

# Create archive
echo "Creating archive..."
cd /home/iotueli/Desktop
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"

# Cleanup
rm -rf "$BACKUP_DIR"

echo "✅ Backup created: /home/iotueli/Desktop/${BACKUP_NAME}.tar.gz"
echo ""
echo "To download on your computer, run:"
echo "scp iotueli@192.168.0.18:/home/iotueli/Desktop/${BACKUP_NAME}.tar.gz ~/Downloads/"
