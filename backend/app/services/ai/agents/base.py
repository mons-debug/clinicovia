"""Base agent class — shared logic for all AI agent types."""

import uuid
from datetime import datetime, timezone
from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_agent import (
    AIAgentConfig, AgentEventLog, AgentEventType,
)
from app.services.ai.provider import get_chat_model, get_provider_api_key
from app.services.ai.chains.prompt_builder import build_prompt_messages


class BaseAgent(ABC):
    """Abstract base for all AI agents.

    Subclasses implement `_build_system_prompt` and `_parse_response`.
    The base class handles: model creation, context assembly, invocation, logging.
    """

    def __init__(self, agent_config: AIAgentConfig):
        self.config = agent_config

    async def run(
        self,
        db: AsyncSession,
        *,
        conversation_id: uuid.UUID | None = None,
        patient_id: uuid.UUID | None = None,
        workflow_id: uuid.UUID | None = None,
        task_id: uuid.UUID | None = None,
        extra_context: dict | None = None,
    ) -> dict:
        """Execute the agent: build prompt, call LLM, parse, log, return result."""

        # Get API key (per-clinic or env)
        api_key = await get_provider_api_key(
            db, self.config.clinic_id, self.config.ai_provider.value
        )

        # Create the LLM
        llm = get_chat_model(
            provider=self.config.ai_provider.value,
            model=self.config.ai_model,
            api_key=api_key,
        )

        # Build the prompt messages
        system_prompt = self._build_system_prompt(extra_context)
        messages = await build_prompt_messages(
            db,
            agent_config=self.config,
            system_prompt=system_prompt,
            conversation_id=conversation_id,
            extra_context=extra_context,
        )

        # Invoke the model
        response = await llm.ainvoke(messages)

        # Extract token usage
        token_input = 0
        token_output = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            token_input = response.usage_metadata.get("input_tokens", 0)
            token_output = response.usage_metadata.get("output_tokens", 0)

        # Parse the response
        result = self._parse_response(response.content, extra_context)
        result["raw_response"] = response.content
        result["token_count_input"] = token_input
        result["token_count_output"] = token_output
        result["ai_provider"] = self.config.ai_provider.value
        result["ai_model"] = self.config.ai_model

        # Log the event
        await self._log_event(
            db,
            event_type=self._get_event_type(),
            event_data=result,
            patient_id=patient_id,
            workflow_id=workflow_id,
            task_id=task_id,
            token_input=token_input,
            token_output=token_output,
            confidence=result.get("confidence"),
        )

        return result

    @abstractmethod
    def _build_system_prompt(self, extra_context: dict | None = None) -> str:
        """Build the system prompt for this agent type."""

    @abstractmethod
    def _parse_response(self, content: str, extra_context: dict | None = None) -> dict:
        """Parse the LLM response into a structured result dict."""

    @abstractmethod
    def _get_event_type(self) -> AgentEventType:
        """Return the event type for logging."""

    async def _log_event(
        self,
        db: AsyncSession,
        event_type: AgentEventType,
        event_data: dict,
        patient_id: uuid.UUID | None = None,
        workflow_id: uuid.UUID | None = None,
        task_id: uuid.UUID | None = None,
        token_input: int = 0,
        token_output: int = 0,
        confidence: float | None = None,
    ) -> AgentEventLog:
        log = AgentEventLog(
            clinic_id=self.config.clinic_id,
            workflow_id=workflow_id,
            task_id=task_id,
            agent_config_id=self.config.id,
            patient_id=patient_id,
            event_type=event_type,
            event_data=event_data,
            ai_provider=self.config.ai_provider.value,
            ai_model=self.config.ai_model,
            token_count_input=token_input,
            token_count_output=token_output,
            confidence_score=confidence,
        )
        db.add(log)
        await db.flush()
        return log
