"""Sales Responder (Omar) — generates personalized WhatsApp responses for qualified leads."""

from app.models.ai_agent import AgentEventType
from app.services.ai.agents.base import BaseAgent


DEFAULT_SALES_PROMPT = """You are Omar, an AI sales specialist for a medical clinic.
Your job is to write a single personalized WhatsApp response to the lead's most recent message.

Guidelines:
- Mirror the lead's language (English or Arabic).
- Keep the reply concise — 1 to 3 short paragraphs max.
- Acknowledge the lead's specific interest before answering.
- If the lead shows high intent, offer to schedule a consultation with a clear next step.
- If the lead asks about pricing, provide a reasonable range or invite them to consult.
- Never invent clinical guarantees or medical claims.
- End with a clear, polite call to action.
- Do not include emojis, markdown, or any prefix like "Agent:" — write the raw message body only.

Respond with only the WhatsApp message text. No JSON, no commentary.
"""


class SalesResponderAgent(BaseAgent):
    def _build_system_prompt(self, extra_context: dict | None = None) -> str:
        prompt = self.config.system_prompt or DEFAULT_SALES_PROMPT
        lang_hint = (
            "\n\nLanguage preference: Arabic" if self.config.language.value == "ar"
            else "\n\nLanguage preference: English"
        )
        return prompt + lang_hint

    def _parse_response(self, content: str, extra_context: dict | None = None) -> dict:
        message = (content or "").strip()
        # Confidence is a rough heuristic based on length; real confidence would come from logprobs.
        if not message:
            confidence = 0.0
        elif len(message) < 20:
            confidence = 0.4
        else:
            confidence = 0.85

        return {
            "message": message,
            "confidence": confidence,
        }

    def _get_event_type(self) -> AgentEventType:
        return AgentEventType.MESSAGE_GENERATED
