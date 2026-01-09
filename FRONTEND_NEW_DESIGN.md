# 🎨 catBoter V3 - Neues Frontend Design

## 🎯 Design-Philosophie

### Verbesserungen gegenüber dem alten Frontend:

1. **Vereinfachte Navigation**
   - Reduziert von 5 auf 4 Hauptseiten
   - Dashboard, Feed, Monitor, Settings
   - Logischere Gruppierung

2. **Bessere Feature-Organisation**
   - Auto + Random Plans zusammengefasst in "Feed"-Seite
   - Alle Einstellungen vereint in "Settings"
   - Motor-Steuerung prominent auf Dashboard

3. **Moderne UI/UX**
   - Glassmorphism statt flache Karten
   - Smooth Animations & Transitions
   - Bessere Mobile-First Experience
   - Touch-optimierte Controls

4. **Performance**
   - Vite statt Create React App (10x schneller)
   - TanStack Query für optimiertes Caching
   - Lazy Loading für alle Routes
   - Virtual Scrolling für lange Listen

---

## 📱 Neue Seitenstruktur

### 1. **Dashboard (Home)**
**Was es zeigt:**
- Hero-Section mit 3 großen Metriken-Cards
  - Futtertank-Level (mit Füllstands-Animation)
  - Schale-Gewicht (Live-Update)
  - Heute gefüttert (Progress-Ring)
- Quick-Actions-Bar:
  - Manual Feed Button (prominent)
  - Emergency Stop
  - Refresh
- Next Feeding Card (Countdown bis nächste Fütterung)
- Motor Status Indicator (Live-Puls-Animation)
- Recent Activity Feed (letzte 5 Aktionen)

**Verbesserungen:**
- Alle wichtigen Infos auf einen Blick
- Keine versteckten Features
- Touch-optimierter Feed-Button

---

### 2. **Feed (Fütterungsmanagement)**
**Was es zeigt:**
- Tab-Navigation mit 3 Modi:
  - **Manual**: Hold-to-Run Control (wie bisher)
  - **Schedule**: Auto-Plans Management
  - **Random**: Random-Plans Management

- **Manual Tab:**
  - Großer Hold-Button in der Mitte
  - Live-Gewichtsanzeige
  - Timer während Fütterung
  - Quick-Amount-Buttons (10g, 25g, 50g)

- **Schedule Tab:**
  - Timeline-View der heutigen Fütterungen
  - Plan-Editor (Drag & Drop für Zeiten)
  - Plan-Bibliothek (Cards mit Preview)
  - Quick-Duplicate Feature

- **Random Tab:**
  - Visual Interval-Slider
  - Daily-Weight-Distribution-Chart
  - Next-Random-Time-Countdown
  - Re-Generate Button

**Verbesserungen:**
- Alles an einem Ort
- Intuitivere Bedienung
- Visual Feedback für alle Aktionen

---

### 3. **Monitor (Überwachung)**
**Was es zeigt:**
- Multi-Metric-Dashboard:
  - 4 kleine Metric-Cards (CPU, Temp, RAM, Disk)
  - Großes Chart-Widget (Fullscreen-Option)
  - Time-Range-Selector als Chips
  - Metric-Selector als Icon-Buttons

- Smart-Insights-Section:
  - "Futter reicht noch X Tage" (Prediction)
  - "Durchschnitt pro Fütterung: Xg"
  - "Peak-Zeiten: 08:00, 18:00"
  - Anomalie-Warnings

- System-Health-Card:
  - All-in-One Status
  - Quick-Restart-Buttons
  - Uptime-Display

**Verbesserungen:**
- Weniger Klicks für Charts
- Smart Predictions
- Bessere System-Health-Übersicht

---

### 4. **Settings (Einstellungen)**
**Was es zeigt:**
- Accordion-Layout für Kategorien:

  **Calibration:**
  - Weight-Scale-Calibration (wie bisher)
  - Interactive Step-by-Step-Guide

  **Connectivity:**
  - WiFi-Manager (Scan + Connect)
  - Network-Info-Card
  - Time-Sync (NTP/Manual)

  **System:**
  - Backend-Restart
  - System-Reboot
  - Shutdown
  - API-Docs-Link

  **Notifications:**
  - Low-Food-Alerts (On/Off)
  - System-Alerts (On/Off)
  - Sound (On/Off)

  **About:**
  - Version-Info
  - Developer-Info
  - Credits

