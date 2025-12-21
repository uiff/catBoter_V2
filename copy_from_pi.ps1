# CatBot - Projekt vom Raspberry Pi kopieren (Windows PowerShell)
# Dieses Script hilft beim Kopieren des Projekts vom Pi auf Ihren Computer

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CatBot - Projekt vom Pi kopieren" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Raspberry Pi IP abfragen
Write-Host "Schritt 1: Raspberry Pi IP-Adresse" -ForegroundColor Yellow
$PI_IP = Read-Host "Geben Sie die IP-Adresse Ihres Raspberry Pi ein (z.B. 192.168.1.100)"

if ([string]::IsNullOrWhiteSpace($PI_IP)) {
    Write-Host "Fehler: IP-Adresse darf nicht leer sein!" -ForegroundColor Red
    exit 1
}

# Zielverzeichnis abfragen
Write-Host ""
Write-Host "Schritt 2: Zielverzeichnis" -ForegroundColor Yellow
Write-Host "Standardmäßig wird das Projekt nach $env:USERPROFILE\Desktop\catBoterV3 kopiert"
$TARGET_DIR = Read-Host "Anderes Verzeichnis? (Enter für Standard)"

if ([string]::IsNullOrWhiteSpace($TARGET_DIR)) {
    $TARGET_DIR = "$env:USERPROFILE\Desktop\catBoterV3"
}

Write-Host ""
Write-Host "Zusammenfassung:" -ForegroundColor Green
Write-Host "  Quelle:      pi@$($PI_IP):/home/iotueli/Desktop/catBoterV3/"
Write-Host "  Ziel:        $TARGET_DIR"
Write-Host ""

$confirm = Read-Host "Fortfahren? (j/n)"
if ($confirm -notmatch "^[jJyY]$") {
    Write-Host "Abgebrochen."
    exit 0
}

Write-Host ""
Write-Host "Schritt 3: Projekt kopieren..." -ForegroundColor Yellow

# Prüfe ob scp verfügbar ist (ab Windows 10 1809)
$scpAvailable = Get-Command scp -ErrorAction SilentlyContinue

if ($scpAvailable) {
    Write-Host "Verwende scp..."
    
    # Erstelle Zielverzeichnis falls nicht vorhanden
    if (!(Test-Path -Path $TARGET_DIR)) {
        New-Item -ItemType Directory -Path $TARGET_DIR -Force | Out-Null
    }
    
    # Kopiere mit scp
    scp -r "pi@$($PI_IP):/home/iotueli/Desktop/catBoterV3" "$TARGET_DIR"
    $COPY_STATUS = $LASTEXITCODE
} else {
    Write-Host "FEHLER: scp nicht gefunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Mögliche Lösungen:" -ForegroundColor Yellow
    Write-Host "1. Installieren Sie OpenSSH Client:"
    Write-Host "   Einstellungen > Apps > Optionale Features > OpenSSH-Client"
    Write-Host ""
    Write-Host "2. Verwenden Sie WinSCP (GUI):"
    Write-Host "   https://winscp.net/"
    Write-Host ""
    Write-Host "3. Manuell mit PowerShell (erfordert SSH):"
    Write-Host "   scp -r pi@$($PI_IP):/home/iotueli/Desktop/catBoterV3 $TARGET_DIR"
    exit 1
}

if ($COPY_STATUS -eq 0) {
    Write-Host ""
    Write-Host "✓ Projekt erfolgreich kopiert!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Nächste Schritte:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Wechseln Sie ins Verzeichnis:"
    Write-Host "   cd $TARGET_DIR"
    Write-Host ""
    Write-Host "2. Lesen Sie die Migrations-Anleitung:"
    Write-Host "   Get-Content MIGRATION_GUIDE.md"
    Write-Host ""
    Write-Host "3. Setup durchführen:"
    Write-Host "   - Python Virtual Environment erstellen"
    Write-Host "   - Backend-Dependencies installieren"
    Write-Host "   - Frontend builden"
    Write-Host ""
    Write-Host "Detaillierte Anleitung in: $TARGET_DIR\MIGRATION_GUIDE.md"
} else {
    Write-Host ""
    Write-Host "✗ Fehler beim Kopieren!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Mögliche Ursachen:" -ForegroundColor Yellow
    Write-Host "  - Falsche IP-Adresse"
    Write-Host "  - SSH-Verbindung nicht möglich"
    Write-Host "  - Falsches Passwort"
    Write-Host "  - Raspberry Pi nicht erreichbar"
    Write-Host ""
    Write-Host "Alternative: WinSCP verwenden (GUI):" -ForegroundColor Yellow
    Write-Host "  https://winscp.net/"
}
