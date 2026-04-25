#!/usr/bin/env python
"""
Approve pending payment requests — simulates friends paying their share.
Run this after using the split flow in the app, then refresh SentPage to see statuses update.

  cd backend
  python approve_requests.py          # interactive prompt
  python approve_requests.py --all    # approve all without prompting
"""

import sys
import os
import time
import argparse

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "hackathon_toolkit"))

from sandbox_pool import get_pool
from splits_store import list_splits, update_request_status


def _fmt_table(rows, headers):
    widths = [max(len(str(r[i])) for r in [headers] + rows) for i in range(len(headers))]
    sep = "+-" + "-+-".join("-" * w for w in widths) + "-+"
    def row_str(r):
        return "| " + " | ".join(str(r[i]).ljust(widths[i]) for i in range(len(r))) + " |"
    lines = [sep, row_str(headers), sep] + [row_str(r) for r in rows] + [sep]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Approve pending bunq payment requests")
    parser.add_argument("--all", action="store_true", help="Approve all pending without prompting")
    args = parser.parse_args()

    print("=" * 60)
    print("bunq Payment Approver")
    print("=" * 60)

    pool = get_pool()
    pool.load_or_provision()

    alice = pool.get_member("sp_0")
    alice_email = alice.get("email_alias")

    splits = list_splits()
    pending_pairs = [
        (s, r)
        for s in splits
        for r in s.get("requests", [])
        if r.get("status") == "pending"
    ]

    if not pending_pairs:
        print("\nNo pending payment requests found.")
        print("Complete a split in the app first, then re-run this script.")
        return

    print(f"\nFound {len(pending_pairs)} pending request(s):\n")
    preview_rows = [
        [r.get("from_name") or "?", f"€{r['amount']:.2f}", s["tx_description"][:35], s["id"]]
        for s, r in pending_pairs
    ]
    print(_fmt_table(preview_rows, ["Debtor", "Amount", "For", "Split ID"]))

    if not args.all:
        try:
            answer = input("\nApprove all pending? [Y/n] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nAborted.")
            return
        if answer and answer != "y":
            print("Aborted.")
            return

    print()
    results = []
    for s, r in pending_pairs:
        debtor_id = r.get("from_member_id")
        if not debtor_id:
            print(f"  ! No debtor recorded for '{r.get('to_name')}' — skipping (re-run the split flow to capture debtor info)")
            results.append([r.get("to_name", "?"), f"€{r['amount']:.2f}", s["tx_description"][:30], "! No debtor info"])
            continue
        debtor = pool.get_member(debtor_id)
        try:
            debtor_client = pool.get_client(debtor_id)
            debtor_uid = debtor_client.user_id
            debtor_aid = debtor["account_id"]

            debtor_client.post(
                f"user/{debtor_uid}/monetary-account/{debtor_aid}/payment",
                {
                    "amount": {"value": f"{r['amount']:.2f}", "currency": "EUR"},
                    "counterparty_alias": {
                        "type": "EMAIL",
                        "value": alice_email,
                        "name": "Alice",
                    },
                    "description": f"Payment for: {s['tx_description']}",
                },
            )
            update_request_status(s["id"], r.get("request_id"), "paid")
            debtor_name = r.get("from_name") or debtor_id
            results.append([debtor_name, f"€{r['amount']:.2f}", s["tx_description"][:30], "✓ Paid"])
            print(f"  ✓ {debtor_name} paid €{r['amount']:.2f} for '{s['tx_description'][:30]}'")
            time.sleep(0.4)
        except Exception as e:
            debtor_name = r.get("from_name") or debtor_id
            results.append([debtor_name, f"€{r['amount']:.2f}", s["tx_description"][:30], f"✗ {str(e)[:25]}"])
            print(f"  ✗ {debtor_name}: {e}")

    approved = sum(1 for row in results if "✓" in row[3])
    print(f"\n{approved}/{len(results)} requests approved.")
    print()
    print(_fmt_table(results, ["Debtor", "Amount", "For", "Status"]))
    print("\nRefresh the SentPage in the app to see updated payment statuses.")
    print("=" * 60)


if __name__ == "__main__":
    main()
