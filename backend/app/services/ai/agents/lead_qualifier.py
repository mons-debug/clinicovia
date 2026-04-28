"""Lead Qualifier (Layla) — scores inbound leads and classifies intent/service/urgency."""

import json
import re

from app.models.ai_agent import AgentEventType
from app.services.ai.agents.base import BaseAgent


DEFAULT_QUALIFIER_PROMPT = """You are Layla, an AI reception agent for a medical clinic.
Your job is to analyze the latest inbound lead message and return a structured qualification.

Return a single JSON object (no markdown, no commentary) with exactly these keys:
- score: integer 0-100 indicating how qualified this lead is (higher = more ready to book)
- intent: one of "high_intent", "medium_intent", "low_intent", "informational", "spam"
- service: a short slug for the detected service of interest (e.g. "hair_transplant", "dental", "dermatology", "cosmetic_surgery", "unknown")
- urgency: one of "high", "medium", "low"
- confidence: float 0.0-1.0, your confidence in this qualification
- reasoning: one short sentence explaining the score

Be concise and deterministic. If the lead is very brief or ambiguous, prefer lower scores and lower confidence.
"""


class LeadQualifierAgent(BaseAgent):
    def _build_system_prompt(self, extra_context: dict | None = None) -> str:
        return self.config.system_prompt or DEFAULT_QUALIFIER_PROMPT

    def _parse_response(self, content: str, extra_context: dict | None = None) -> dict:
        payload = _extract_json(content)
        if not payload:
            return {
                "score": 0,
                "intent": "informational",
                "service": "unknown",
                "urgency": "low",
                "confidence": 0.0,
                "reasoning": "Failed to parse qualifier response",
            }

        return {
            "score": int(payload.get("score", 0) or 0),
            "intent": str(payload.get("intent", "informational")),
            "service": str(payload.get("service", "unknown")),
            "urgency": str(payload.get("urgency", "low")),
            "confidence": float(payload.get("confidence", 0.0) or 0.0),
            "reasoning": str(payload.get("reasoning", ""))[:500],
        }

    def _get_event_type(self) -> AgentEventType:
        return AgentEventType.LEAD_SCORED


def _extract_json(text: str) -> dict | None:
    """Best-effort JSON extraction from an LLM response.

    Handles: bare JSON, JSON wrapped in ```json fences, or JSON with leading prose.
    """
    if not text:
        return None

    # Strip markdown code fences
    stripped = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Try to find the first {...} block
    match = re.search(r"\{[\s\S]*\}", stripped)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None
