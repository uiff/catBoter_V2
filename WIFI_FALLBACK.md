# 📡 WiFi Fallback System - Access Point Modus

## 🎯 Problem & Lösung

### Problem-Szenarien:
- ❌ WiFi-Passwort wurde geändert → CatBoter nicht mehr erreichbar
- ❌ Router neu gestartet → neue IP-Adresse
- ❌ Umzug in neues Netzwerk → System offline
- ❌ Kein Internet verfügbar → Keine Zugriffsmöglichkeit

### Lösung: Automatischer Fallback Access Point

Das WiFi Fallback System überwacht kontinuierlich die WiFi-Verbindung und aktiviert **automatisch einen Access Point (Hotspot)**, wenn keine Verbindung mehr besteht.

---

## 🔧 Funktionsweise

### Automatischer Modus

```
1. System überwacht WiFi alle 30 Sekunden
2. Keine Verbindung? → Zähler erhöhen
3. Nach 3 Fehlversuchen (90 Sekunden):
   → Access Point wird aktiviert
4. User verbindet sich mit "CatBoter-Setup"
5. WebApp ist unter 10.0.0.1 erreichbar
6. Neue WiFi-Daten konfigurieren
7. System stellt Verbindung her
8. Access Point wird automatisch deaktiviert
```

### Technische Details

**Access Point Konfiguration:**
- **SSID:** `CatBoter-Setup` (änderbar)
- **Passwort:** `catboter123` (änderbar)
- **IP-Adresse:** `10.0.0.1`
- **DHCP-Bereich:** `10.0.0.10 - 10.0.0.50`
- **Kanal:** 6 (2.4 GHz)

**Komponenten:**
- `hostapd` - Access Point Daemon
- `dnsmasq` - DHCP + DNS Server
- `wlan0` - WiFi Interface

---

## 📱 Verwendung

### Szenario 1: WiFi-Verbindung verloren

1. ⏰ **Warten Sie 90 Sekunden**
   - System erkennt automatisch verlorene Verbindung
   - Nach 3 Fehlversuchen wird AP aktiviert

2. 📱 **Verbinden mit Access Point**
   - Öffnen Sie WiFi-Einstellungen auf Smartphone/Laptop
   - Suchen Sie "CatBoter-Setup"
   - Passwort: `catboter123`

3. 🌐 **WebApp öffnen**
   - Browser öffnen: `http://10.0.0.1:5173`
   - Oder automatisch umgeleitet (Captive Portal)

4. ⚙️ **WiFi neu konfigurieren**
   - Einstellungen → WiFi-Verbindung
   - Neues Netzwerk auswählen
   - Passwort eingeben
   - Speichern

5. ✅ **Automatische Wiederherstellung**
   - System verbindet sich mit neuem WiFi
   - Access Point wird automatisch deaktiviert

### Szenario 2: Manueller Access Point

Sie können den Access Point auch **manuell aktivieren**:

1. 🌐 **WebApp öffnen** (wenn noch erreichbar)
2. ⚙️ **Einstellungen → WiFi Fallback**
3. 🔘 **"AP Manuell Aktivieren"** klicken
4. 📡 Access Point startet sofort

**Verwendung:**
- Direktzugriff ohne Router
- Vor-Ort-Wartung
- Demonstration ohne Internet

---

## 🖥️ Konfiguration

### In der WebApp

**Einstellungen → WiFi Fallback**

**Verfügbare Optionen:**
- ✅ **Ein/Aus-Schalter** - Automatisches Fallback aktivieren
- 📝 **SSID** - Name des Access Points
- 🔒 **Passwort** - Zugangspasswort (min. 8 Zeichen)
- 📻 **WiFi-Kanal** - 1-11 (Standard: 6)
- ⏱️ **Prüf-Intervall** - Wie oft WiFi geprüft wird (Standard: 30s)

### Via Konfigurationsdatei

```bash
# Datei: backend/data/wifi_fallback_config.json
{
  "enabled": true,
  "ssid": "CatBoter-Setup",
  "password": "catboter123",
  "ip_address": "10.0.0.1",
  "netmask": "255.255.255.0",
  "dhcp_range_start": "10.0.0.10",
  "dhcp_range_end": "10.0.0.50",
  "channel": 6,
  "check_interval": 30
}
```

### Via API

