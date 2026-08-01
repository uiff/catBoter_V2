#!/bin/bash

# CatBoter Backup Script
# Seit dem Umbau liegen ALLE Laufzeitdaten als Bind-Mounts im Projektordner
# (backend/data + backend/feedingPlan) - ein Backup des Projektordners genügt.
BACKUP_NAME="catboter-backup-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/home/iotueli/Desktop/$BACKUP_NAME"

echo "Creating backup: $BACKUP_NAME"

mkdir -p "$BACKUP_DIR"

# Projekt inkl. Daten (Kalibrierungen, Verbrauchshistorie, Pläne, Configs)
echo "Copying project files..."
cp -r /home/iotueli/Desktop/catBoterV3 "$BACKUP_DIR/"

# node_modules und Build-Artefakte aussparen (gross, reproduzierbar)
rm -rf "$BACKUP_DIR/catBoterV3/frontend-new/node_modules" \
       "$BACKUP_DIR/catBoterV3/frontend-new/dist" 2>/dev/null

# Create archive
echo "Creating archive..."
cd /home/iotueli/Desktop
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"

# Cleanup
rm -rf "$BACKUP_DIR"

echo "Backup created: /home/iotueli/Desktop/${BACKUP_NAME}.tar.gz"
echo ""
echo "To download on your computer, run:"
echo "scp iotueli@catboter:/home/iotueli/Desktop/${BACKUP_NAME}.tar.gz ~/Downloads/"
