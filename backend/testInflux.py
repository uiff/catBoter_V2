from influxdb_client import InfluxDBClient, Point, WritePrecision
import datetime
import time

# InfluxDB-Konfigurationsdetails
url = "http://192.168.40.11:8086"
token = "UGy5HCx8bzpvOgII-CyeuuDHL-DLgQP0CQXviIUoHoK7JU3-9x6qH-EjOChawSvGYasAo0hV7A7MaHmeY6GB9Q=="
org = "synology"
bucket = "test1"

try:
    # InfluxDBClient initialisieren
    client = InfluxDBClient(url=url, token=token, org=org)
    write_api = client.write_api()

    # Punkt erstellen
    point = Point("test_measurement") \
        .field("value", 42) \
        .tag("host", "test_host") \
        .time(datetime.datetime.utcnow(), WritePrecision.NS)

    # Daten schreiben
    write_api.write(bucket=bucket, record=point)
    print("Daten erfolgreich geschrieben!")

    # Warten, um sicherzustellen, dass alle Batch-Schreibvorgänge abgeschlossen sind
    time.sleep(2)

except Exception as e:
    print(f"Fehler: {e}")

finally:
    # Ressourcen freigeben
    if client:
        client.close()
