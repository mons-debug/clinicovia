"""Appointment optimization agent (Sara)."""

from app.models.ai_agent import AgentEventType
from app.services.ai.agents.base import BaseAgent


DEFAULT_APPOINTMENT_PROMPT = """You are Sara, an AI appointment coordinator for a medical clinic.
Your job is to write one concise WhatsApp message about appointments.

Handle appointment booking, confirmation, cancellation, rescheduling, reminders,
and no-show recovery. If exact availability is not provided, ask for the patient's
preferred day/time or offer to have the team confirm available slots.

Guidelines:
- Mirror the lead's language.
- Be direct, helpful, and operational.
- Never confirm a specific slot unless it is explicitly present in context.
- Return only the WhatsApp message body. No JSON, no markdown.
"""


class AppointmentOptimizerAgent(BaseAgent):
    def _build_system_prompt(self, extra_context: dict | None = None) -> str:
        return self.config.system_prompt or DEFAULT_APPOINTMENT_PROMPT

    def _parse_response(self, content: str, extra_context: dict | None = None) -> dict:
        message = (content or "").strip()
        mode = (extra_context or {}).get("mode", "appointment")
        return {
            "message": message,
            "mode": mode,
            "confidence": 0.85 if len(message) >= 20 else 0.4 if message else 0.0,
        }

    def _get_event_type(self) -> AgentEventType:
        return AgentEventType.APPOINTMENT_RESCHEDULED
