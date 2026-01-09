#!/usr/bin/env python3
"""
Gewichtssensor Kalibrierung - Korrektur
Anleitung:
1. Napf leeren
2. Script starten → wartet 5 Sekunden
3. Genau 140g auflegen
4. Script berechnet automatisch korrekte reference_unit
"""

import sys
import time
import json
sys.path.insert(0, '/home/iotueli/Desktop/catBoterV3/backend')

from SensorAktor.Gewichtssensor.gewichtssensor import Gewichtssensor

print("=" * 60)
print("GEWICHTSSENSOR KALIBRIERUNG")
print("=" * 60)

# Initialisiere Sensor
sensor = Gewichtssensor()

print("\n[SCHRITT 1] Tare - Nullpunkt setzen")
print("⚠️  Stelle sicher, dass der Napf LEER ist!")
print("⏳ Starte in 5 Sekunden...")
time.sleep(5)

# Tare durchführen
sensor.tare()
print(f"✅ Tare durchgeführt")
print(f"   Offset: {sensor.offset}")

# Warte kurz für Stabilisierung
time.sleep(3)

# Hole Rohwert bei leerem Napf (Durchschnitt von 20 Messungen)
print("\n[SCHRITT 2] Messe Rohwert bei leerem Napf...")
raw_empty = sensor.hx.get_value(20)
print(f"✅ Rohwert (leer): {raw_empty}")

print("\n[SCHRITT 3] Bekanntes Gewicht auflegen")
print("⚠️  Lege jetzt GENAU 140g auf die Waage!")
print("⏳ Warte 10 Sekunden...")
time.sleep(10)

# Hole Rohwert mit Gewicht (Durchschnitt von 20 Messungen)
print("\n[SCHRITT 4] Messe Rohwert mit 140g...")
raw_with_weight = sensor.hx.get_value(20)
print(f"✅ Rohwert (mit 140g): {raw_with_weight}")

# Berechne Differenz
diff = raw_with_weight - raw_empty
print(f"\n📊 Differenz: {diff:,} Einheiten")

# Berechne korrekte reference_unit
KNOWN_WEIGHT = 140.0  # gram
reference_unit = diff / KNOWN_WEIGHT

print(f"\n" + "=" * 60)
print(f"📐 BERECHNETE KALIBRIERUNG:")
print(f"=" * 60)
print(f"   reference_unit: {reference_unit:.2f}")
print(f"   offset: {sensor.offset:.2f}")
print(f"   (Erwartet ca. 500 für HX711 mit 140g = 70,000 Einheiten)")

# Speichere Kalibrierung
calibration_data = {
    "reference_unit": reference_unit,
    "offset": sensor.offset
}

calibration_file = '/home/iotueli/Desktop/catBoterV3/backend/SensorAktor/Gewichtssensor/kalibrierung.json'
with open(calibration_file, 'w') as f:
    json.dump(calibration_data, f)

print(f"\n✅ Kalibrierung gespeichert in: {calibration_file}")

# Test-Messung
print("\n[SCHRITT 5] Test-Messung...")
time.sleep(2)
sensor_test = Gewichtssensor()
weight = sensor_test.get_weight()
print(f"\n🧪 Gemessenes Gewicht: {weight:.2f}g")
print(f"   Erwartet: 140.00g")
print(f"   Abweichung: {abs(weight - 140.0):.2f}g")

if abs(weight - 140.0) < 5.0:
    print("\n✅ KALIBRIERUNG ERFOLGREICH!")
else:
    print("\n⚠️  WARNUNG: Große Abweichung - bitte Kalibrierung wiederholen")

print("\n" + "=" * 60)
print("FERTIG - Backend neu starten für Übernahme!")
print("=" * 60)
