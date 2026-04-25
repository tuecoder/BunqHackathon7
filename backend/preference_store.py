import json
from pathlib import Path

PREF_FILE = Path(__file__).parent / "preference_store.json"


def _load() -> dict:
    if PREF_FILE.exists():
        try:
            return json.loads(PREF_FILE.read_text())
        except Exception:
            pass
    return {}


def _save(data: dict) -> None:
    PREF_FILE.write_text(json.dumps(data, indent=2))


def record_item_assignments(group_id: str, bill_items: list, split_date: str) -> None:
    if not group_id or not bill_items:
        return
    data = _load()
    group_prefs = data.setdefault(group_id, {})
    for item in bill_items:
        for member_id in item.get("assigned_to", []):
            member_history = group_prefs.setdefault(member_id, [])
            member_history.append({
                "item_name": item["name"],
                "price": item.get("price", 0),
                "date": split_date,
            })
    _save(data)


def get_group_preferences(group_id: str) -> dict:
    return _load().get(group_id, {})


def get_split_count(group_id: str) -> int:
    prefs = _load().get(group_id, {})
    if not prefs:
        return 0
    return max(len(v) for v in prefs.values())
