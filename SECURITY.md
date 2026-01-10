# 🔐 Sicherheitsrichtlinien - CatBoter V3

**Wichtig:** Lies dieses Dokument **vor** dem produktiven Einsatz!

---

## 🚨 Kritische Sicherheitsmaßnahmen

### 1. Secret Key ändern

**Warum:** Der SECRET_KEY wird für Session-Management und Verschlüsselung verwendet.

**Generieren:**
```bash
openssl rand -hex 32
```

**Setzen:**
```bash
# .env Datei erstellen
cp .env.example .env

# Secret Key eintragen
SECRET_KEY=<GENERIERTER-KEY>
```

**Beispiel:**
```env
SECRET_KEY=4d7548cf50ff31ba20dd6680d113a5107d90f732721d491e68f27439fa9820f2
```

---

### 2. WiFi Fallback Passwort ändern

**Standard-Passwort:** `catboter123` ⚠️ **ZU SCHWACH!**

**Generieren:**
```bash
# 24 Zeichen, alphanumerisch
openssl rand -base64 24 | tr -d '/+=' | head -c 24
```

**Setzen:**

**Methode 1: In der WebApp**
1. Öffne: **Einstellungen → WiFi Fallback**
2. Ändere Passwort
3. Klicke **Speichern**

**Methode 2: Manuell**
```bash
# Datei bearbeiten
nano backend/data/wifi_fallback_config.json
```

```json
{
  "enabled": true,
  "ssid": "CatBoter-Setup",
  "password": "ojoO9TkbVBSmupSCY3KFP751",  ← HIER ÄNDERN
  "channel": 6,
  "check_interval": 30
}
```

**Anforderungen:**
- ✅ Mindestens 16 Zeichen
- ✅ Mix aus Groß-/Kleinbuchstaben
- ✅ Zahlen enthalten
- ✅ Sonderzeichen optional (WPA2)

---

### 3. API Key (Optional)

Für zukünftige Authentifizierung:

```bash
openssl rand -hex 32
```

```env
API_KEY=<GENERIERTER-KEY>
```

---

## 🔒 Zusätzliche Sicherheitsmaßnahmen

### 4. File Permissions

**Sensible Dateien schützen:**

```bash
# WiFi Fallback Config
chmod 600 backend/data/wifi_fallback_config.json

# .env Datei
chmod 600 .env

# Kalibrierungsdaten
chmod 600 backend/backend/data/calibration.json
```

**Erklärung:**
- `600` = Nur Owner kann lesen/schreiben
- Verhindert dass andere User Passwörter lesen

---

### 5. .gitignore prüfen

**Stelle sicher dass sensible Dateien NICHT committed werden:**

```bash
# Prüfen ob .env in .gitignore
grep "\.env" .gitignore

# Falls nicht, hinzufügen:
echo ".env" >> .gitignore
echo "backend/data/wifi_fallback_config.json" >> .gitignore
echo "backend/backend/data/*.json" >> .gitignore
```

**Wichtig:**
- ✅ `.env` NIE committen
- ✅ Nur `.env.example` committen
- ✅ Passwörter NIE in Git

---

### 6. HTTPS in Produktion

**Für Internet-Zugriff (optional):**

```bash
# Let's Encrypt SSL
sudo apt-get install certbot python3-certbot-nginx

# Zertifikat erstellen
sudo certbot --nginx -d catboter.beispiel.de
```

**Nginx Config:**
```nginx
server {
    listen 443 ssl;
    server_name catboter.beispiel.de;

    ssl_certificate /etc/letsencrypt/live/catboter.beispiel.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/catboter.beispiel.de/privkey.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:5173;
    }
}
```

---

### 7. Firewall konfigurieren

**Nur notwendige Ports öffnen:**

```bash
# UFW (Uncomplicated Firewall)
sudo apt-get install ufw

# Nur lokales Netzwerk erlauben
sudo ufw allow from 192.168.0.0/24 to any port 5000
sudo ufw allow from 192.168.0.0/24 to any port 5173

# SSH erlauben (wichtig!)
sudo ufw allow 22/tcp

# Firewall aktivieren
sudo ufw enable
```

