#!/usr/bin/env python3
"""
Einfache Kalibrierung mit direkten Rohwerten
"""
import sys
import time
import json
sys.path.insert(0, '/home/iotueli/Desktop/catBoterV3/backend')

from SensorAktor.Gewichtssensor.gewichtssensor import Gewichtssensor

print("=" * 60)
print("GEWICHTSSENSOR KALIBRIERUNG - EINFACHE METHODE")
print("=" * 60)

# Lade aktuellen Sensor
sensor = Gewichtssensor()

print(f"\n📊 Aktuelle Kalibrierung:")
print(f"   Offset: {sensor.offset}")
print(f"   Reference Unit: {sensor.reference_unit}")

print("\n[SCHRITT 1] Napf leeren!")
print("⚠️  Stelle sicher, dass der Napf KOMPLETT LEER ist!")
print("⏳ Starte in 5 Sekunden...")
time.sleep(5)

# Tare
print("\n[Tare wird durchgeführt...]")
sensor.tare()
print(f"✅ Neuer Offset: {sensor.offset}")

# Warte auf Stabilisierung
time.sleep(3)

# Messe Gewicht bei leerem Napf
print("\n[SCHRITT 2] Messe bei leerem Napf...")
weight_empty = sensor.get_weight()
print(f"✅ Gewicht (leer): {weight_empty}g")

print("\n[SCHRITT 3] 140g auflegen!")
print("⚠️  Lege jetzt GENAU 140g auf die Waage!")
print("⏳ Warte 8 Sekunden...")
time.sleep(8)

# Messe Gewicht mit 140g (vor Kalibrierung)
print("\n[Messe mit aktueller Kalibrierung...]")
weight_before_calibration = sensor.get_weight()
print(f"   Aktuell gemessen: {weight_before_calibration}g")
print(f"   Sollwert: 140.0g")
print(f"   Fehler: {weight_before_calibration - 140.0}g")

# Berechne Korrektur-Faktor
if weight_before_calibration > 0:
    correction_factor = 140.0 / weight_before_calibration
    new_reference_unit = sensor.reference_unit * correction_factor

    print(f"\n📐 KALIBRIERUNG BERECHNET:")
    print(f"   Aktuell: {sensor.reference_unit:.2f}")
    print(f"   Korrektur-Faktor: {correction_factor:.4f}")
    print(f"   Neu: {new_reference_unit:.2f}")

    # Speichere neue Kalibrierung
    calibration_data = {
        "reference_unit": new_reference_unit,
        "offset": sensor.offset
    }

    with open('/home/iotueli/Desktop/catBoterV3/backend/SensorAktor/Gewichtssensor/kalibrierung.json', 'w') as f:
        json.dump(calibration_data, f)

    print(f"\n✅ Kalibrierung gespeichert!")

    # Test mit neuer Kalibrierung
    print("\n[SCHRITT 4] Test mit neuer Kalibrierung...")
    time.sleep(2)
    sensor_test = Gewichtssensor()
    weight_after = sensor_test.get_weight()

    print(f"\n🧪 TEST-MESSUNG:")
    print(f"   Gemessen: {weight_after:.2f}g")
    print(f"   Erwartet: 140.00g")
    print(f"   Abweichung: {abs(weight_after - 140.0):.2f}g")

    if abs(weight_after - 140.0) < 5.0:
        print("\n✅ KALIBRIERUNG ERFOLGREICH!")
    else:
        print("\n⚠️  Abweichung noch groß - ggf. wiederholen")
else:
    print("\n❌ FEHLER: Kein Gewicht gemessen!")

print("\n" + "=" * 60)
print("Backend neu starten für Übernahme:")
print("ps aux | grep main.py | grep -v grep | awk '{print $2}' | xargs kill -9")
print("cd backend && source env/bin/activate && python main.py &")
print("=" * 60)
