"""Knowledge base retriever — loads KB entries for prompt inclusion."""

import uuid

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_agent import KnowledgeBaseEntry, KBEntryType, AgentLanguage


async def get_entries_for_agent(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    agent_config_id: uuid.UUID | None = None,
    entry_type: KBEntryType | None = None,
    service_type: str | None = None,
    language: AgentLanguage | None = None,
) -> list[KnowledgeBaseEntry]:
    """Retrieve active knowledge base entries matching the given filters."""
    conditions = [
        KnowledgeBaseEntry.clinic_id == clinic_id,
        KnowledgeBaseEntry.is_active == True,  # noqa: E712
    ]

    if agent_config_id:
        conditions.append(
            (KnowledgeBaseEntry.agent_config_id == agent_config_id)
            | (KnowledgeBaseEntry.agent_config_id.is_(None))
        )

    if entry_type:
        conditions.append(KnowledgeBaseEntry.entry_type == entry_type)

    if service_type:
        conditions.append(
            (KnowledgeBaseEntry.service_type == service_type)
            | (KnowledgeBaseEntry.service_type.is_(None))
        )

    if language:
        conditions.append(KnowledgeBaseEntry.language == language)

    result = await db.execute(
        select(KnowledgeBaseEntry)
        .where(and_(*conditions))
        .order_by(KnowledgeBaseEntry.sort_order)
    )
    return list(result.scalars().all())
