"""Follow-up / Reactivation agent (Noor)."""

from app.models.ai_agent import AgentEventType
from app.services.ai.agents.base import BaseAgent


DEFAULT_FOLLOW_UP_PROMPT = """You are Noor, an AI follow-up specialist for a medical clinic.
Your job is to write one concise WhatsApp message that re-engages a lead or
continues a quiet conversation.

Guidelines:
- Mirror the lead's language.
- Be warm, brief, and specific to the previous context.
- Do not pressure the patient.
- Offer one clear next step, usually booking, answering a question, or confirming interest.
- Never invent clinical guarantees, pricing, or medical claims.
- Return only the WhatsApp message body. No JSON, no markdown.
"""


class FollowUpAgent(BaseAgent):
    def _build_system_prompt(self, extra_context: dict | None = None) -> str:
        return self.config.system_prompt or DEFAULT_FOLLOW_UP_PROMPT

    def _parse_response(self, content: str, extra_context: dict | None = None) -> dict:
        message = (content or "").strip()
        return {
            "message": message,
            "confidence": 0.85 if len(message) >= 20 else 0.4 if message else 0.0,
        }

    def _get_event_type(self) -> AgentEventType:
        return AgentEventType.FOLLOWUP_SENT
