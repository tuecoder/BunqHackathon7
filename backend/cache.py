import time

_store: dict = {}


def get(key: str):
    entry = _store.get(key)
    if entry and time.time() - entry["ts"] < entry["ttl"]:
        return entry["v"]
    return None


def set(key: str, value, ttl: int = 30):
    _store[key] = {"v": value, "ts": time.time(), "ttl": ttl}
