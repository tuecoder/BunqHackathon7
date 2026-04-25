#!/usr/bin/env python
"""
Sandbox setup script — run ONCE before the demo.

  cd backend
  python setup_sandbox.py

Actions:
  1. Provision 5 bunq sandbox users (Alice, Bob, Carlos, Dana, Eva) — or load existing
  2. Fund each with €500 from sugardaddy@bunq.com (done automatically in provision)
  3. Create 5 real outgoing payments FROM Alice to simulate a transaction history
  4. Seed groups.json with "Roommates" and "Berlin Trip"
  5. Print a summary table
"""

import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "hackathon_toolkit"))

from sandbox_pool import get_pool
from groups_store import _save as save_groups, _load as load_groups


DEMO_PAYMENTS = [
    {"description": "Albert Heijn groceries",      "amount": "62.40", "to": "sp_1"},
    {"description": "Dinner at Restaurant Lastage", "amount": "45.00", "to": "sp_2"},
    {"description": "Airbnb Berlin accommodation",  "amount": "180.00","to": "sp_3"},
    {"description": "Uber taxi to airport",         "amount": "12.50", "to": "sp_4"},
    {"description": "Movie tickets",                "amount": "18.00", "to": "sp_1"},
]

DEFAULT_GROUPS = [
    {"id": "g_0", "name": "Roommates",   "memberIds": ["sp_0","sp_1","sp_2"], "color": "#5B6CF9", "emoji": "🏠"},
    {"id": "g_1", "name": "Berlin Trip", "memberIds": ["sp_0","sp_3","sp_4"], "color": "#E85D24", "emoji": "✈️"},
]


def _fmt_table(rows, headers):
    widths = [max(len(str(r[i])) for r in [headers] + rows) for i in range(len(headers))]
    sep = "+-" + "-+-".join("-" * w for w in widths) + "-+"
    def row_str(r):
        return "| " + " | ".join(str(r[i]).ljust(widths[i]) for i in range(len(r))) + " |"
    lines = [sep, row_str(headers), sep] + [row_str(r) for r in rows] + [sep]
    return "\n".join(lines)


def main():
    print("=" * 60)
    print("bunq Sandbox Setup")
    print("=" * 60)

    # ── Step 1: Provision / load users ────────────────────────────
    print("\n[1/3] Provisioning sandbox users...")
    pool = get_pool()
    members = pool.load_or_provision()
    print(f"  ✓ {len(members)} users ready")

    # ── Step 2: Create demo payments from Alice ───────────────────
    print("\n[2/3] Creating demo transactions from Alice...")
    try:
        alice = pool.get_member("sp_0")
        alice_client = pool.get_client("sp_0")
        alice_uid = alice_client.user_id
        alice_aid = alice["account_id"]

        payment_results = []
        for p in DEMO_PAYMENTS:
            target = pool.get_member(p["to"])
            target_email = target.get("email_alias")
            target_name = target["name"]
            try:
                resp = alice_client.post(
                    f"user/{alice_uid}/monetary-account/{alice_aid}/payment",
                    {
                        "amount": {"value": p["amount"], "currency": "EUR"},
                        "counterparty_alias": {
                            "type": "EMAIL",
                            "value": target_email,
                            "name": target_name,
                        },
                        "description": p["description"],
                    },
                )
                payment_id = resp[0]["Id"]["id"] if resp else "?"
                payment_results.append([p["description"][:35], f"€{p['amount']}", target_name, str(payment_id), "✓"])
                print(f"  ✓ {p['description'][:35]} → {target_name} (€{p['amount']})")
                time.sleep(0.5)
            except Exception as e:
                payment_results.append([p["description"][:35], f"€{p['amount']}", target_name, "—", f"✗ {e}"])
                print(f"  ✗ {p['description'][:35]}: {e}")

        if payment_results:
            print()
            print(_fmt_table(payment_results, ["Description", "Amount", "To", "ID", "Status"]))
    except KeyError as e:
        print(f"  ! Alice not in pool ({e}) — skipping demo transactions")

    # ── Step 3: Seed groups ────────────────────────────────────────
    print("\n[3/3] Seeding groups...")
    existing = load_groups()
    existing_ids = {g["id"] for g in existing}
    new_groups = existing[:]
    for g in DEFAULT_GROUPS:
        if g["id"] not in existing_ids:
            new_groups.append(g)
            print(f"  ✓ Created group: {g['emoji']} {g['name']}")
        else:
            print(f"  · Group already exists: {g['emoji']} {g['name']}")
    save_groups(new_groups)

    # ── Summary ────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Setup complete! Member summary:")
    print()
    balances = pool.get_balances()
    rows = []
    for m_safe in pool.list_members():
        m = pool.get_member(m_safe["id"])
        rows.append([
            m["name"],
            m.get("email_alias", "—"),
            f"€{balances.get(m['id'], '?')}",
        ])
    print(_fmt_table(rows, ["Name", "Email alias", "Balance"]))
    print()
    print("Start the backend:  uvicorn main:app --reload")
    print("Start the frontend: cd ../frontend && npm run dev")
    print("=" * 60)


if __name__ == "__main__":
    main()
