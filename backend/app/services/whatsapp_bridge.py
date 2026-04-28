import httpx

from app.config import settings


class WhatsAppBridgeClient:
    """HTTP client for communicating with the WhatsApp bridge service."""

    def __init__(self):
        self.base_url = settings.whatsapp_bridge_url
        self.headers = {"X-Bridge-Secret": settings.whatsapp_bridge_secret}

    async def start_session(self, session_id: str, clinic_id: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/sessions",
                json={"sessionId": session_id, "clinicId": clinic_id},
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def stop_session(self, session_id: str) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                f"{self.base_url}/sessions/{session_id}",
                headers=self.headers,
            )
            resp.raise_for_status()

    async def get_session_status(self, session_id: str) -> dict | None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.base_url}/sessions/{session_id}",
                headers=self.headers,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()

    async def send_message(self, session_id: str, jid: str, text: str, quoted_message_id: str | None = None) -> dict:
        payload: dict = {"jid": jid, "text": text}
        if quoted_message_id:
            payload["quotedMessageId"] = quoted_message_id
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.base_url}/sessions/{session_id}/send",
                json=payload,
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()


    async def check_whatsapp(self, session_id: str, phone: str) -> dict:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.base_url}/sessions/{session_id}/check-whatsapp",
                json={"phone": phone},
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()


bridge_client = WhatsAppBridgeClient()
