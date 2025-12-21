# CatBot Migration Guide
## Projekt vom Raspberry Pi auf einen anderen Computer kopieren

Diese Anleitung zeigt Ihnen, wie Sie das gesamte CatBot-Projekt vom Raspberry Pi auf Ihren Computer (Windows, Mac oder Linux) kopieren und einrichten.

---

## 📋 Voraussetzungen

- **Auf Ihrem Computer:**
  - Python 3.8 oder höher
  - Node.js 16 oder höher
  - npm (kommt mit Node.js)
  - Git (optional)
  - SSH-Client (für Windows: PowerShell oder PuTTY)

---

## 📦 Teil 1: Projekt vom Raspberry Pi kopieren

### Option A: Mit rsync (empfohlen für Linux/Mac)

```bash
# Vom Terminal auf Ihrem Computer:
rsync -avz --progress pi@<RASPBERRY_PI_IP>:/home/iotueli/Desktop/catBoterV3/ ~/Desktop/catBoterV3/
```

**Beispiel:**
```bash
rsync -avz --progress pi@192.168.1.100:/home/iotueli/Desktop/catBoterV3/ ~/Desktop/catBoterV3/
```

### Option B: Mit scp (für alle Betriebssysteme)

```bash
# Vom Terminal/PowerShell auf Ihrem Computer:
scp -r pi@<RASPBERRY_PI_IP>:/home/iotueli/Desktop/catBoterV3 ~/Desktop/
```

**Beispiel:**
```bash
scp -r pi@192.168.1.100:/home/iotueli/Desktop/catBoterV3 ~/Desktop/
```

### Option C: Mit WinSCP (Windows GUI)

1. **WinSCP herunterladen:** https://winscp.net/
2. **Verbindung einrichten:**
   - Host: `<RASPBERRY_PI_IP>`
   - Port: `22`
   - Benutzer: `pi`
   - Passwort: `<Ihr Pi-Passwort>`
3. **Ordner kopieren:**
   - Navigiere zu `/home/iotueli/Desktop/catBoterV3`
   - Rechtsklick → Download
   - Ziel: `C:\Users\<IhrName>\Desktop\catBoterV3`

---

## 🔧 Teil 2: Projekt-Setup auf Ihrem Computer

### Schritt 1: Verzeichnis wechseln

```bash
cd ~/Desktop/catBoterV3
# oder auf Windows:
cd C:\Users\<IhrName>\Desktop\catBoterV3
```

### Schritt 2: Backend-Setup

#### 2.1 Python Virtual Environment erstellen

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
python -m venv venv
venv\Scripts\activate.bat
```

#### 2.2 Python-Abhängigkeiten installieren

```bash
pip install -r backend/requirements.txt
```

**Häufige Probleme:**
- **GPIO-Fehler:** Auf nicht-Raspberry-Pi-Systemen müssen GPIO-Bibliotheken entfernt werden:
  ```bash
  pip install -r backend/requirements.txt --no-deps
  pip install flask flask-cors influxdb python-dotenv psutil
  ```

#### 2.3 Konfiguration anpassen

Bearbeiten Sie `config/config.json`:
```json
{
  "influxdb": {
    "enabled": false
  },
  "gpio": {
    "enabled": false
  }
}
```

### Schritt 3: Frontend-Setup

#### 3.1 Dependencies installieren

```bash
cd frontend
npm install
```

#### 3.2 Umgebungsvariablen anpassen

Bearbeiten Sie `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000
```

#### 3.3 Frontend builden

```bash
npm run build
```

Zurück zum Hauptverzeichnis:
```bash
cd ..
```

---

## 🚀 Teil 3: Projekt starten

### Backend starten

```bash
# Virtual Environment aktivieren (falls nicht aktiv)
source venv/bin/activate  # Linux/Mac
# oder
.\venv\Scripts\Activate.ps1  # Windows

# Backend starten
python3 start.py
```

Das Backend läuft nun auf: `http://localhost:5000`

### Frontend öffnen

Öffnen Sie im Browser:
```
http://localhost:5000
```

Das Frontend wird automatisch vom Backend ausgeliefert (aus `frontend/build`).

---

## 🔄 Autostart einrichten (Optional)

### Für Linux (systemd)

#### 1. Service-Datei erstellen

```bash
sudo nano /etc/systemd/system/catbot.service
```

