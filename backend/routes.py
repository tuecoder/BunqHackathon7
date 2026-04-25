from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Any
import uuid
from datetime import datetime

router = APIRouter()

# Demo transactions shown when bunq API is unavailable or empty
DEMO_TRANSACTIONS = [
    {"id": "demo_1", "merchant": "Albert Heijn", "amount": -62.40, "currency": "EUR",
     "date": "2026-04-24", "description": "AH Albert Heijn", "type": "debit"},
    {"id": "demo_2", "merchant": "Restaurant Lastage", "amount": -45.00, "currency": "EUR",
     "date": "2026-04-23", "description": "Dinner", "type": "debit"},
    {"id": "demo_3", "merchant": "Airbnb", "amount": -180.00, "currency": "EUR",
     "date": "2026-04-21", "description": "Berlin accommodation", "type": "debit"},
    {"id": "demo_4", "merchant": "Uber", "amount": -12.50, "currency": "EUR",
     "date": "2026-04-20", "description": "Taxi to airport", "type": "debit"},
    {"id": "demo_5", "merchant": "Jumbo Supermarkt", "amount": -28.90, "currency": "EUR",
     "date": "2026-04-19", "description": "Groceries", "type": "debit"},
]


# ── Bill extraction ────────────────────────────────────────────────────────────

class ExtractBillRequest(BaseModel):
    image_base64: str
    image_type: str = "image/jpeg"


@router.post("/api/extract-bill")
async def extract_bill(req: ExtractBillRequest):
    from ai_extractor import extract_bill as do_extract
    result = do_extract(req.image_base64, req.image_type)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result)
    return result


# ── Sandbox pool ───────────────────────────────────────────────────────────────

@router.post("/api/provision-sandbox")
async def provision_sandbox():
    """Create (or load) the pool of 5 sandbox users. Call once before the demo."""
    from sandbox_pool import get_pool
    pool = get_pool()
    members = pool.load_or_provision()
    balances = pool.get_balances()
    for m in members:
        m["balance"] = balances.get(m["id"], "?")
    return {"members": members}


@router.get("/api/sandbox-users")
async def list_sandbox_users():
    """Return pool members. Only fetches Alice's balance (fast). Auto-loads pool if needed."""
    from sandbox_pool import get_pool, POOL_FILE
    import os as _os
    pool = get_pool()
    if not pool._members:
        if not _os.path.exists(POOL_FILE):
            raise HTTPException(status_code=503, detail="Pool not provisioned — run setup_sandbox.py first")
        try:
            pool.load_or_provision()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Could not load pool: {e}")
    members = pool.list_members()
    # Only fetch balance for Alice (sp_0) — avoids 5 bunq API calls on every page load
    alice_balance = "?"
    try:
        alice_balance = pool.get_balances().get("sp_0", "?")
    except Exception:
        pass
    for m in members:
        m["balance"] = alice_balance if m["id"] == "sp_0" else None
    return {"members": members}


# ── Payment requests ───────────────────────────────────────────────────────────

class PoolPaymentRequest(BaseModel):
    creditor_member_id: str         # pool member who is owed money
    debtor_member_id: Optional[str] = None   # pool member who owes
    amount: float
    description: str


class LegacyPaymentRequest(BaseModel):
    from_bunq_alias: str
    amount: float
    description: str


# ── Groups ────────────────────────────────────────────────────────────────────

class CreateGroupRequest(BaseModel):
    name: str
    memberIds: List[str]
    color: str = "#5B6CF9"
    emoji: str = "👥"


def _enrich_group(group: dict) -> dict:
    """Add member detail objects to a group dict."""
    from sandbox_pool import get_pool
    pool = get_pool()
    members_out = []
    for mid in group.get("memberIds", []):
        try:
            m = pool.get_member(mid)
            members_out.append({
                "id": m["id"],
                "name": m["name"],
                "color": m["color"],
                "bunqAlias": m.get("email_alias"),
            })
        except KeyError:
            members_out.append({"id": mid, "name": mid, "color": "#9ca3af", "bunqAlias": None})
    return {**group, "members": members_out}


@router.get("/api/groups")
async def list_groups():
    from groups_store import list_groups as _list
    groups = _list()
    return {"groups": [_enrich_group(g) for g in groups]}


@router.post("/api/groups")
async def create_group(req: CreateGroupRequest):
    from groups_store import create_group as _create
    group = _create(req.name, req.memberIds, req.color, req.emoji)
    return {"group": _enrich_group(group)}


# ── Transactions ───────────────────────────────────────────────────────────────

