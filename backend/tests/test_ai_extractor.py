import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ai_extractor import extract_bill

FAKE_RESPONSE = {
    "merchant": "Albert Heijn",
    "date": "2026-04-24",
    "total": 34.80,
    "currency": "EUR",
    "items": [
        {"id": "item_1", "name": "Heineken 6-pack", "price": 7.49, "quantity": 1},
        {"id": "item_2", "name": "Pasta Bolognese", "price": 4.99, "quantity": 2},
    ],
}


def _mock_anthropic(response_text: str):
    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(text=response_text)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_msg
    return mock_client


ENV = {"ANTHROPIC_API_KEY": "test-key"}


def test_extract_bill_parses_valid_json():
    with patch.dict(os.environ, ENV), \
         patch("anthropic.Anthropic", return_value=_mock_anthropic(json.dumps(FAKE_RESPONSE))):
        result = extract_bill("dGVzdA==", "image/jpeg")

    assert result["merchant"] == "Albert Heijn"
    assert result["total"] == 34.80
    assert len(result["items"]) == 2
    assert result["items"][0]["id"] == "item_1"


def test_extract_bill_strips_markdown_fences():
    fenced = f"```json\n{json.dumps(FAKE_RESPONSE)}\n```"
    with patch.dict(os.environ, ENV), \
         patch("anthropic.Anthropic", return_value=_mock_anthropic(fenced)):
        result = extract_bill("dGVzdA==", "image/jpeg")

    assert result["merchant"] == "Albert Heijn"


def test_extract_bill_returns_error_on_invalid_json():
    with patch.dict(os.environ, ENV), \
         patch("anthropic.Anthropic", return_value=_mock_anthropic("not json at all")):
        result = extract_bill("dGVzdA==", "image/jpeg")

    assert "error" in result
    assert result["items"] == []


def test_extract_bill_assigns_missing_ids():
    data = {**FAKE_RESPONSE, "items": [{"name": "Beer", "price": 2.50, "quantity": 1}]}
    with patch.dict(os.environ, ENV), \
         patch("anthropic.Anthropic", return_value=_mock_anthropic(json.dumps(data))):
        result = extract_bill("dGVzdA==", "image/jpeg")

    assert result["items"][0]["id"] == "item_1"
