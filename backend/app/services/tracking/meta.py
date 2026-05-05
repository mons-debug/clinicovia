"""Meta Conversions API (CAPI) client.

Sends server-side conversion events to Meta (Facebook) via the
Marketing API's /events endpoint.

Credentials dict expects:
    - pixel_id: str
    - access_token: str
"""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

META_GRAPH_URL = "https://graph.facebook.com/v19.0"


async def send_meta_event(
    credentials: dict,
    event,
    user_data: dict,
) -> None:
    """Send a single conversion event to Meta CAPI.

    Args:
        credentials: Decrypted integration credentials with ``pixel_id``
            and ``access_token``.
        event: A ``ConversionEvent`` ORM instance.
        user_data: Pre-hashed user data dict (em, ph, fn, ln, etc.).

    Raises:
        httpx.HTTPStatusError: If Meta returns a non-2xx response.
    """
    pixel_id = credentials["pixel_id"]
    access_token = credentials["access_token"]

    url = f"{META_GRAPH_URL}/{pixel_id}/events"

    event_payload: dict = {
        "event_name": event.event_name,
        "event_time": int(event.created_at.timestamp()),
        "event_id": event.event_id,
        "action_source": "system_generated",
        "user_data": user_data,
    }

    if event.value is not None:
        event_payload["custom_data"] = {
            "value": float(event.value),
            "currency": event.currency or "MAD",
        }

    payload = {"data": [event_payload]}

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            url,
            params={"access_token": access_token},
            json=payload,
        )
        response.raise_for_status()

    logger.info(
        "Meta CAPI event sent: pixel=%s event=%s event_id=%s",
        pixel_id,
        event.event_name,
        event.event_id,
    )
