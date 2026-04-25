import json
import os
import re

import anthropic

SYSTEM_PROMPT = """You are extracting line items from a receipt photo. Return ONLY valid JSON with this exact structure:
{
  "merchant": string,
  "date": "YYYY-MM-DD or null",
  "total": number,
  "currency": "EUR",
  "items": [{ "id": "item_N", "name": string, "price": number, "quantity": number }]
}
If an item has no clear price, estimate from the total. Never return anything outside the JSON."""


def extract_bill(image_base64: str, image_type: str = "image/jpeg") -> dict:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image_type,
                            "data": image_base64,
                        },
                    },
                    {"type": "text", "text": "Extract all line items from this receipt."},
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        return {"error": f"Could not parse receipt: {e}", "items": []}

    # Ensure item IDs are assigned
    for i, item in enumerate(data.get("items", []), start=1):
        if "id" not in item or not item["id"]:
            item["id"] = f"item_{i}"

    return data
