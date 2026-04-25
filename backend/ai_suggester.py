import json
import os
import re

import anthropic

MINIMUM_SPLITS_FOR_SUGGESTIONS = 2


def suggest_item_assignments(bill_items: list, group_id: str, member_names: dict) -> dict:
    """
    Returns {item_name: {suggested_to, confidence, reasoning}} or {} if not enough history.
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

    member_ids = list(member_names.keys())
    bill_lines = "\n".join(
        f'{i + 1}. "{item["name"]}" €{item["price"]:.2f}'
        for i, item in enumerate(bill_items)
    )

    prompt = f"""You are helping pre-fill a restaurant bill split based on past ordering history.

Group members and their ordering history:
{chr(10).join(history_lines)}

New bill items:
{bill_lines}

Valid member IDs: {member_ids}

For each item, suggest who ordered it based on their preferences. Return ONLY valid JSON:
{{
  "suggestions": [
    {{
      "item_name": "exact item name from list above",
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
- Use exact member IDs from the valid list
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

    return {s["item_name"]: s for s in data.get("suggestions", [])}
