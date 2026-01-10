# Contributing to CatBoter V3

Vielen Dank für dein Interesse an CatBoter V3! 🐱

## 🚀 Wie kann ich beitragen?

### Fehler melden (Bug Reports)
- Verwende [GitHub Issues](https://github.com/iotueli/catBoterV3/issues)
- Beschreibe das Problem detailliert
- Füge Screenshots hinzu wenn möglich
- Nenne deine Hardware (Raspberry Pi Modell)

### Feature Vorschläge
- Öffne ein [Issue](https://github.com/iotueli/catBoterV3/issues) mit Label "enhancement"
- Beschreibe den Use Case
- Erkläre warum das Feature hilfreich wäre

### Code Beiträge

#### Setup
```bash
# Repository forken und clonen
git clone https://github.com/IhrUsername/catBoterV3.git
cd catBoterV3

# Backend Setup
cd backend
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt

# Frontend Setup
cd ../frontend-new
npm install
```

#### Development Workflow
1. **Branch erstellen**
   ```bash
   git checkout -b feature/mein-neues-feature
   ```

2. **Änderungen machen**
   - Folge dem bestehenden Code-Style
   - Kommentiere komplexe Logik
   - Teste auf Raspberry Pi wenn Hardware-relevant

3. **Commit**
   ```bash
   git add .
   git commit -m "Add: Beschreibung der Änderung"
   ```

4. **Pull Request**
   - Push zu deinem Fork
   - Öffne PR gegen `main` Branch
   - Beschreibe deine Änderungen

## 📝 Code Style

### Python (Backend)
- PEP 8 Standard
- Type Hints wo möglich
- Docstrings für Funktionen

### TypeScript (Frontend)
- ESLint Konfiguration beachten
- Funktionale Components bevorzugen
- Props mit TypeScript typisieren

## 🧪 Testing

Vor dem PR:
```bash
# Backend
cd backend
python -m pytest

# Frontend
cd frontend-new
npm run build
```

## 📖 Dokumentation

- Update README.md bei neuen Features
- Dokumentiere API-Änderungen
- Füge Kommentare zu komplexem Code hinzu

## 🤝 Community Guidelines

- Sei respektvoll und konstruktiv
- Hilf anderen in Issues
- Teile deine Erfahrungen

## 📞 Kontakt

- GitHub Issues für Fragen
- Diskussionen im [Discussions Tab](https://github.com/iotueli/catBoterV3/discussions)

Danke für deine Unterstützung! 🎉