Inhalt:
```ini
[Unit]
Description=CatBot Feeding System
After=network.target

[Service]
Type=simple
User=<IhrUsername>
WorkingDirectory=/home/<IhrUsername>/Desktop/catBoterV3
ExecStart=/home/<IhrUsername>/Desktop/catBoterV3/venv/bin/python /home/<IhrUsername>/Desktop/catBoterV3/start.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 2. Service aktivieren

```bash
sudo systemctl daemon-reload
sudo systemctl enable catbot.service
sudo systemctl start catbot.service
```

#### 3. Status prüfen

```bash
sudo systemctl status catbot.service
```

### Für Windows (Task Scheduler)

#### 1. Batch-Datei erstellen

Erstellen Sie `start_catbot.bat`:
```batch
@echo off
cd C:\Users\<IhrName>\Desktop\catBoterV3
call venv\Scripts\activate.bat
python start.py
```

#### 2. Aufgabe erstellen

1. **Task Scheduler öffnen** (Win+R → `taskschd.msc`)
2. **Neue Aufgabe erstellen:**
   - Name: `CatBot Autostart`
   - Trigger: Bei Anmeldung
   - Aktion: `start_catbot.bat` ausführen
   - Bedingungen: Alle Netzwerk-Bedingungen entfernen

### Für macOS (launchd)

#### 1. plist-Datei erstellen

```bash
nano ~/Library/LaunchAgents/com.catbot.app.plist
```

Inhalt:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.catbot.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/<IhrUsername>/Desktop/catBoterV3/venv/bin/python</string>
        <string>/Users/<IhrUsername>/Desktop/catBoterV3/start.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/<IhrUsername>/Desktop/catBoterV3</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

#### 2. Service aktivieren

```bash
launchctl load ~/Library/LaunchAgents/com.catbot.app.plist
launchctl start com.catbot.app
```

---

## 🛠️ Nützliche Befehle

### Backend-Verwaltung

```bash
# Backend starten
python3 start.py

# Backend stoppen
python3 stop.py

# Status prüfen
python3 check_autostart_status.py
```

### Frontend neu builden

```bash
cd frontend
npm run build
cd ..
```

### Logs anzeigen

**Linux/Mac:**
```bash
tail -f backend/logs/catbot.log
```

**Windows:**
```powershell
Get-Content backend/logs/catbot.log -Wait
```

---

## 🐛 Troubleshooting

### Problem: GPIO-Fehler beim Starten

**Lösung:** GPIO ist nur auf Raspberry Pi verfügbar. Deaktivieren Sie es in `config/config.json`:
```json
{
  "gpio": {
    "enabled": false
  }
}
```

### Problem: Port 5000 bereits belegt

**Lösung:** Ändern Sie den Port in `backend/main.py`:
```python
app.run(host='0.0.0.0', port=5001, debug=False)
```

### Problem: Frontend zeigt "Cannot connect to backend"

**Lösungen:**
1. Prüfen Sie ob Backend läuft: `http://localhost:5000/api/health`
2. Prüfen Sie `frontend/.env`:
   ```env
   REACT_APP_API_URL=http://localhost:5000
   ```
3. Frontend neu builden:
   ```bash
   cd frontend && npm run build && cd ..
   ```

### Problem: npm install schlägt fehl

**Lösung:** Node.js aktualisieren:
```bash
# Prüfen Sie Ihre Version
node --version  # Sollte >= 16 sein
npm --version   # Sollte >= 8 sein
```

---

## 📊 Unterschiede Raspberry Pi vs. PC

| Feature | Raspberry Pi | PC |
|---------|--------------|-----|
| GPIO-Hardware | ✅ Verfügbar | ❌ Nicht verfügbar |
| Motor-Steuerung | ✅ Funktional | ❌ Nur Simulation |
| Sensoren | ✅ Funktional | ❌ Nur Simulation |
| InfluxDB | ✅ Optional | ✅ Optional |
| Web-Interface | ✅ Verfügbar | ✅ Verfügbar |
| Monitoring | ✅ Voll | ⚠️ Teilweise* |

*Auf dem PC funktioniert nur das Web-Interface, nicht die physischen Sensoren/Aktoren.

---

## 🎯 Nächste Schritte

1. **Backup erstellen** des Raspberry Pi-Projekts
2. **Projekt kopieren** mit einer der oben genannten Methoden
3. **Dependencies installieren** (Python & Node.js)
4. **Konfiguration anpassen** (GPIO deaktivieren)
5. **Frontend builden**
6. **Backend starten** und testen
7. **Optional:** Autostart einrichten

---

## 📞 Support

Bei Problemen:
1. Logs überprüfen: `backend/logs/`
2. Konfiguration überprüfen: `config/config.json`
3. Dokumentation lesen: `README.md`

---

## 📝 Wichtige Hinweise

- **Auf dem PC:** Hardware-Features (Motor, Sensoren) funktionieren nicht
- **Web-Interface:** Funktioniert vollständig
- **Konfiguration:** Muss angepasst werden (GPIO/InfluxDB deaktivieren)
- **Entwicklung:** Auf dem PC entwickeln, auf Pi deployen

---

Viel Erfolg! 🚀
