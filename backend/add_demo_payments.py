#!/usr/bin/env python
"""
Add 3 demo payments from Alice each time this script is run.
Cycles through 12 templates so repeated runs produce varied history.

  cd backend
  python add_demo_payments.py
"""

import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "hackathon_toolkit"))

from sandbox_pool import get_pool

DEMO_STATE_FILE = os.path.join(os.path.dirname(__file__), "demo_state.json")

TEMPLATES = [
    {"description": "Albert Heijn groceries",   "amount": "54.20", "to": "sp_1"},
    {"description": "Dinner Café de Jaren",      "amount": "38.50", "to": "sp_2"},
    {"description": "Spotify subscription",      "amount": "9.99",  "to": "sp_3"},
    {"description": "Uber Eats delivery",        "amount": "22.75", "to": "sp_4"},
    {"description": "Jumbo supermarket",         "amount": "31.60", "to": "sp_1"},
    {"description": "NS train tickets",          "amount": "19.40", "to": "sp_2"},
    {"description": "Pizza Quattro Stagioni",    "amount": "47.00", "to": "sp_3"},
    {"description": "Cinema Pathé",              "amount": "26.00", "to": "sp_4"},
    {"description": "Coolblue headphones",       "amount": "89.00", "to": "sp_1"},
    {"description": "Bowling night",             "amount": "14.50", "to": "sp_2"},
    {"description": "Takeaway Thai kitchen",     "amount": "33.00", "to": "sp_3"},
    {"description": "Museum admission",          "amount": "17.50", "to": "sp_4"},
]

BATCH = 3


def _load_offset() -> int:
    if os.path.exists(DEMO_STATE_FILE):
        try:
            return json.loads(open(DEMO_STATE_FILE).read()).get("offset", 0)
        except Exception:
            pass
    return 0


def _save_offset(offset: int) -> None:
    with open(DEMO_STATE_FILE, "w") as f:
        json.dump({"offset": offset}, f)


def _fmt_table(rows, headers):
    widths = [max(len(str(r[i])) for r in [headers] + rows) for i in range(len(headers))]
    sep = "+-" + "-+-".join("-" * w for w in widths) + "-+"
    def row_str(r):
        return "| " + " | ".join(str(r[i]).ljust(widths[i]) for i in range(len(r))) + " |"
    lines = [sep, row_str(headers), sep] + [row_str(r) for r in rows] + [sep]
    return "\n".join(lines)


def main():
    print("=" * 55)
    print("bunq Demo Payments — adding next 3 transactions")
    print("=" * 55)

    pool = get_pool()
    pool.load_or_provision()

    alice = pool.get_member("sp_0")
    alice_client = pool.get_client("sp_0")
    alice_uid = alice_client.user_id
    alice_aid = alice["account_id"]

    offset = _load_offset()
    batch = [TEMPLATES[(offset + i) % len(TEMPLATES)] for i in range(BATCH)]
    new_offset = (offset + BATCH) % len(TEMPLATES)

    print(f"\nCreating payments {offset + 1}–{offset + BATCH} (cycling pool of {len(TEMPLATES)})...\n")

    results = []
    for p in batch:
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
            results.append([p["description"][:32], f"€{p['amount']}", target_name, str(payment_id), "✓"])
            print(f"  ✓ {p['description'][:32]} → {target_name} (€{p['amount']})")
            time.sleep(0.5)
        except Exception as e:
            results.append([p["description"][:32], f"€{p['amount']}", target_name, "—", f"✗ {str(e)[:30]}"])
            print(f"  ✗ {p['description'][:32]}: {e}")

    _save_offset(new_offset)

    print()
    print(_fmt_table(results, ["Description", "Amount", "To", "ID", "Status"]))
    print(f"\nOffset saved: next run starts at template #{new_offset + 1}")
    print("Refresh the app to see new transactions.")
    print("=" * 55)


if __name__ == "__main__":
    main()
