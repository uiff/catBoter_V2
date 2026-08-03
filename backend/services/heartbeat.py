"""Herzschlag interner Schleifen - für einen EHRLICHEN Healthcheck.

Bisher meldete /health "online", solange Flask antwortete - ob der
Fütterungs-Scheduler noch tickte, prüfte niemand. Hängt der Scheduler,
würden die Katzen bei grünem Status hungern.
"""
import time

_beats = {}


def beat(name: str):
    _beats[name] = time.time()


def age(name: str):
    """Sekunden seit dem letzten Herzschlag (None = nie geschlagen)."""
    ts = _beats.get(name)
    return None if ts is None else time.time() - ts
