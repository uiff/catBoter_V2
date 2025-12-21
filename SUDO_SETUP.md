# Sudo-Berechtigungen für System-Kontrolle einrichten

Um die System-Kontroll-Buttons (Backend-Neustart, Reboot, Shutdown) nutzen zu können, müssen Sie passwordless sudo-Rechte für bestimmte Befehle einrichten.

## Schnell-Setup (Empfohlen)

Führen Sie diese Befehle als User aus, der das Backend ausführt (vermutlich `iotueli`):

```bash
# Erstellen Sie die sudoers-Datei
sudo nano /etc/sudoers.d/catboter
```

Fügen Sie folgende Zeilen ein (ersetzen Sie `iotueli` mit Ihrem Benutzernamen):

```
# CatBoter System Control
iotueli ALL=(ALL) NOPASSWD: /bin/systemctl restart catboter_autostart.service
iotueli ALL=(ALL) NOPASSWD: /sbin/reboot
iotueli ALL=(ALL) NOPASSWD: /sbin/shutdown
```

Speichern Sie mit `Ctrl+X`, dann `Y`, dann `Enter`.

## Berechtigungen überprüfen

Testen Sie, ob die Konfiguration funktioniert:

```bash
# Test Backend-Neustart (trocken)
sudo -n systemctl status catboter_autostart.service

# Test Reboot (NUR testen, NICHT ausführen!)
sudo -n true && echo "Sudo funktioniert!" || echo "Sudo-Rechte fehlen"
```

## Sicherheit

Diese Konfiguration erlaubt dem Benutzer `iotueli` nur diese spezifischen Befehle ohne Passwort auszuführen:
- Neustart des catboter_autostart Service
- System-Neustart
- System-Herunterfahren

Alle anderen sudo-Befehle erfordern weiterhin ein Passwort.

## Alternative: Alle systemctl-Befehle erlauben

Falls Sie mehr Flexibilität wünschen:

```
iotueli ALL=(ALL) NOPASSWD: /bin/systemctl
iotueli ALL=(ALL) NOPASSWD: /sbin/reboot
iotueli ALL=(ALL) NOPASSWD: /sbin/shutdown
```

## Fehlersuche

### Problem: "Keine sudo-Berechtigung"
- Überprüfen Sie, ob die Datei `/etc/sudoers.d/catboter` existiert
- Stellen Sie sicher, dass der Benutzername korrekt ist
- Testen Sie mit: `sudo -l` (zeigt erlaubte sudo-Befehle)

### Problem: "syntax error near line X"
- Die sudoers-Datei hat einen Syntaxfehler
- Führen Sie aus: `sudo visudo -c -f /etc/sudoers.d/catboter`
- Korrigieren Sie die Syntax entsprechend der Fehlermeldung

## Manuelle Korrektur

Falls Sie die Datei korrupt gemacht haben:

```bash
# Als root (oder mit sudo EDITOR=nano visudo)
sudo rm /etc/sudoers.d/catboter
# Dann neu erstellen mit dem obigen Schnell-Setup
```

## Backend-Neustart nach Konfiguration

Nach der Einrichtung der sudo-Rechte:

1. Testen Sie die Buttons im Frontend (Einstellungen-Seite)
2. Der Backend-Neustart sollte jetzt ohne Fehler funktionieren
3. Bei Erfolg: Die Seite lädt sich nach ~15 Sekunden automatisch neu

## Wichtig

⚠️ **Sicherheitshinweis**: Diese Konfiguration erlaubt dem angegebenen Benutzer, das System ohne Passwortabfrage neu zu starten oder herunterzufahren. Stellen Sie sicher, dass nur vertrauenswürdige Benutzer Zugriff auf das Frontend haben.
