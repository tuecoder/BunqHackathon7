import json
import os
import sys
from unittest.mock import MagicMock, patch, call

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "hackathon_toolkit"))


def _make_mock_client(user_id=100, account_id=200, email="alice@sandbox.bunq.com"):
    client = MagicMock()
    client.user_id = user_id
    client.sandbox = True
    client.api_key = "sandbox_test"
    client.installation_token = "inst_tok"
    client.server_public_key = "srv_pub_key"
    client.session_token = "sess_tok"
    client._test_session.return_value = True
    client.get_primary_account_id.return_value = account_id
    client.post.return_value = [{"Id": {"id": 999}}]

    # monetary-account-bank response with email alias
    acc_resp = [{"MonetaryAccountBank": {
        "id": account_id, "status": "ACTIVE",
        "balance": {"value": "500.00", "currency": "EUR"},
        "alias": [{"type": "EMAIL", "value": email}]
    }}]
    client.get.return_value = acc_resp

    # Make private key serializable
    from cryptography.hazmat.primitives.asymmetric import rsa
    client._private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return client


def test_list_members_excludes_sensitive_fields():
    from sandbox_pool import SandboxPool
    pool = SandboxPool()
    pool._members = [{
        "id": "sp_0", "name": "Alice", "color": "#5B6CF9",
        "email_alias": "alice@sandbox.bunq.com",
        "user_id": 1, "account_id": 2,
        "auth_ctx": {"api_key": "SECRET", "session_token": "SECRET"},
    }]
    members = pool.list_members()
    assert len(members) == 1
    assert "auth_ctx" not in members[0]
    assert "api_key" not in members[0]
    assert members[0]["bunqAlias"] == "alice@sandbox.bunq.com"


def test_get_client_returns_correct_client():
    from sandbox_pool import SandboxPool
    pool = SandboxPool()
    mock_client = _make_mock_client()
    pool._clients["sp_0"] = mock_client
    pool._members = [{"id": "sp_0", "name": "Alice", "color": "#5B6CF9",
                      "account_id": 200, "email_alias": "alice@bunq.com", "auth_ctx": {}}]
    result = pool.get_client("sp_0")
    assert result is mock_client


def test_get_client_raises_for_unknown_member():
    from sandbox_pool import SandboxPool
    pool = SandboxPool()
    try:
        pool.get_client("nonexistent")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass


def test_get_balances_returns_dict():
    from sandbox_pool import SandboxPool
    pool = SandboxPool()
    mock_client = _make_mock_client(account_id=200)
    pool._clients["sp_0"] = mock_client
    pool._members = [{"id": "sp_0", "name": "Alice", "color": "#5B6CF9",
                      "account_id": 200, "email_alias": "alice@bunq.com", "auth_ctx": {}}]
    balances = pool.get_balances()
    assert "sp_0" in balances
    assert balances["sp_0"] == "500.00"


def test_provision_creates_5_members(tmp_path):
    from sandbox_pool import SandboxPool, POOL_SLOTS
    pool = SandboxPool()

    call_count = [0]
    def make_client(*args, **kwargs):
        n = call_count[0]
        call_count[0] += 1
        return _make_mock_client(user_id=100 + n, account_id=200 + n, email=f"user{n}@sandbox.bunq.com")

    pool_file = str(tmp_path / "test_pool.json")

    with patch("sandbox_pool.POOL_FILE", pool_file), \
         patch("sandbox_pool.BunqClient") as MockBunqClient, \
         patch("sandbox_pool.time") as mock_time:
        MockBunqClient.create_sandbox_user.side_effect = [f"key_{i}" for i in range(5)]
        MockBunqClient.side_effect = make_client

        pool._provision()

    assert len(pool._members) == 5
    assert len(pool._clients) == 5
    names = [m["name"] for m in pool._members]
    assert names == ["Alice", "Bob", "Carlos", "Dana", "Eva"]
    for m in pool._members:
        assert "email_alias" in m
        assert "user_id" in m
        assert "account_id" in m
        assert "auth_ctx" in m
