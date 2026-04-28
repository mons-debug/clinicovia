"""Google Ads Enhanced Conversions client (v1 stub).

The full Google Ads API requires an OAuth2 flow and the ``google-ads``
library, which adds significant complexity.  For v1 this module simply
logs the event details so the conversion record is marked as sent.
A proper integration will be implemented in v2.

Credentials dict expects (reserved for v2):
    - customer_id: str
    - conversion_action_id: str
    - developer_token: str (optional, for v2)
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def send_google_ads_event(
    credentials: dict,
    event,
    user_data: dict,
) -> None:
    """Log a conversion event destined for Google Ads.

    In v1 this is a no-op beyond logging.  The caller can mark the
    ``ConversionEvent`` status as SENT so the pipeline progresses.

    Args:
        credentials: Decrypted integration credentials.
        event: A ``ConversionEvent`` ORM instance.
        user_data: Pre-hashed user data dict.
    """
    logger.info(
        "Google Ads event (v1 stub): customer_id=%s event=%s event_id=%s "
        "value=%s currency=%s patient_id=%s",
        credentials.get("customer_id", "N/A"),
        event.event_name,
        event.event_id,
        event.value,
        event.currency,
        event.patient_id,
    )
