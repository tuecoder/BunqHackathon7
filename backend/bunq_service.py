import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "hackathon_toolkit"))

from bunq_client import BunqClient

_client: BunqClient | None = None
_account_id: int | None = None


def init_bunq() -> None:
    """Initialise the primary BunqClient (from BUNQ_API_KEY in .env).
    Used as a fallback when not routing through the sandbox pool."""
    global _client, _account_id

    api_key = os.getenv("BUNQ_API_KEY", "").strip()
    sandbox = os.getenv("BUNQ_SANDBOX", "true").lower() == "true"

    if not api_key:
        print("No BUNQ_API_KEY — primary bunq client not initialised")
        return

    _client = BunqClient(api_key=api_key, sandbox=sandbox)
    _client.authenticate()

    account_id_env = os.getenv("BUNQ_MONETARY_ACCOUNT_ID", "").strip()
    _account_id = int(account_id_env) if account_id_env else _client.get_primary_account_id()
    print(f"Primary bunq user: user_id={_client.user_id}, account_id={_account_id}")


def create_bunqme_tab(client: BunqClient, account_id: int, amount: float, description: str) -> dict:
    """Create a BunqMeTab and return the real share URL.
    Uses:
      POST /user/{userId}/monetary-account/{accountId}/bunqme-tab
      GET  /user/{userId}/monetary-account/{accountId}/bunqme-tab/{tabId}
    """
    resp = client.post(
        f"user/{client.user_id}/monetary-account/{account_id}/bunqme-tab",
        {
            "bunqme_tab_entry": {
                "amount_inquired": {"value": f"{amount:.2f}", "currency": "EUR"},
                "description": description[:140],
            }
        },
    )
    tab_id = resp[0]["Id"]["id"]

    # Fetch the tab to get the real share URL
    tab_data = client.get(
        f"user/{client.user_id}/monetary-account/{account_id}/bunqme-tab/{tab_id}"
    )
    tab = tab_data[0]["BunqMeTab"]
    share_url = tab.get("bunqme_tab_share_url") or tab.get("bunqme_tab_entry", {}).get("bunqme_tab_share_url")

    return {"tab_id": tab_id, "bunq_me_url": share_url}


def create_request_inquiry(
    client: BunqClient,
    account_id: int,
    amount: float,
    description: str,
    debtor_alias: str,
) -> int:
    """Create a RequestInquiry (creditor asks debtor to pay).
    Uses:
      POST /user/{userId}/monetary-account/{accountId}/request-inquiry
    Returns the request_id.
    """
    resp = client.post(
        f"user/{client.user_id}/monetary-account/{account_id}/request-inquiry",
        {
            "amount_inquired": {"value": f"{amount:.2f}", "currency": "EUR"},
            "counterparty_alias": {
                "type": "EMAIL",
                "value": debtor_alias,
                "name": debtor_alias.split("@")[0].capitalize(),
            },
            "description": description[:140],
            "allow_bunqme": True,
        },
    )
    return resp[0]["Id"]["id"]


def create_payment_request_for_pool_member(
    creditor_member_id: str,
    debtor_email: str,
    amount: float,
    description: str,
) -> dict:
    """High-level helper: creates both a BunqMeTab AND a RequestInquiry
    using a sandbox pool member's authenticated client.
    """
    from sandbox_pool import get_pool
    pool = get_pool()

    creditor = pool.get_member(creditor_member_id)
    client = pool.get_client(creditor_member_id)
    account_id = creditor["account_id"]

    tab = create_bunqme_tab(client, account_id, amount, description)

    request_id = None
    if debtor_email:
        try:
            request_id = create_request_inquiry(client, account_id, amount, description, debtor_email)
        except Exception as e:
            print(f"RequestInquiry failed (non-fatal): {e}")

    return {
        "request_id": request_id,
        "bunq_me_url": tab["bunq_me_url"],
        "tab_id": tab["tab_id"],
    }


def create_payment_request(amount: float, description: str, counterparty_alias: str) -> dict:
    """Legacy helper using the primary client (BUNQ_API_KEY)."""
    if _client is None or _account_id is None:
        raise RuntimeError("Primary bunq client not initialised — set BUNQ_API_KEY in .env")

    tab = create_bunqme_tab(_client, _account_id, amount, description)

    request_id = None
    try:
        request_id = create_request_inquiry(_client, _account_id, amount, description, counterparty_alias)
    except Exception as e:
        print(f"RequestInquiry failed: {e}")

    return {"request_id": request_id, "bunq_me_url": tab["bunq_me_url"]}
