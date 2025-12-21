# CatBoter Frontend

Das Frontend für das CatBoter-System bietet eine Weboberfläche zur Überwachung und Konfiguration des Fütterungsautomaten.

## Features

- Dashboard mit Live-Status
- Verwaltung von Fütterungsplänen
- Sensor- und Aktorsteuerung
- Einstellungen für Netzwerk und Benachrichtigungen

## Setup

1. Node.js und npm installieren
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```

## Starten (Entwicklung)

```bash
npm start
```

Die Anwendung ist dann meist unter [http://localhost:3000](http://localhost:3000) erreichbar.

## Build (für Produktion)

```bash
npm run build
```

Das gebaute Frontend befindet sich im `build/`-Verzeichnis.

## Konfiguration

Umgebungsvariablen können in der Datei `.env` gesetzt werden.

## Verzeichnisstruktur

- `src/components/` – React-Komponenten
- `src/pages/` – Seitenansichten
- `public/` – Statische Dateien

## Lizenz

MIT License