@router.get("/api/transactions")
async def get_transactions(member_id: str = Query(..., description="Pool member ID e.g. sp_0")):
    from sandbox_pool import get_pool
    pool = get_pool()
    if not pool._members:
        return {"transactions": DEMO_TRANSACTIONS}
    try:
        client = pool.get_client(member_id)
        member = pool.get_member(member_id)
        account_id = member["account_id"]
        raw = client.get(
            f"user/{client.user_id}/monetary-account/{account_id}/payment",
            {"count": "20"},
        )
        txs = []
        for item in raw:
            p = item.get("Payment", {})
            if not p:
                continue
            amt_val = float(p.get("amount", {}).get("value", "0"))
            created = p.get("created", "")[:10]
            counterparty = p.get("counterparty_alias", {}).get("display_name", "Unknown")
            description = p.get("description", "")
            txs.append({
                "id": str(p.get("id", "")),
                "merchant": description or counterparty,
                "amount": amt_val,
                "currency": p.get("amount", {}).get("currency", "EUR"),
                "date": created,
                "description": description,
                "counterparty": counterparty,
                "type": "debit" if amt_val < 0 else "credit",
            })
        # Fall back to demo data if bunq returned nothing useful
        if not txs:
            return {"transactions": DEMO_TRANSACTIONS}
        return {"transactions": txs}
    except Exception as e:
        print(f"Transactions fetch failed: {e}")
        return {"transactions": DEMO_TRANSACTIONS}


# ── Payment requests ───────────────────────────────────────────────────────────

@router.post("/api/request-payment")
async def request_payment(req: PoolPaymentRequest):
    """
    Create a real BunqMeTab + RequestInquiry using sandbox pool clients.
    creditor_member_id = pool member who gets paid (creates the request)
    debtor_member_id   = pool member who owes (receives the request)
    """
    from sandbox_pool import get_pool
    from bunq_service import create_payment_request_for_pool_member

    pool = get_pool()
    if not pool._members:
        raise HTTPException(status_code=503, detail="Sandbox pool not provisioned")

    try:
        debtor_email = None
        if req.debtor_member_id:
            debtor = pool.get_member(req.debtor_member_id)
            debtor_email = debtor.get("email_alias")

        result = create_payment_request_for_pool_member(
            creditor_member_id=req.creditor_member_id,
            debtor_email=debtor_email,
            amount=req.amount,
            description=req.description,
        )
        return result
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Splits (payment status tracking) ─────────────────────────────────────────

class SplitRequestItem(BaseModel):
    to_member_id: str
    to_name: str
    from_member_id: Optional[str] = None
    from_name: Optional[str] = None
    amount: float
    request_id: Optional[Any] = None
    bunq_me_url: Optional[str] = None


class BillItemAssignment(BaseModel):
    name: str
    price: float
    quantity: float = 1.0
    assigned_to: List[str]


class SplitRecord(BaseModel):
    tx_description: str
    tx_amount: float
    group_id: Optional[str] = None
    requests: List[SplitRequestItem]
    bill_items: List[BillItemAssignment] = []


@router.post("/api/splits")
async def record_split(body: SplitRecord):
    from splits_store import create_split
    from preference_store import record_item_assignments
    split = create_split(
        tx_description=body.tx_description,
        tx_amount=body.tx_amount,
        requests=[r.model_dump() for r in body.requests],
        bill_items=[i.model_dump() for i in body.bill_items],
        group_id=body.group_id,
    )
    if body.group_id and body.bill_items:
        try:
            record_item_assignments(body.group_id, [i.model_dump() for i in body.bill_items], split["created_at"])
        except Exception as e:
            print(f"Could not record item preferences: {e}")
    return {"split_id": split["id"]}


# ── Preference-based suggestions ──────────────────────────────────────────────

class SuggestRequest(BaseModel):
    group_id: str
    bill_items: List[Any]


@router.post("/api/suggest-assignments")
async def suggest_assignments(req: SuggestRequest):
    from ai_suggester import suggest_item_assignments
    from sandbox_pool import get_pool
    pool = get_pool()
    member_names = {m["id"]: m["name"] for m in pool.list_members()} if pool._members else {}
    try:
        suggestions = suggest_item_assignments(req.bill_items, req.group_id, member_names)
    except Exception as e:
        print(f"Suggestion error: {e}")
        suggestions = {}
    return {"suggestions": suggestions, "has_history": bool(suggestions)}


@router.get("/api/splits/{split_id}")
async def get_split_status(split_id: str):
    from splits_store import get_split, update_request_status
    from sandbox_pool import get_pool

    split = get_split(split_id)
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    # Refresh statuses from bunq for any pending requests that have a request_id
    pool = get_pool()
    if pool._members:
        try:
            alice = pool.get_member("sp_0")
            alice_client = pool.get_client("sp_0")
            alice_uid = alice_client.user_id
            alice_aid = alice["account_id"]

            inquiries = alice_client.get(
                f"user/{alice_uid}/monetary-account/{alice_aid}/request-inquiry",
                {"count": "50"},
            )
            bunq_status_map = {}
            for item in inquiries:
                req = item.get("RequestInquiry", {})
                if req.get("id"):
                    bunq_status_map[req["id"]] = req.get("status", "PENDING")

            for req in split.get("requests", []):
                if req.get("status") == "pending" and req.get("request_id"):
                    bunq_status = bunq_status_map.get(req["request_id"])
                    if bunq_status in ("ACCEPTED", "REVOKED"):
                        update_request_status(split_id, req["request_id"], "paid")
                        req["status"] = "paid"
        except Exception as e:
            print(f"Could not refresh split status from bunq: {e}")

    # Re-read from disk to get merged state
    from splits_store import get_split as _get
    split = _get(split_id)
    paid = sum(1 for r in split.get("requests", []) if r.get("status") == "paid")
    pending = len(split.get("requests", [])) - paid
    return {"split": split, "paid": paid, "pending": pending}
