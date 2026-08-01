"""Gemeinsame Locks.

feeding_lock serialisiert JEDE Fütterung (Plan-Scheduler UND manueller Feed) -
es gibt nur einen Motor und einen Napf.
"""
import threading

feeding_lock = threading.Lock()
