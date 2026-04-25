import json
import uuid
from datetime import datetime
from pathlib import Path

SPLITS_FILE = Path(__file__).parent / "splits_store.json"


def _load() -> list:
    if SPLITS_FILE.exists():
        try:
            return json.loads(SPLITS_FILE.read_text()).get("splits", [])
        except Exception:
            pass
    return []


def _save(splits: list) -> None:
    SPLITS_FILE.write_text(json.dumps({"splits": splits}, indent=2))


def save_split(split: dict) -> None:
    splits = _load()
    splits.append(split)
    _save(splits)


def list_splits() -> list:
    return _load()


def get_split(split_id: str) -> dict | None:
    for s in _load():
        if s.get("id") == split_id:
            return s
    return None


def update_request_status(split_id: str, request_id, status: str) -> None:
    splits = _load()
    for split in splits:
        if split.get("id") == split_id:
            for req in split.get("requests", []):
                if req.get("request_id") == request_id:
                    req["status"] = status
            break
    _save(splits)


def create_split(tx_description: str, tx_amount: float, requests: list) -> dict:
    split = {
        "id": f"split_{uuid.uuid4().hex[:8]}",
        "tx_description": tx_description,
        "tx_amount": tx_amount,
        "created_at": datetime.utcnow().isoformat(),
        "requests": [
            {
                "to_member_id": r.get("to_member_id"),
                "to_name": r.get("to_name"),
                "from_member_id": r.get("from_member_id"),
                "from_name": r.get("from_name"),
                "amount": r.get("amount"),
                "request_id": r.get("request_id"),
                "bunq_me_url": r.get("bunq_me_url"),
                "status": "pending",
            }
            for r in requests
        ],
    }
    save_split(split)
    return split
