"""GA4 Measurement Protocol client.

Sends server-side events to Google Analytics 4 via the Measurement
Protocol.

Credentials dict expects:
    - measurement_id: str  (e.g. "G-XXXXXXXXXX")
    - api_secret: str
"""

from __future__ import annotations

import hashlib
import logging

import httpx

logger = logging.getLogger(__name__)

GA4_COLLECT_URL = "https://www.google-analytics.com/mp/collect"

# Map Clinicfy event names to GA4 recommended event names.
_EVENT_NAME_MAP: dict[str, str] = {
    "Lead": "generate_lead",
    "Contact": "generate_lead",
    "QualifiedLead": "generate_lead",
    "Schedule": "begin_checkout",
    "ViewContent": "view_item",
    "InitiateCheckout": "begin_checkout",
    "AddToCart": "add_to_cart",
    "Purchase": "purchase",
    "CompleteRegistration": "sign_up",
}


def _deterministic_client_id(event) -> str:
    """Derive a stable GA4 client_id from the patient or event id.

    GA4 requires a ``client_id`` to group events.  We hash the
    patient_id when available; otherwise fall back to the event_id.
    """
    seed = str(event.patient_id) if event.patient_id else event.event_id
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:36]


async def send_ga4_event(
    credentials: dict,
    event,
    user_data: dict,
) -> None:
    """Send a single conversion event to GA4 via the Measurement Protocol.

    Args:
        credentials: Decrypted integration credentials with
            ``measurement_id`` and ``api_secret``.
        event: A ``ConversionEvent`` ORM instance.
        user_data: Pre-hashed user data dict (currently unused by GA4 MP
            but accepted for interface consistency).

    Raises:
        httpx.HTTPStatusError: If GA4 returns a non-2xx response.
    """
    measurement_id = credentials["measurement_id"]
    api_secret = credentials["api_secret"]

    ga4_event_name = _EVENT_NAME_MAP.get(event.event_name, event.event_name)

    params: dict = {}
    if event.value is not None:
        params["value"] = float(event.value)
        params["currency"] = event.currency or "MAD"

    payload = {
        "client_id": _deterministic_client_id(event),
        "events": [
            {
                "name": ga4_event_name,
                "params": params,
            }
        ],
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            GA4_COLLECT_URL,
            params={
                "measurement_id": measurement_id,
                "api_secret": api_secret,
            },
            json=payload,
        )
        response.raise_for_status()

    logger.info(
        "GA4 event sent: measurement_id=%s event=%s (ga4: %s) event_id=%s",
        measurement_id,
        event.event_name,
        ga4_event_name,
        event.event_id,
    )
