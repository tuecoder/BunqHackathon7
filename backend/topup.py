#!/usr/bin/env python
"""
Add €500 to Alice's sandbox account by requesting funds from sugardaddy@bunq.com.
Run as many times as needed.

  cd backend
  python topup.py
"""

import sys
import os
import time

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "hackathon_toolkit"))

from sandbox_pool import get_pool


def main():
    pool = get_pool()
    pool.load_or_provision()

    alice = pool.get_member("sp_0")
    alice_client = pool.get_client("sp_0")
    alice_uid = alice_client.user_id
    alice_aid = alice["account_id"]

    print("Requesting €500 from sugardaddy@bunq.com for Alice...")
    alice_client.post(
        f"user/{alice_uid}/monetary-account/{alice_aid}/request-inquiry",
        {
            "amount_inquired": {"value": "500.00", "currency": "EUR"},
            "counterparty_alias": {
                "type": "EMAIL",
                "value": "sugardaddy@bunq.com",
                "name": "Sugar Daddy",
            },
            "description": "Top-up",
            "allow_bunqme": False,
        },
    )
    time.sleep(1)

    balance = pool.get_balances().get("sp_0", "?")
    print(f"✓ Done. Alice's balance: €{balance}")


if __name__ == "__main__":
    main()
