"""Prompt builder — assembles system prompt + KB entries + conversation history."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.models.ai_agent import AIAgentConfig, KnowledgeBaseEntry
from app.models.whatsapp import WhatsAppMessage, WhatsAppConversation, MessageDirection

CONTEXT_WINDOW_SIZE = 20


async def build_prompt_messages(
    db: AsyncSession,
    *,
    agent_config: AIAgentConfig,
    system_prompt: str,
    conversation_id: uuid.UUID | None = None,
    extra_context: dict | None = None,
) -> list:
    """Assemble the full message list for an LLM call.

    Order:
    1. System prompt (agent type specific)
    2. Knowledge base context
    3. Manual context / memory / skills from config
    4. Lead qualification summary (if available)
    5. Conversation history (last N messages)
    6. Current user message (if provided in extra_context)
    """
    messages: list = []

    # 1. System prompt
    full_system = system_prompt

    # 2. Knowledge base entries
    kb_content = await _get_kb_content(db, agent_config)
    if kb_content:
        full_system += f"\n\n## Knowledge Base\n{kb_content}"

    # 3. Manual context, memory, skills from agent config
    if agent_config.manual_context:
        full_system += f"\n\n## Clinic Context\n{agent_config.manual_context}"
    if agent_config.memory_notes:
        full_system += f"\n\n## Memory\n{agent_config.memory_notes}"
    if agent_config.skill_instructions:
        full_system += f"\n\n## Skills\n{agent_config.skill_instructions}"

    # 4. Lead qualification summary
    if extra_context and extra_context.get("qualification_summary"):
        full_system += f"\n\n## Lead Info\n{extra_context['qualification_summary']}"

    messages.append(SystemMessage(content=full_system))

    # 5. Conversation history (sliding window of last N messages)
    if conversation_id:
        history = await _get_conversation_history(db, conversation_id)
        for msg in history:
            if msg.direction == MessageDirection.INBOUND:
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))

    # 6. Current message (if not already in history)
    if extra_context and extra_context.get("current_message"):
        messages.append(HumanMessage(content=extra_context["current_message"]))

    return messages


async def _get_kb_content(db: AsyncSession, agent_config: AIAgentConfig) -> str:
    """Load active knowledge base entries for this agent."""
    result = await db.execute(
        select(KnowledgeBaseEntry)
        .where(
            KnowledgeBaseEntry.clinic_id == agent_config.clinic_id,
            KnowledgeBaseEntry.is_active == True,  # noqa: E712
            (
                (KnowledgeBaseEntry.agent_config_id == agent_config.id)
                | (KnowledgeBaseEntry.agent_config_id.is_(None))
            ),
        )
        .order_by(KnowledgeBaseEntry.sort_order)
    )
    entries = result.scalars().all()
    if not entries:
        return ""

    parts = []
    for entry in entries:
        parts.append(f"### {entry.title}\n{entry.content}")
    return "\n\n".join(parts)


async def _get_conversation_history(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> list[WhatsAppMessage]:
    """Get the last N messages from a conversation."""
    result = await db.execute(
        select(WhatsAppMessage)
        .where(
            WhatsAppMessage.conversation_id == conversation_id,
            WhatsAppMessage.content != "",
        )
        .order_by(WhatsAppMessage.timestamp.desc())
        .limit(CONTEXT_WINDOW_SIZE)
    )
    messages = list(result.scalars().all())
    messages.reverse()  # Oldest first
    return messages