```bash
# Status abfragen
curl http://localhost:5000/system/wifi_fallback/status

# Konfiguration abrufen
curl http://localhost:5000/system/wifi_fallback/config

# Konfiguration ändern
curl -X POST http://localhost:5000/system/wifi_fallback/config \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "ssid": "MeinCatBoter"}'

# Access Point manuell aktivieren
curl -X POST http://localhost:5000/system/wifi_fallback/enable_ap

# Access Point deaktivieren
curl -X POST http://localhost:5000/system/wifi_fallback/disable_ap
```

---

## 🚀 Installation

### Automatisch (empfohlen)

Das WiFi Fallback System wird automatisch installiert wenn Sie das `install.sh` Script verwenden.

### Manuelle Installation

**1. System-Pakete installieren:**

```bash
sudo apt-get update
sudo apt-get install -y hostapd dnsmasq iptables
```

**2. Services deaktivieren (werden dynamisch gestartet):**

```bash
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq
sudo systemctl disable hostapd
sudo systemctl disable dnsmasq
```

**3. Python-Modul ist bereits enthalten:**

```
backend/system/wifi_fallback.py
```

**4. Automatischer Start via systemd (optional):**

```bash
# Service-Datei kopieren
sudo cp backend/system/catboter-wifi-fallback.service /etc/systemd/system/

# Service aktivieren
sudo systemctl daemon-reload
sudo systemctl enable catboter-wifi-fallback.service
sudo systemctl start catboter-wifi-fallback.service

# Status prüfen
sudo systemctl status catboter-wifi-fallback.service
```

---

## 🔍 Monitoring & Logs

### Status prüfen

**In der WebApp:**
- Einstellungen → WiFi Fallback
- Zeigt aktuellen Status
- WiFi-Verbindung
- Access Point Status
- Fehlgeschlagene Versuche

**Via Terminal:**

```bash
# Service Status
sudo systemctl status catboter-wifi-fallback

# Logs anzeigen
sudo journalctl -u catboter-wifi-fallback -f

# Access Point läuft?
systemctl is-active hostapd

# DHCP Server läuft?
ps aux | grep dnsmasq

# Verbundene Clients
iw dev wlan0 station dump
```

### Log-Ausgaben

```
INFO - WiFi Fallback Monitoring gestartet
INFO - Check-Interval: 30s
INFO - Fallback AP SSID: CatBoter-Setup

WARNING - WiFi nicht verbunden (Versuch 1/3)
WARNING - WiFi nicht verbunden (Versuch 2/3)
WARNING - WiFi nicht verbunden (Versuch 3/3)
WARNING - WiFi-Verbindung dauerhaft verloren!

INFO - Aktiviere Access Point Modus...
INFO - Stoppe WiFi Client Modus...
INFO - Konfiguriere wlan0 mit IP 10.0.0.1...
INFO - Starte DHCP Server (dnsmasq)...
INFO - Starte Access Point (hostapd)...
INFO - Access Point aktiv: SSID='CatBoter-Setup' | IP=10.0.0.1
INFO - Verbinden Sie sich mit dem WiFi und öffnen Sie: http://10.0.0.1:5173

INFO - WiFi-Verbindung wiederhergestellt!
INFO - Deaktiviere Access Point Modus...
INFO - Access Point deaktiviert, WiFi Client Modus wiederhergestellt
```

---

## 🛠️ Troubleshooting

### Problem: Access Point startet nicht

**Prüfen:**

```bash
# hostapd verfügbar?
which hostapd

# dnsmasq verfügbar?
which dnsmasq

# wlan0 vorhanden?
ip link show wlan0

# Logs prüfen
sudo journalctl -u catboter-wifi-fallback -n 50
```

**Lösung:**

```bash
# Pakete installieren
sudo apt-get install -y hostapd dnsmasq

# Services stoppen (werden dynamisch gestartet)
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq
```

### Problem: Kann nicht mit Access Point verbinden

**Prüfen:**

```bash
# Access Point läuft?
ps aux | grep hostapd

# SSID wird gesendet?
sudo iw dev wlan0 scan | grep SSID

# IP-Adresse korrekt?
ip addr show wlan0
```

**Lösung:**

```bash
# Access Point neu starten
curl -X POST http://localhost:5000/system/wifi_fallback/disable_ap
sleep 5
curl -X POST http://localhost:5000/system/wifi_fallback/enable_ap
```

### Problem: Access Point aktiv aber keine IP

**Prüfen:**

```bash
# DHCP Server läuft?
ps aux | grep dnsmasq

# DHCP-Leases
cat /var/lib/misc/dnsmasq.leases
```

**Lösung:**

```bash
# dnsmasq neu starten
sudo pkill dnsmasq
sudo dnsmasq -C /tmp/catboter_dnsmasq.conf
```

