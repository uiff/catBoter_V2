# 📚 CatBoter V3 - Vollständige Dokumentation

> **Komplette technische und Benutzer-Dokumentation**

---

## 📋 Inhaltsverzeichnis

1. [System-Übersicht](#system-übersicht)
2. [Netzwerk & Zugriff](#netzwerk--zugriff)
3. [Alle Funktionen im Detail](#alle-funktionen-im-detail)
4. [WiFi Fallback / AP Mode](#wifi-fallback--ap-mode)
5. [Hardware-Konfiguration](#hardware-konfiguration)
6. [Software-Architektur](#software-architektur)
7. [API-Dokumentation](#api-dokumentation)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 System-Übersicht

### Was ist CatBoter V3?

Ein **vollautomatisches Fütterungssystem** für Haustiere mit:
- 🤖 **Automatische Fütterung** nach Zeitplan
- 📊 **Echtzeit-Monitoring** von Füllstand und Verbrauch
- 📱 **Web-Interface** für alle Geräte (Desktop, Tablet, Smartphone)
- 🌐 **WiFi Fallback** - System ist niemals offline
- ⚖️ **Präzise Gewichtskontrolle** via HX711 Wiegesensor
- 📏 **Füllstand-Überwachung** via VL53L0X Distanzsensor
- 🔄 **Netzwerk-Verwaltung** direkt aus der App

---

## 🌐 Netzwerk & Zugriff

### Zugriffsmöglichkeiten

#### 1. **Normal-Betrieb (Mit WLAN)**
```
📱 Zugriff über:
• http://catboter.local         ← Empfohlen (mDNS)
• http://[AKTUELLE-IP]          ← Fallback
• http://192.168.0.18           ← Beispiel IP
```

**Vorteile:**
- ✅ Funktioniert auch bei IP-Wechsel (catboter.local)
- ✅ Kein Merken von IP-Adressen nötig
- ✅ Automatische Erkennung im lokalen Netzwerk

**mDNS Setup** (einmalig):
```bash
./setup-hostname.sh
```

#### 2. **AP Mode (Ohne WLAN / WiFi Fallback)**
```
📱 Zugriff über:
• SSID: CatBoter-Setup
• Passwort: [DEIN-SICHERES-PASSWORT]
• IP: http://10.0.0.1
```

**Automatische Aktivierung:**
- ⚡ System erkennt WLAN-Ausfall nach 90 Sekunden
- 📡 Startet eigenen Access Point
- 🌐 Captive Portal leitet automatisch zur WebApp

---

## 🔧 Alle Funktionen im Detail

### 1. 🍽️ Fütterungs-Management

#### A) Automatische Fütterungspläne

**Auto-Plan (Feste Zeiten)**
```yaml
Funktion: Feste Fütterungszeiten mit exakten Mengen
Beispiel:
  - Montag 08:00  → 30g
  - Montag 18:00  → 30g
  - Dienstag 08:00 → 30g
  ...

Einstellungen:
  • Tagesgewicht (10-500g)
  • Anzahl Fütterungen pro Tag (1-10)
  • Feste Uhrzeiten
  • Sound aktivieren (optional)
  • Wochentage individuell
```

**Random-Plan (Zufällige Zeiten)**
```yaml
Funktion: Zufällige Fütterungszeiten im Zeitfenster
Beispiel:
  • Zeitfenster: 06:00 - 22:00
  • 3 Fütterungen → z.B. 07:23, 12:45, 19:12
  • Mindestabstand: 1 Stunde

Einstellungen:
  • Tagesgewicht wird automatisch aufgeteilt
  • Zufällige Zeiten täglich neu
  • Verhindert Gewöhnung
```

**Manuelle Fütterung**
```yaml
Funktion: Sofortige Fütterung on-demand
  • Button-Klick → 30g (konfigurierbar)
  • Wird in Statistik erfasst
  • Gewichtsmessung vor/nach
```

#### B) Gewichtskontrolle

**Präzise Messung:**
- Sensor: HX711 Load Cell
- Auflösung: 0.1g
- Bereich: 0-5000g
- Kalibrierung: App oder manuell

**Automatische Erfassung:**
```
Vor Fütterung  → Gewicht messen
   ↓
Füttern        → Motor aktivieren
   ↓
Nach Fütterung → Gewicht messen
   ↓
Differenz      → Tatsächlich gefütterte Menge
```

**Smart-Filter:**
- ✅ Nur Fütterungen ≥1g werden gespeichert
- ✅ Verhindert Fehlmessungen (0g)
- ✅ Standardwert bei Sensor-Ausfall

---

### 2. 📊 Monitoring & Statistiken

#### Dashboard
```yaml
Füllstand:
  • Echtzeit-Anzeige in cm und %
  • Farbcodierung: Grün → Gelb → Rot
  • Warnung bei <10%

Tagesverbrauch:
  • Gesamt gefütterte Menge
  • Anzahl Fütterungen
  • Durchschnitt pro Fütterung

Motor-Status:
  • Läuft / Gestoppt
  • Letzte Aktivität

Verbindung:
  • Online / Offline
  • Automatische Reconnection
```

#### Monitoring-Seite
```yaml
Verlauf (7/30 Tage):
  • Linien-Diagramm: Täglicher Verbrauch
  • Balken-Diagramm: Fütterungen pro Tag
  • Statistiken: Min, Max, Durchschnitt

Wochen-Übersicht:
  • Aggregierte Daten
  • Trends erkennen

Monats-Übersicht:
  • Langzeit-Analyse
  • Verbrauchs-Muster
```

---

### 3. 🌐 WiFi Fallback System (AP Mode)

#### Automatische Aktivierung

**Ablauf:**
```
1. WLAN-Verbindung verloren
   ↓
2. System prüft alle 30 Sekunden
   ↓
3. Nach 3 Fehlschlägen (90 Sek) → AP aktivieren
   ↓
4. Access Point startet
   ↓
5. DNS-Redirect (Captive Portal)
   ↓
6. Alle HTTP-Anfragen → 10.0.0.1
```

#### Zugriffs-Daten

**Standard-Konfiguration:**
```yaml
SSID: CatBoter-Setup
Passwort: [Individuell setzen]
IP-Adresse: 10.0.0.1
Kanal: 6
DHCP-Range: 10.0.0.10 - 10.0.0.50

WebApp-Zugriff:
  • http://10.0.0.1
  • Automatischer Redirect
```

**⚠️ WICHTIG - Sicherheit:**
```bash
# Standard-Passwort ÄNDERN!
# In WebApp: Einstellungen → WiFi Fallback

Empfohlen:
• Mindestens 16 Zeichen
• Mix aus Groß-/Kleinbuchstaben + Zahlen
• Beispiel: ojoO9TkbVBSmupSCY3KFP751
```

#### Konfiguration

**In der WebApp:**
```
Einstellungen → WiFi Fallback

Optionen:
  [x] Aktiviert
  SSID: CatBoter-Setup
  Passwort: ****************
  Kanal: 6
  Check-Intervall: 30s

  [Speichern] [Jetzt Aktivieren] [Deaktivieren]
```

**Manuell (JSON):**
```bash
nano backend/data/wifi_fallback_config.json
```
```json
{
  "enabled": true,
  "ssid": "CatBoter-Setup",
  "password": "DEIN-SICHERES-PASSWORT",
  "channel": 6,
  "ip_address": "10.0.0.1",
  "dhcp_range_start": "10.0.0.10",
  "dhcp_range_end": "10.0.0.50",
  "check_interval": 30
}
```

#### Automatische Deaktivierung

**Wenn WLAN wieder da:**
```
1. System erkennt WLAN-Verbindung
   ↓
2. Access Point wird deaktiviert
   ↓
3. Zurück zum Normal-Betrieb
   ↓
4. Weiterhin über reguläre IP erreichbar
```

---

### 4. ⚙️ Einstellungen & Verwaltung

#### Netzwerk-Konfiguration

**WLAN-Verwaltung:**
```yaml
Funktion: WLAN-Netzwerke scannen und verbinden

Ablauf:
  1. Netzwerke scannen
  2. Netzwerk auswählen
  3. Passwort eingeben
  4. Verbinden
  5. Automatischer Neustart

Verfügbar:
  • Im Normal-Betrieb
  • Im AP-Mode (!)

Vorteil: Kein SSH/Terminal nötig
```

**LAN/Ethernet:**
```yaml
Status:
  • IP-Adresse
  • MAC-Adresse
  • Verbindungs-Status

Info:
  • Automatische Konfiguration (DHCP)
  • Keine manuelle Einrichtung nötig
```

#### Sensor-Kalibrierung

**Gewichtssensor (HX711):**
```yaml
Kalibrierung:
  1. Sensor entleeren
  2. "Tara" drücken → 0g
  3. Bekanntes Gewicht auflegen (z.B. 100g)
  4. Wert eingeben
  5. "Kalibrieren" drücken

Speicherort: backend/backend/data/calibration.json
```

**Distanzsensor (VL53L0X):**
```yaml
Kalibrierung:
  • Voll-Füllstand: Wenn Container voll
  • Leer-Füllstand: Wenn Container leer
  • Automatische %-Berechnung
```

---

## 🏗️ Software-Architektur

### Technologie-Stack

**Frontend:**
```
React 19 + TypeScript
├── Vite (Build Tool)
├── TailwindCSS (Styling)
├── Framer Motion (Animationen)
├── Recharts (Diagramme)
└── Sonner (Notifications)

Features:
• Code Splitting (11 Chunks)
• Lazy Loading
• PWA-ready
• Responsive Design
```

**Backend:**
```
Python 3.11 + Flask
├── Flask-CORS
├── Flask-RESTful
├── RPi.GPIO (Hardware)
├── Adafruit Libraries (Sensoren)
└── psutil, netifaces (System)

Features:
• REST API (51 Endpoints)
• Smart Caching
• Hardware-Abstraktion
• WiFi Fallback Manager
```

**Infrastructure:**
```
Docker + Docker Compose
├── nginx (Reverse Proxy)
├── Backend Container
└── Frontend Container

Features:
• Multi-Stage Builds
• Health Checks
• Auto-Restart
• Volume Mounting
```

### Kommunikation

**Frontend ↔ Backend:**
```
Development:
  Frontend:3000 → Backend:5000 (direkt)

Production (Docker):
  Browser → nginx:80
    ├── /      → Frontend (Static Files)
    └── /api/* → Backend:5000 (Proxy)

Vorteil:
  • Keine IP-Hardcoding
  • Funktioniert bei IP-Wechsel
  • CORS-frei
```

**Reverse Proxy (nginx):**
```nginx
# Alle API-Anfragen an Backend
location /api/ {
    proxy_pass http://backend:5000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Frontend Static Files
location / {
    root /usr/share/nginx/html;
    try_files $uri /index.html;
}
```

**Polling-Mechanismus:**
```typescript
// Frontend fragt Backend alle 500ms
setInterval(() => {
  fetch('/api/dashboard')
    .then(res => res.json())
    .then(data => updateUI(data))
}, 500)

Features:
• Sofortige Motor-Status Updates
• Echtzeit Gewicht/Distanz
• Automatische Reconnection
• Fehler-Toleranz (3 Versuche)
```

---

## 🔌 API-Dokumentation

### Haupt-Endpoints

#### Dashboard
```http
GET /dashboard
```
```json
Response:
{
  "weight": 450.5,
  "distance": 12.3,
  "motor_status": 0,
  "total_consumed_today": 75.5,
  "timestamp": 1704915234
}
```

#### Manuelle Fütterung
```http
POST /motor/feed
Content-Type: application/json

{
  "amount": 30.0,
  "timeout": 120
}
```

#### Fütterungspläne
```http
GET /feeding_plan/plans         # Alle Pläne
GET /feeding_plan/active        # Aktiver Plan
POST /feeding_plan/create       # Plan erstellen
POST /feeding_plan/activate/{name}
DELETE /feeding_plan/delete/{name}
```

#### WiFi Fallback
```http
GET /system/wifi_fallback/status
POST /system/wifi_fallback/enable
POST /system/wifi_fallback/disable
PUT /system/wifi_fallback/config
```

#### Netzwerk
```http
GET /network/wifi/scan          # WLAN scannen
POST /network/wifi/connect      # Verbinden
GET /network/status             # Status
```

**Vollständige API:** Swagger UI unter `/swagger`

---

## 🔧 Hardware-Konfiguration

### Erforderliche Hardware

**Raspberry Pi:**
- Model: 3B+ / 4 / Zero 2 W (empfohlen: 4)
- OS: Raspberry Pi OS (Bookworm)
- I2C aktiviert
- GPIO aktiviert

**Sensoren:**
```
HX711 Load Cell (Gewicht):
├── VCC  → 5V
├── GND  → GND
├── DT   → GPIO 5
└── SCK  → GPIO 6

VL53L0X (Distanz):
├── VCC  → 3.3V
├── GND  → GND
├── SDA  → GPIO 2 (I2C SDA)
└── SCL  → GPIO 3 (I2C SCL)

Schrittmotor (via Driver):
├── Step → GPIO 17
├── Dir  → GPIO 27
└── Enable → GPIO 22
```

**Optional:**
- Lautsprecher (GPIO 18)
- LED-Anzeige

### I2C Aktivierung

```bash
# Automatisch:
./install.sh

# Manuell:
sudo raspi-config
→ Interface Options
→ I2C
→ Enable

# Prüfen:
i2cdetect -y 1
```

---

## 🐛 Troubleshooting

### Problem: Frontend erreicht Backend nicht

**Symptom:** Offline-Anzeige, keine Daten

**Lösung:**
```bash
# 1. Prüfe Backend läuft
curl http://localhost:5000/

# 2. Prüfe nginx (im Docker)
docker logs catboter_nginx

# 3. Prüfe Network
docker network ls
docker network inspect catboter_network

# 4. Rebuild
docker-compose down
docker-compose up --build
```

### Problem: IP-Adresse ändert sich

**Symptom:** catboter.local funktioniert nicht

**Lösung:**
```bash
# 1. Hostname Setup
./setup-hostname.sh

# 2. Falls nicht funktioniert:
# Windows: Installiere Bonjour/iTunes
# Linux: Installiere avahi-daemon
# Mac: Funktioniert nativ

# 3. Statische IP setzen
sudo nmtui
→ Edit connection
→ IPv4: Manual
→ IP: 192.168.0.100
```

### Problem: WiFi Fallback aktiviert nicht

**Symptom:** Kein AP nach WLAN-Ausfall

**Lösung:**
```bash
# 1. Prüfe Config
cat backend/data/wifi_fallback_config.json

# 2. Manuell aktivieren
curl -X POST http://localhost:5000/system/wifi_fallback/enable

# 3. Prüfe Dienste
sudo systemctl status hostapd
sudo systemctl status dnsmasq

# 4. Logs
tail -f /tmp/catboter_backend.log
```

### Problem: Sensor liefert keine Werte

**HX711 (Gewicht):**
```bash
# Test
python3 -c "from backend.backend.hardware import get_weight_sensor; print(get_weight_sensor().get_weight())"

# Kalibrierung zurücksetzen
rm backend/backend/data/calibration.json
```

**VL53L0X (Distanz):**
```bash
# I2C prüfen
i2cdetect -y 1  # Sollte Adresse 0x29 zeigen

# Test
python3 -c "from backend.backend.hardware import get_distance_sensor; print(get_distance_sensor().get_distance())"
```

---

## 📞 Support

**Dokumentation:**
- README.md - Übersicht
- INSTALL.md - Installation
- SECURITY.md - Sicherheit
- WIFI_FALLBACK.md - WiFi Fallback
- CONTRIBUTING.md - Beiträge

**Bei Problemen:**
1. Logs prüfen: `tail -f /tmp/catboter_backend.log`
2. GitHub Issues: [Repository]/issues
3. Diskussionen: [Repository]/discussions

---

**Version:** 3.0
**Letzte Aktualisierung:** Januar 2026
**Status:** Produktionsreif ✅
