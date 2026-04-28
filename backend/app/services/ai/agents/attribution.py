"""Conversion attribution agent (Zain)."""

import json
import re

from app.models.ai_agent import AgentEventType
from app.services.ai.agents.base import BaseAgent


DEFAULT_ATTRIBUTION_PROMPT = """You are Zain, an AI attribution analyst for a clinic.
Your job is to inspect available lead, deal, and tracking context and return a
structured attribution assessment.

Return one JSON object with these keys:
- source: short slug for the likely source, such as "meta_ads", "google_ads",
  "organic_whatsapp", "referral", or "unknown"
- confidence: float 0.0-1.0
- reasoning: one concise sentence

Do not invent campaign IDs or unsupported tracking data.
"""


class AttributionAgent(BaseAgent):
    def _build_system_prompt(self, extra_context: dict | None = None) -> str:
        return self.config.system_prompt or DEFAULT_ATTRIBUTION_PROMPT

    def _parse_response(self, content: str, extra_context: dict | None = None) -> dict:
        payload = _extract_json(content) or {}
        return {
            "source": str(payload.get("source", "unknown"))[:80],
            "confidence": float(payload.get("confidence", 0.0) or 0.0),
            "reasoning": str(payload.get("reasoning", ""))[:500],
        }

    def _get_event_type(self) -> AgentEventType:
        return AgentEventType.ATTRIBUTION_LINKED


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