---

### 8. Regelmäßige Updates

```bash
# System updaten
sudo apt-get update
sudo apt-get upgrade -y

# Python Packages updaten
cd backend
source env/bin/activate
pip list --outdated
pip install --upgrade <package>

# Frontend Packages updaten
cd frontend-new
npm outdated
npm update
```

---

## 🛡️ Best Practices

### Passwort-Richtlinien

**Starke Passwörter:**
- ✅ Mindestens 16 Zeichen
- ✅ Groß- und Kleinbuchstaben
- ✅ Zahlen
- ✅ Sonderzeichen
- ❌ Keine Wörter aus Wörterbüchern
- ❌ Keine persönlichen Informationen

**Beispiele:**
```
✅ Gut:  ojoO9TkbVBSmupSCY3KFP751
✅ Gut:  X9!mK2#pLq8@nR5vTw3$
❌ Schlecht: catboter123
❌ Schlecht: password123
❌ Schlecht: MeinName2024
```

### Secrets Management

**Niemals:**
- ❌ Passwörter im Code hardcoden
- ❌ Secrets in Git committen
- ❌ Passwörter per E-Mail senden
- ❌ Default-Passwörter verwenden

**Immer:**
- ✅ Umgebungsvariablen verwenden (.env)
- ✅ Secrets verschlüsselt speichern
- ✅ Regelmäßig ändern
- ✅ Unterschiedliche Passwörter für Dev/Prod

---

## 📋 Sicherheits-Checkliste

### Vor Produktiv-Einsatz

- [ ] SECRET_KEY geändert (64 Zeichen Hex)
- [ ] WiFi Fallback Passwort geändert (min. 16 Zeichen)
- [ ] API_KEY generiert
- [ ] .env Datei erstellt (aus .env.example)
- [ ] .gitignore prüft .env
- [ ] File Permissions gesetzt (chmod 600)
- [ ] Default-Passwörter alle geändert
- [ ] Firewall konfiguriert
- [ ] HTTPS aktiviert (falls Internet-Zugriff)
- [ ] Regelmäßige Backups eingerichtet

### Regelmäßig (Monatlich)

- [ ] Logs auf ungewöhnliche Aktivitäten prüfen
- [ ] System-Updates installieren
- [ ] Python/Node Packages updaten
- [ ] Passwörter rotieren (90 Tage)
- [ ] Backup-Wiederherstellung testen

---

## 🚨 Incident Response

### Was tun bei Sicherheitsvorfall?

1. **Sofort:**
   - System vom Netzwerk trennen
   - Passwörter ändern
   - Logs sichern

2. **Analyse:**
   - Logs prüfen: `tail -f /tmp/catboter_backend.log`
   - Verbindungen prüfen: `sudo netstat -tulpn`
   - Prozesse prüfen: `ps aux | grep python`

3. **Wiederherstellung:**
   - System neu aufsetzen (falls kompromittiert)
   - Neue Secrets generieren
   - Firewall-Regeln verschärfen

---

## 📞 Support

Bei Sicherheitsfragen:
- **GitHub Security Advisories:** [Repository]/security
- **E-Mail:** security@iotueli.ch (wenn vorhanden)

---

## 🔐 Zusammenfassung

**Minimum-Sicherheit (MUSS):**
1. ✅ SECRET_KEY ändern
2. ✅ WiFi Fallback Passwort ändern
3. ✅ .env aus .gitignore
4. ✅ File Permissions setzen

**Empfohlen:**
5. ✅ Firewall konfigurieren
6. ✅ Regelmäßige Updates
7. ✅ HTTPS (falls Internet)

**Optional (für höchste Sicherheit):**
8. ✅ 2FA für SSH
9. ✅ Fail2Ban gegen Brute-Force
10. ✅ Security Monitoring (Sentry, etc.)

---

**Version:** 1.0
**Letzte Aktualisierung:** Januar 2026
**Status:** Produktionsreif mit diesen Maßnahmen ✅

**Denk dran: Sicherheit ist ein Prozess, keine Einmal-Aktion!** 🔐