**Verbesserungen:**
- Alles übersichtlich gruppiert
- Weniger Scrollen
- Schnellerer Zugriff

---

## 🎨 Design-System

### Farben
```css
--bg-primary: #0a0a0a (Haupt-Hintergrund)
--bg-secondary: #121212 (Cards)
--bg-tertiary: #1a1a1a (Elevated)

--accent-primary: #06b6d4 (Cyan - Haupt-Aktionen)
--accent-secondary: #8b5cf6 (Lila - Spezial-Features)
--accent-success: #10b981 (Grün - Erfolg)
--accent-warning: #f59e0b (Orange - Warnung)
--accent-error: #ef4444 (Rot - Fehler)

--text-primary: #ffffff
--text-secondary: #94a3b8
--text-muted: #64748b
```

### Glassmorphism
```css
backdrop-blur: 12px
background: rgba(255, 255, 255, 0.05)
border: 1px solid rgba(255, 255, 255, 0.1)
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2)
```

### Typography
- Font: Inter (System-Font-Fallback)
- Display: 36px/44px (bold)
- Heading: 24px/32px (semibold)
- Body: 16px/24px (normal)
- Caption: 14px/20px (medium)

---

## 🚀 Tech-Stack

### Core
- **Vite** - Build Tool
- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **React Router v6** - Routing

### UI & Styling
- **Tailwind CSS** - Utility-First CSS
- **shadcn/ui** - Component Library
- **Framer Motion** - Animations
- **Lucide Icons** - Icon Set

### State & Data
- **TanStack Query** - Server State
- **Zustand** - Client State
- **Socket.IO Client** - WebSocket

### Charts & Visualization
- **Recharts** - Charts
- **React Circular Progressbar** - Progress Rings

### Utils
- **date-fns** - Date Formatting
- **clsx** - Conditional Classes
- **tailwind-merge** - Class Merging

---

## 📁 Verzeichnisstruktur

```
frontend-new/
├── public/
│   ├── service-worker.js
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── app/                    # App-Setup
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   └── Header.tsx
│   │   ├── dashboard/
│   │   ├── feed/
│   │   ├── monitor/
│   │   └── settings/
│   ├── features/               # Feature-based modules
│   │   ├── feeding/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── monitoring/
│   │   ├── schedule/
│   │   └── system/
│   ├── hooks/                  # Shared hooks
│   ├── lib/                    # Utils & configs
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Feed.tsx
│   │   ├── Monitor.tsx
│   │   └── Settings.tsx
│   ├── stores/                 # Zustand stores
│   ├── styles/
│   │   └── globals.css
│   └── types/                  # Global types
```

---

## 🎯 Key Improvements Summary

1. ✅ **Schnellerer Build** (Vite vs CRA)
2. ✅ **Bessere Performance** (TanStack Query Caching)
3. ✅ **Moderneres Design** (Glassmorphism, Animations)
4. ✅ **Intuitivere Navigation** (4 statt 5 Seiten)
5. ✅ **Bessere Mobile Experience** (Touch-optimiert)
6. ✅ **Smart Features** (Predictions, Insights)
7. ✅ **Weniger Klicks** (Alles an logischen Orten)
8. ✅ **PWA-Ready** (Offline Support, Install-Prompt)
9. ✅ **Type-Safe** (Full TypeScript)
10. ✅ **Maintainable** (Feature-based Architecture)

---

## 🎨 Visual Design Concepts

### Hero-Metrics auf Dashboard
```
┌────────────────────────────────────────────┐
│  [Icon]  Futtertank           [▓▓▓▓░░] 76% │
│          Level                              │
└────────────────────────────────────────────┘
```

### Feed-Control
```
┌──────────────────────┐
│                      │
│   [Hold to Feed]     │ <- Großer Button
│     •••  12.5g       │ <- Live-Gewicht
│                      │
└──────────────────────┘
```

### Schedule Timeline
```
07:00 ━━━━━ 50g ✓
12:00 ━━━━━ 75g ✓
18:00 ━━━━━ 50g ⏳
23:00 ━━━━━ 25g ○
```

---

Start with implementation? 🚀
