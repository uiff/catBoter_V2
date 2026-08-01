"""Einfacher TTL-Cache für Sensorwerte (aus main.py übernommen, unverändert)."""
import logging
import time as time_module
from threading import Lock


class SimpleCache:
    """Einfacher Cache mit TTL ohne externe Dependencies"""
    def __init__(self):
        self.weight_cache = {'data': None, 'timestamp': 0, 'ttl': 0.5}  # 0.5s - Schnelles Update für manuelle Fütterung
        self.distance_cache = {'data': None, 'timestamp': 0, 'ttl': 10}  # 10s - Füllstand ändert sich langsam
        self.motor_cache = {'data': None, 'timestamp': 0, 'ttl': 1}  # 1s - Motor-Status muss schnell sein
        self.system_cache = {'data': None, 'timestamp': 0, 'ttl': 30}  # 30s - System-Info ändert sich selten
        self.feeding_cache = {'data': None, 'timestamp': 0, 'ttl': 5}  # 5s - Fütterungsstatus
        self.lock = Lock()

    def get(self, cache_type: str, key: str):
        with self.lock:
            cache = getattr(self, f"{cache_type}_cache", None)
            if cache and cache['data'] is not None:
                if time_module.time() - cache['timestamp'] < cache['ttl']:
                    logging.debug(f"Cache HIT: {cache_type}.{key}")
                    return cache['data']
                else:
                    cache['data'] = None
            return None

    def set(self, cache_type: str, key: str, value):
        with self.lock:
            cache = getattr(self, f"{cache_type}_cache", None)
            if cache is not None:
                cache['data'] = value
                cache['timestamp'] = time_module.time()
                logging.debug(f"Cache SET: {cache_type}.{key}")

    def clear_all(self):
        with self.lock:
            for cache_name in ['weight_cache', 'distance_cache', 'motor_cache', 'system_cache', 'feeding_cache']:
                cache = getattr(self, cache_name)
                cache['data'] = None
                cache['timestamp'] = 0


smart_cache = SimpleCache()
