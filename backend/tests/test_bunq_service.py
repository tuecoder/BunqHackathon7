import sys
import os
from unittest.mock import MagicMock, patch, call

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "hackathon_toolkit"))


def _make_mock_client(request_id=42, tab_id=99, share_url="https://bunq.me/alice/12.40/test"):
    mock = MagicMock()
    mock.user_id = 1001
    # post returns tab_id first call, request_id second call
    mock.post.side_effect = [
        [{"Id": {"id": tab_id}}],       # BunqMeTab creation
        [{"Id": {"id": request_id}}],   # RequestInquiry creation
    ]
    # get returns BunqMeTab details
    mock.get.return_value = [{"BunqMeTab": {"bunqme_tab_share_url": share_url}}]
    return mock


def test_create_payment_request_calls_bunqme_tab_and_request_inquiry():
    import bunq_service
    bunq_service._client = _make_mock_client()
    bunq_service._account_id = 9999

    bunq_service.create_payment_request(12.40, "Trip to Berlin", "sara@example.com")

    assert bunq_service._client.post.call_count == 2
    first_call = bunq_service._client.post.call_args_list[0]
    assert "bunqme-tab" in first_call[0][0]
    assert first_call[0][1]["bunqme_tab_entry"]["amount_inquired"]["value"] == "12.40"

    second_call = bunq_service._client.post.call_args_list[1]
    assert "request-inquiry" in second_call[0][0]
    assert second_call[0][1]["counterparty_alias"]["value"] == "sara@example.com"


def test_create_payment_request_returns_real_bunqme_url():
    import bunq_service
    share_url = "https://bunq.me/alice/5.00/Dinner-split"
    bunq_service._client = _make_mock_client(tab_id=77, share_url=share_url)
    bunq_service._account_id = 9999

    result = bunq_service.create_payment_request(5.00, "Dinner split", "alex@example.com")

    assert result["bunq_me_url"] == share_url
    assert "request_id" in result


def test_create_payment_request_raises_when_not_initialized():
    import bunq_service
    bunq_service._client = None
    bunq_service._account_id = None

    try:
        bunq_service.create_payment_request(10.00, "test", "x@x.com")
        assert False, "Should have raised"
    except RuntimeError as e:
        assert "not initialised" in str(e).lower() or "BUNQ_API_KEY" in str(e)
