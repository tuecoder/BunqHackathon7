"""
Manages a pool of 5 pre-provisioned sandbox bunq users.
On first run: creates users, authenticates, funds with €500, persists to JSON.
On subsequent runs: loads from JSON and reconstructs authenticated BunqClient
instances directly (bypasses the toolkit's single-file context mechanism).
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "hackathon_toolkit"))

from bunq_client import BunqClient
from cryptography.hazmat.primitives import serialization

POOL_FILE = os.path.join(os.path.dirname(__file__), "sandbox_pool.json")

POOL_SLOTS = [
    {"id": "sp_0", "name": "Alice",  "color": "#5B6CF9"},
    {"id": "sp_1", "name": "Bob",    "color": "#E85D24"},
    {"id": "sp_2", "name": "Carlos", "color": "#1D9E75"},
    {"id": "sp_3", "name": "Dana",   "color": "#F59E0B"},
    {"id": "sp_4", "name": "Eva",    "color": "#EC4899"},
]


def _export_client_context(client: BunqClient) -> dict:
    """Serialize a BunqClient's session state for persistence."""
    return {
        "api_key": client.api_key,
        "sandbox": client.sandbox,
        "private_key_pem": client._private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode(),
        "installation_token": client.installation_token,
        "server_public_key": client.server_public_key,
        "session_token": client.session_token,
        "user_id": client.user_id,
    }


def _restore_client(ctx: dict) -> BunqClient:
    """Reconstruct an authenticated BunqClient from a persisted context dict."""
    client = BunqClient(api_key=ctx["api_key"], sandbox=ctx["sandbox"])
    client._private_key = serialization.load_pem_private_key(
        ctx["private_key_pem"].encode(), password=None
    )
    client._public_key_pem = client._private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    client.installation_token = ctx["installation_token"]
    client.server_public_key = ctx["server_public_key"]
    client.session_token = ctx["session_token"]
    client.user_id = ctx["user_id"]
    return client


class SandboxPool:
    def __init__(self):
        self._members: list[dict] = []        # full data including auth context
        self._clients: dict[str, BunqClient] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_or_provision(self) -> list[dict]:
        if os.path.exists(POOL_FILE):
            try:
                self._load()
                print(f"Sandbox pool loaded ({len(self._members)} members)")
                return self.list_members()
            except Exception as e:
                print(f"Pool file invalid ({e}) — re-provisioning...")

        self._provision()
        return self.list_members()

    def get_client(self, member_id: str) -> BunqClient:
        if member_id not in self._clients:
            raise KeyError(f"No sandbox client for {member_id!r}")
        client = self._clients[member_id]
        # Re-authenticate if session expired
        if not client._test_session():
            print(f"Re-authenticating {member_id}...")
            client.authenticate()
            # Refresh persisted context
            for m in self._members:
                if m["id"] == member_id:
                    m["auth_ctx"] = _export_client_context(client)
            self._save()
        return client

    def list_members(self) -> list[dict]:
        """Frontend-safe list — no api_key or private keys."""
        return [
            {
                "id": m["id"],
                "name": m["name"],
                "color": m["color"],
                "bunqAlias": m.get("email_alias"),
                "isMe": False,
            }
            for m in self._members
        ]

    def get_balances(self) -> dict[str, str]:
        balances = {}
        for m in self._members:
            try:
                client = self.get_client(m["id"])
                resp = client.get(f"user/{client.user_id}/monetary-account-bank")
                for item in resp:
                    acc = item.get("MonetaryAccountBank", {})
                    if acc.get("status") == "ACTIVE":
                        balances[m["id"]] = acc.get("balance", {}).get("value", "0.00")
                        break
            except Exception as e:
                print(f"Balance fetch failed for {m['id']}: {e}")
                balances[m["id"]] = "?"
        return balances

    def get_member(self, member_id: str) -> dict:
        for m in self._members:
            if m["id"] == member_id:
                return m
        raise KeyError(f"Member {member_id!r} not in pool")

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _provision(self) -> None:
        print("Provisioning 5 sandbox users — ~15 seconds...")
        members = []

        for slot in POOL_SLOTS:
            print(f"  [{slot['name']}] creating sandbox user...")
            api_key = BunqClient.create_sandbox_user()

            client = BunqClient(api_key=api_key, sandbox=True)
            client.authenticate()

            account_id = client.get_primary_account_id()
            email_alias = self._get_email_alias(client, account_id)
            self._fund_account(client, account_id)

            member = {
                **slot,
                "user_id": client.user_id,
                "account_id": account_id,
                "email_alias": email_alias,
                "auth_ctx": _export_client_context(client),
            }
            members.append(member)
            self._clients[slot["id"]] = client
            print(f"  [{slot['name']}] user_id={client.user_id}  alias={email_alias}")

        self._members = members
        self._save()
        print("Sandbox pool ready.")

    def _load(self) -> None:
        with open(POOL_FILE) as f:
            data = json.load(f)

        self._members = data["members"]
        self._clients = {}
        for m in self._members:
            self._clients[m["id"]] = _restore_client(m["auth_ctx"])

    def _save(self) -> None:
        with open(POOL_FILE, "w") as f:
            json.dump({"members": self._members}, f, indent=2)

    @staticmethod
    def _get_email_alias(client: BunqClient, account_id: int) -> str | None:
        resp = client.get(f"user/{client.user_id}/monetary-account-bank")
        for item in resp:
            acc = item.get("MonetaryAccountBank", {})
            if acc.get("id") == account_id:
                for alias in acc.get("alias", []):
                    if alias.get("type") == "EMAIL":
                        return alias["value"]
        return None

    @staticmethod
    def _fund_account(client: BunqClient, account_id: int) -> None:
        try:
            client.post(
                f"user/{client.user_id}/monetary-account/{account_id}/request-inquiry",
                {
                    "amount_inquired": {"value": "500.00", "currency": "EUR"},
                    "counterparty_alias": {
                        "type": "EMAIL",
                        "value": "sugardaddy@bunq.com",
                        "name": "Sugar Daddy",
                    },
                    "description": "Hackathon test funds",
                    "allow_bunqme": False,
                },
            )
            time.sleep(1)
        except Exception as e:
            print(f"  Funding failed (non-fatal): {e}")


# Module-level singleton
_pool: SandboxPool | None = None


def get_pool() -> SandboxPool:
    global _pool
    if _pool is None:
        _pool = SandboxPool()
    return _pool
