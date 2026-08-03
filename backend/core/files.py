"""Atomare JSON-Schreibvorgänge - EINE Implementierung statt vier Kopien.

tmp-Datei + fsync + os.replace: ein Stromausfall mitten im Schreiben kann
nie eine halb geschriebene (= unlesbare) Datei hinterlassen. Kritisch für
feedingPlans.json - eine korrupte Plan-Datei hiesse: es wird still nie
mehr gefüttert.
"""
import json
import os


def atomic_write_json(path, data, indent=2):
    tmp = str(path) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, str(path))
