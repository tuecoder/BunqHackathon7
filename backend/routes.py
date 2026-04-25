from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

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
    """Return the pool members with current balances (pool must already be provisioned)."""
    from sandbox_pool import get_pool
    pool = get_pool()
    if not pool._members:
        raise HTTPException(status_code=404, detail="Pool not provisioned — call POST /api/provision-sandbox first")
    members = pool.list_members()
    balances = pool.get_balances()
    for m in members:
        m["balance"] = balances.get(m["id"], "?")
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
            txs.append({
                "id": str(p.get("id", "")),
                "merchant": counterparty,
                "amount": amt_val,
                "currency": p.get("amount", {}).get("currency", "EUR"),
                "date": created,
                "description": p.get("description", ""),
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
