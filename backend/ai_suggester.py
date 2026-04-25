import json
import os
import re

import anthropic

MINIMUM_SPLITS_FOR_SUGGESTIONS = 2


def suggest_item_assignments(bill_items: list, group_id: str, member_names: dict) -> dict:
    """
    Returns {item_id: {suggested_to, confidence, reasoning, item_name}} or {} if not enough history.
    member_names: {member_id: display_name}
    """
    from preference_store import get_group_preferences, get_split_count

    if get_split_count(group_id) < MINIMUM_SPLITS_FOR_SUGGESTIONS:
        return {}

    prefs = get_group_preferences(group_id)
    if not prefs:
        return {}

    history_lines = []
    for mid, items in prefs.items():
        name = member_names.get(mid, mid)
        counts: dict[str, int] = {}
        for item in items[-15:]:
            key = item["item_name"]
            counts[key] = counts.get(key, 0) + 1
        if counts:
            summary = ", ".join(
                f"{k} ({v}x)" for k, v in sorted(counts.items(), key=lambda x: -x[1])
            )
            history_lines.append(f"- {name} ({mid}): {summary}")

    if not history_lines:
        return {}

    # Use member IDs from pool if available, else fall back to IDs in preference history
    member_ids = list(member_names.keys()) or list(prefs.keys())
    bill_lines = "\n".join(
        f'{i + 1}. [{item.get("id", f"item_{i+1}")}] "{item["name"]}" €{item["price"]:.2f}'
        for i, item in enumerate(bill_items)
    )

    prompt = f"""You are helping pre-fill a restaurant bill split based on past ordering history.

Group members and their ordering history:
{chr(10).join(history_lines)}

New bill items (format: [item_id] "name" price):
{bill_lines}

Valid member IDs: {member_ids}

For each item, suggest who ordered it. Return ONLY valid JSON:
{{
  "suggestions": [
    {{
      "item_id": "item_id from the list above",
      "item_name": "exact item name",
      "suggested_to": ["member_id"],
      "confidence": "high" | "medium" | "low",
      "reasoning": "one short sentence"
    }}
  ]
}}

Rules:
- Only include items where you have a reasonable guess
- Items can be shared (multiple member_ids in suggested_to)
- "high" = strong recurring pattern, "medium" = partial match or similar category, "low" = weak signal
- Use exact member IDs from the valid list above
- Omit items you genuinely cannot match
"""

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = resp.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    # Key by item_id (stable); fall back to fuzzy name match if item_id missing
    name_to_id = {item["name"].strip().lower(): item.get("id") for item in bill_items}
    result = {}
    for s in data.get("suggestions", []):
        item_id = s.get("item_id")
        if not item_id:
            # fuzzy fallback: find closest original item name
            claude_name = s.get("item_name", "").strip().lower()
            item_id = name_to_id.get(claude_name)
            if not item_id:
                # partial match
                for orig_name, oid in name_to_id.items():
                    if claude_name in orig_name or orig_name in claude_name:
                        item_id = oid
                        break
        if item_id:
            result[item_id] = s
    return result
