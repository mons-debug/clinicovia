"""Leader / Router (Rafiq) — classifies inbound messages and routes to specialists."""

import json
import re

from app.models.ai_agent import AgentEventType
from app.services.ai.agents.base import BaseAgent


DEFAULT_LEADER_PROMPT = """You are Rafiq, the lead AI coordinator for a medical clinic.
Your ONLY job is to read the latest inbound patient message and decide which specialist
should handle it. You do NOT reply to the patient yourself.

Available specialists:
- "omar": WhatsApp sales. Pricing questions, service inquiries, general conversation,
  objections, building rapport, answering clinical curiosity, closing sales.
- "sara": Appointment optimization. Booking, rescheduling, cancelling, confirming
  appointments, asking about available slots.
- "noor": Follow-up / reactivation. Re-engaging a lead who has gone quiet, post-visit
  check-ins, reviving stale deals.
- "layla": Lead qualification. First-touch scoring of a brand-new lead with no history.

Special routes:
- "human": Escalate immediately. Complaints, medical emergencies, threats, clinical
  questions needing a doctor, anything requiring human judgment.
- "none": Do nothing only for spam or truly off-topic chatter.

Short acknowledgements such as "thanks", "شكرا", "ok", or "تمام" should still
be routed to "omar" so the patient receives a brief polite reply.

Return a single JSON object (no markdown, no commentary) with exactly these keys:
- route_to: one of "omar", "sara", "noor", "layla", "human", "none"
- intent: short slug describing the message intent (e.g. "pricing_question",
  "book_appointment", "complaint", "greeting", "spam")
- confidence: float 0.0-1.0 — your confidence in the routing decision
- reasoning: one short sentence explaining why you chose this route

Be deterministic. If the message is ambiguous but looks sales-adjacent, prefer "omar".
If confidence is below 0.5, prefer "human" for safety.
"""


ALLOWED_ROUTES = {"omar", "sara", "noor", "layla", "human", "none"}


class LeaderAgent(BaseAgent):
    def _build_system_prompt(self, extra_context: dict | None = None) -> str:
        return self.config.system_prompt or DEFAULT_LEADER_PROMPT

    def _parse_response(self, content: str, extra_context: dict | None = None) -> dict:
        payload = _extract_json(content) or {}
        route_to = str(payload.get("route_to", "human")).strip().lower()
        if route_to not in ALLOWED_ROUTES:
            # Fail safe: unknown → human
            route_to = "human"

        confidence = float(payload.get("confidence", 0.0) or 0.0)
        # If confidence below threshold from agent config, escalate to human.
        threshold = (self.config.confidence_threshold or 70) / 100.0
        if route_to != "none" and confidence < threshold and route_to != "human":
            route_to = "human"

        return {
            "route_to": route_to,
            "intent": str(payload.get("intent", "unknown"))[:80],
            "confidence": confidence,
            "reasoning": str(payload.get("reasoning", ""))[:500],
        }

    def _get_event_type(self) -> AgentEventType:
        return AgentEventType.MESSAGE_ROUTED


def _extract_json(text: str) -> dict | None:
    if not text:
        return None
    stripped = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", stripped)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None
