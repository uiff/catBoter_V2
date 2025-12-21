# 🚀 Schnellstart: Projekt vom Raspberry Pi kopieren

Diese Kurzanleitung zeigt die schnellsten Wege, das Projekt zu kopieren.

---

## 📋 Was Sie brauchen

- Die **IP-Adresse** Ihres Raspberry Pi (z.B. `192.168.1.100`)
- **SSH-Zugang** zum Raspberry Pi
- **5-10 Minuten** Zeit

---

## 🎯 Schritt-für-Schritt (3 einfache Schritte)

### **Schritt 1: Script ausführen**

**Linux/Mac:**
```bash
# 1. Laden Sie das Script vom Pi herunter
scp pi@<RASPBERRY_PI_IP>:/home/iotueli/Desktop/catBoterV3/copy_from_pi.sh ~/Downloads/

# 2. Ausführbar machen
chmod +x ~/Downloads/copy_from_pi.sh

# 3. Script starten
~/Downloads/copy_from_pi.sh
```

**Windows (PowerShell):**
```powershell
# 1. Laden Sie das Script vom Pi herunter
scp pi@<RASPBERRY_PI_IP>:/home/iotueli/Desktop/catBoterV3/copy_from_pi.ps1 $env:USERPROFILE\Downloads\

# 2. Script starten
powershell -ExecutionPolicy Bypass -File $env:USERPROFILE\Downloads\copy_from_pi.ps1
```

### **Schritt 2: Script folgen**

Das Script fragt Sie:
1. **IP-Adresse** des Raspberry Pi
2. **Zielverzeichnis** (Standard: Desktop)
3. **Bestätigung** zum Starten

### **Schritt 3: Nach dem Kopieren**

```bash
# Ins Projektverzeichnis wechseln
cd ~/Desktop/catBoterV3

# Detaillierte Anleitung lesen
cat MIGRATION_GUIDE.md
```

---

## ⚡ Alternative: Manuelle Kopie (ohne Script)

### Einzeiler für Linux/Mac:
```bash
rsync -avz --progress pi@<RASPBERRY_PI_IP>:/home/iotueli/Desktop/catBoterV3/ ~/Desktop/catBoterV3/
```

### Einzeiler für Windows (PowerShell):
```powershell
scp -r pi@<RASPBERRY_PI_IP>:/home/iotueli/Desktop/catBoterV3 $env:USERPROFILE\Desktop\
```

### Mit GUI (WinSCP für Windows):
1. **Download:** https://winscp.net/
2. **Verbinden:** Host: `<RASPBERRY_PI_IP>`, User: `pi`
3. **Kopieren:** `/home/iotueli/Desktop/catBoterV3` → `C:\Users\<IhrName>\Desktop\`

---

## 🔧 Nach dem Kopieren: Setup

### 1. Backend einrichten
```bash
cd ~/Desktop/catBoterV3

# Virtual Environment erstellen
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# oder: .\venv\Scripts\Activate.ps1  # Windows

# Dependencies installieren
pip install flask flask-cors psutil python-dotenv
```

### 2. Frontend builden
```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Starten
```bash
python3 start.py
```

Öffnen Sie: `http://localhost:5000`

---

## 📚 Weiterführende Dokumentation

- **Detaillierte Anleitung:** `MIGRATION_GUIDE.md`
- **Autostart-Setup:** Im `MIGRATION_GUIDE.md` (Teil 3)
- **Troubleshooting:** Im `MIGRATION_GUIDE.md` (Abschnitt "Troubleshooting")

---

## 💡 Tipps

✅ **Empfohlen:** Script verwenden (einfacher & mit Fehlerprüfung)  
✅ **Schnell:** rsync/scp Einzeiler (für erfahrene Nutzer)  
✅ **Windows:** WinSCP GUI (am einfachsten für Windows)

⚠️ **Wichtig:** Auf dem PC funktionieren keine GPIO/Sensoren/Motor!  
✅ **Aber:** Web-Interface funktioniert vollständig für Entwicklung

---

## ❓ Häufige Fragen

**Q: Kann ich das Projekt auf dem PC entwickeln?**  
A: Ja! Entwickeln Sie auf dem PC und deployen Sie dann auf den Pi.

**Q: Funktioniert der Motor/Sensoren auf dem PC?**  
A: Nein, nur auf dem Raspberry Pi mit GPIO.

**Q: Wie deploye ich Änderungen zurück zum Pi?**  
A: Mit rsync in die andere Richtung:
```bash
rsync -avz ~/Desktop/catBoterV3/ pi@<RASPBERRY_PI_IP>:/home/iotueli/Desktop/catBoterV3/
```

**Q: Muss ich das Frontend jedes Mal neu builden?**  
A: Nur nach Änderungen am Frontend-Code. Backend-Änderungen nicht.

---

Viel Erfolg! 🎉
