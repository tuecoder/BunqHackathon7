import json
import os
import uuid

GROUPS_FILE = os.path.join(os.path.dirname(__file__), "groups.json")

DEFAULT_GROUPS = [
    {
        "id": "g_0",
        "name": "Roommates",
        "memberIds": ["sp_0", "sp_1", "sp_2"],
        "color": "#5B6CF9",
        "emoji": "🏠",
    },
    {
        "id": "g_1",
        "name": "Berlin Trip",
        "memberIds": ["sp_0", "sp_3", "sp_4"],
        "color": "#E85D24",
        "emoji": "✈️",
    },
]


def _load() -> list[dict]:
    if not os.path.exists(GROUPS_FILE):
        return [g.copy() for g in DEFAULT_GROUPS]
    with open(GROUPS_FILE) as f:
        data = json.load(f)
    return data.get("groups", [g.copy() for g in DEFAULT_GROUPS])


def _save(groups: list[dict]) -> None:
    with open(GROUPS_FILE, "w") as f:
        json.dump({"groups": groups}, f, indent=2)


def list_groups() -> list[dict]:
    return _load()


def create_group(name: str, member_ids: list[str], color: str, emoji: str) -> dict:
    groups = _load()
    group = {
        "id": f"g_{uuid.uuid4().hex[:8]}",
        "name": name,
        "memberIds": member_ids,
        "color": color,
        "emoji": emoji,
    }
    groups.append(group)
    _save(groups)
    return group


def get_group(group_id: str) -> dict | None:
    for g in _load():
        if g["id"] == group_id:
            return g
    return None