### Problem: WiFi wird nicht wiederhergestellt

**Prüfen:**

```bash
# wpa_supplicant läuft?
systemctl status wpa_supplicant

# WiFi-Konfiguration vorhanden?
cat /etc/wpa_supplicant/wpa_supplicant.conf
```

**Lösung:**

```bash
# wpa_supplicant neu starten
sudo systemctl restart wpa_supplicant
sudo systemctl restart dhcpcd
```

---

## ⚙️ Erweiterte Konfiguration

### Captive Portal (Auto-Redirect)

Der Access Point ist so konfiguriert, dass **alle DNS-Anfragen** zur CatBoter-IP umgeleitet werden:

```
# In dnsmasq Config
address=/#/10.0.0.1
```

**Ergebnis:** Beim Verbinden mit dem Access Point öffnet sich automatisch die CatBoter WebApp (auf den meisten Geräten).

### Mehrere WiFi-Interfaces

Falls Sie **zwei WiFi-Adapter** haben:

```python
# In wifi_fallback.py anpassen:
# Verwende wlan1 für Access Point
interface=wlan1
```

**Vorteil:** Access Point läuft permanent, während wlan0 für WiFi-Client verwendet wird.

### Statische Route für Internet-Sharing

Falls Sie Internet vom Access Point teilen möchten:

```bash
# IP-Forwarding aktivieren
sudo sysctl -w net.ipv4.ip_forward=1

# NAT/Masquerading einrichten
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT
```

---

## 🔐 Sicherheitshinweise

### Produktions-Umgebung

1. **Starkes Passwort verwenden:**
   ```json
   {"password": "sicheres-passwort-min-16-zeichen"}
   ```

2. **SSID nicht verraten:**
   ```json
   {"ssid": "hidden-name-123"}
   ```

3. **Zugriff beschränken:**
   - Access Point nur aktivieren wenn nötig
   - `"enabled": false` setzen wenn nicht benötigt

4. **Firewall-Regeln:**
   ```bash
   # Nur lokaler Zugriff im AP-Modus
   sudo iptables -A INPUT -i wlan0 -p tcp --dport 5173 -j ACCEPT
   sudo iptables -A INPUT -i wlan0 -p tcp --dport 5000 -j ACCEPT
   ```

---

## 📊 Performance & Ressourcen

**CPU-Last:**
- Monitoring: < 1% CPU
- Access Point aktiv: 2-5% CPU
- DHCP/DNS: < 1% CPU

**RAM-Verwendung:**
- hostapd: ~5 MB
- dnsmasq: ~2 MB
- Monitoring-Script: ~10 MB

**Empfehlung:** Raspberry Pi 3B oder neuer

---

## 🎓 Technische Hintergründe

### Warum kein NetworkManager?

NetworkManager kann Access Point Modus, aber:
- ❌ Komplexe Konfiguration
- ❌ Overhead durch GUI-Tools
- ❌ Schwierig zu scripten

**Unsere Lösung:** Direkte Kontrolle über `hostapd` + `dnsmasq`
- ✅ Einfache Konfiguration
- ✅ Minimal und schnell
- ✅ Vollständig scriptbar

### Warum 10.0.0.x Netzwerk?

- ✅ Selten in privaten Netzwerken verwendet
- ✅ Keine Konflikte mit 192.168.x.x oder 172.16.x.x
- ✅ RFC1918 konform (privater Adressraum)

---

## 🔄 Updates & Roadmap

### Geplante Features

- [ ] Captive Portal Webseite mit Setup-Wizard
- [ ] QR-Code für schnelle WiFi-Verbindung
- [ ] Mehrere SSID-Profile speichern
- [ ] Auto-Switch zwischen bekannten Netzwerken
- [ ] Mobile App für Push-Benachrichtigungen

### Changelog

**v1.0 (Januar 2026)**
- ✅ Automatischer Access Point Fallback
- ✅ Monitoring-Loop mit konfigurierbarem Intervall
- ✅ WebApp Integration
- ✅ API Endpoints
- ✅ Systemd Service
- ✅ Captive Portal DNS

---

## 📞 Support

Bei Problemen:

1. **Logs prüfen:**
   ```bash
   sudo journalctl -u catboter-wifi-fallback -f
   ```

2. **GitHub Issues:** [Repository URL]/issues

3. **Community:** http://www.iotueli.ch

---

**Version:** 1.0
**Letzte Aktualisierung:** Januar 2026
**Kompatibilität:** Raspberry Pi 3/4/Zero 2
