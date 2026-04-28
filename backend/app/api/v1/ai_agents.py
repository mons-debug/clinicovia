"""AI Agents API — configuration, testing, provider credentials, dashboard,
knowledge base, and conversation control.
"""

import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.ai_agent import (
    AIAgentConfig,
    AIProvider,
    AIProviderCredential,
    AgentEventLog,
    AgentEventType,
    AgentLanguage,
    AgentTask,
    AgentTaskType,
    FunctionalType,
    KBEntryType,
    KnowledgeBaseEntry,
    OrchestrationWorkflow,
    TaskStatus,
    WorkflowStatus,
)
from app.models.patient import Patient
from app.models.whatsapp import (
    ConversationHandler,
    WhatsAppConversation,
)
from app.utils.encryption import decrypt_credentials, encrypt_credentials

router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


# ── Pydantic schemas ──────────────────────────────────────────────

class AgentStats(BaseModel):
    conversations_today: int = 0
    messages_sent_today: int = 0
    avg_response_time_ms: int = 0
    success_rate: float = 0.0


class AgentListItem(BaseModel):
    id: uuid.UUID
    persona_id: str
    functional_type: str
    display_name: str
    role_description: str
    ai_provider: str
    ai_model: str
    is_active: bool
    language: str
    tone: str
    confidence_threshold: int
    max_followup_attempts: int
    followup_delay_minutes: int
    reactivation_delay_hours: int
    rate_limit_messages: int
    stats: AgentStats


class AgentListResponse(BaseModel):
    agents: list[AgentListItem]


class AgentDetailResponse(BaseModel):
    id: uuid.UUID
    persona_id: str
    functional_type: str
    display_name: str
    role_description: str
    ai_provider: str
    ai_model: str
    is_active: bool
    language: str
    tone: str
    system_prompt: str | None = None
    manual_context: str | None = None
    memory_notes: str | None = None
    skill_instructions: str | None = None
    confidence_threshold: int
    max_followup_attempts: int
    followup_delay_minutes: int
    reactivation_delay_hours: int
    rate_limit_messages: int


class AgentUpdateRequest(BaseModel):
    is_active: bool | None = None
    ai_provider: str | None = None
    ai_model: str | None = None
    language: str | None = None
    tone: str | None = None
    system_prompt: str | None = None
    manual_context: str | None = None
    memory_notes: str | None = None
    skill_instructions: str | None = None
    confidence_threshold: int | None = None
    max_followup_attempts: int | None = None
    followup_delay_minutes: int | None = None
    reactivation_delay_hours: int | None = None
    rate_limit_messages: int | None = None


class AgentTestRequest(BaseModel):
    test_message: str
    language: str | None = None


class AgentTestResponse(BaseModel):
    qualification: dict | None = None
    generated_response: str | None = None
    confidence: float | None = None
    ai_provider: str
    ai_model: str
    token_count: dict


class ProviderItem(BaseModel):
    provider: str
    is_configured: bool
    is_active: bool


class ProviderListResponse(BaseModel):
    providers: list[ProviderItem]


class ProviderCredentialUpdate(BaseModel):
    api_key: str = Field(..., min_length=4)
    is_active: bool = True


class ProviderCredentialResponse(BaseModel):
    provider: str
    is_configured: bool
    is_active: bool
    updated_at: datetime | None = None


# ── Helpers ───────────────────────────────────────────────────────

DEFAULT_AGENT_BLUEPRINTS = [
    {
        "persona_id": "rafiq",
        "functional_type": FunctionalType.ORCHESTRATION_ROUTER,
        "display_name": "Rafiq",
        "role_description": "Lead coordinator that routes every inbound WhatsApp message.",
        "is_active": True,
        "confidence_threshold": 65,
    },
    {
        "persona_id": "layla",
        "functional_type": FunctionalType.LEAD_QUALIFICATION,
        "display_name": "Layla",
        "role_description": "Scores lead quality, urgency, service interest, and intent.",
        "is_active": True,
        "confidence_threshold": 70,
    },
    {
        "persona_id": "omar",
        "functional_type": FunctionalType.WHATSAPP_SALES,
        "display_name": "Omar",
        "role_description": "Generates WhatsApp replies for sales, pricing, and booking intent.",
        "is_active": True,
        "confidence_threshold": 70,
    },
    {
        "persona_id": "sara",
        "functional_type": FunctionalType.APPOINTMENT_OPTIMIZATION,
        "display_name": "Sara",
        "role_description": "Handles booking, rescheduling, confirmations, reminders, and no-shows.",
        "is_active": True,
        "confidence_threshold": 70,
    },
    {
        "persona_id": "noor",
        "functional_type": FunctionalType.FOLLOW_UP,
        "display_name": "Noor",
        "role_description": "Re-engages quiet leads and continues follow-up conversations.",
        "is_active": True,
        "confidence_threshold": 70,
    },
    {
        "persona_id": "dr-ai",
        "functional_type": FunctionalType.PERSONALIZATION,
        "display_name": "Dr. AI",
        "role_description": "Clinical-safe personalization layer for procedure-aware context.",
        "is_active": False,
        "confidence_threshold": 85,
    },
    {
        "persona_id": "zain",
        "functional_type": FunctionalType.AD_ATTRIBUTION,
        "display_name": "Zain",
        "role_description": "Attributes won deals and conversions back to ads and channels.",
        "is_active": True,
        "confidence_threshold": 75,
    },
    {
        "persona_id": "salma",
        "functional_type": FunctionalType.FUNNEL_DROPOFF,
        "display_name": "Salma",
        "role_description": "Detects funnel drop-offs and recommends recovery actions.",
        "is_active": False,
        "confidence_threshold": 75,
    },
]


async def _ensure_default_agents(db: AsyncSession, clinic_id: uuid.UUID) -> None:
    """Create missing default agent configs for a clinic.

    Existing agent settings are never overwritten. This keeps old clinics synced
    with new orchestration roles while preserving user configuration.
    """
    result = await db.execute(
        select(AIAgentConfig.persona_id).where(AIAgentConfig.clinic_id == clinic_id)
    )
    existing = {row[0] for row in result.all()}

    created = False
    for blueprint in DEFAULT_AGENT_BLUEPRINTS:
        if blueprint["persona_id"] in existing:
            continue
        db.add(
            AIAgentConfig(
                clinic_id=clinic_id,
                persona_id=blueprint["persona_id"],
                functional_type=blueprint["functional_type"],
                display_name=blueprint["display_name"],
                role_description=blueprint["role_description"],
                is_active=blueprint["is_active"],
                confidence_threshold=blueprint["confidence_threshold"],
            )
        )
        created = True

    if created:
        await db.commit()

def _agent_to_detail(agent: AIAgentConfig) -> AgentDetailResponse:
    return AgentDetailResponse(
        id=agent.id,
        persona_id=agent.persona_id,
        functional_type=agent.functional_type.value,
        display_name=agent.display_name,
        role_description=agent.role_description or "",
        ai_provider=agent.ai_provider.value,
        ai_model=agent.ai_model,
        is_active=agent.is_active,
        language=agent.language.value,
        tone=agent.tone,
        system_prompt=agent.system_prompt,
        manual_context=agent.manual_context,
        memory_notes=agent.memory_notes,
        skill_instructions=agent.skill_instructions,
        confidence_threshold=agent.confidence_threshold,
        max_followup_attempts=agent.max_followup_attempts,
        followup_delay_minutes=agent.followup_delay_minutes,
        reactivation_delay_hours=agent.reactivation_delay_hours,
        rate_limit_messages=agent.rate_limit_messages,
    )


async def _compute_agent_stats(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    agent_id: uuid.UUID,
) -> AgentStats:
    """Compute basic stats for an agent today."""
    start_of_day = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    msg_sent_result = await db.execute(
        select(func.count(AgentEventLog.id)).where(
            AgentEventLog.clinic_id == clinic_id,
            AgentEventLog.agent_config_id == agent_id,
            AgentEventLog.event_type == AgentEventType.MESSAGE_SENT,
            AgentEventLog.created_at >= start_of_day,
        )
    )
    messages_sent = msg_sent_result.scalar_one() or 0

    conv_result = await db.execute(
        select(func.count(func.distinct(OrchestrationWorkflow.conversation_id)))
        .join(AgentTask, AgentTask.workflow_id == OrchestrationWorkflow.id)
        .where(
            OrchestrationWorkflow.clinic_id == clinic_id,
            AgentTask.agent_config_id == agent_id,
            OrchestrationWorkflow.created_at >= start_of_day,
            OrchestrationWorkflow.conversation_id.isnot(None),
        )
    )
    conversations_today = conv_result.scalar_one() or 0

    completed_result = await db.execute(
        select(
            func.count(func.distinct(OrchestrationWorkflow.id)).filter(
                OrchestrationWorkflow.status == WorkflowStatus.COMPLETED
            ),
            func.count(func.distinct(OrchestrationWorkflow.id)),
        )
        .join(AgentTask, AgentTask.workflow_id == OrchestrationWorkflow.id)
        .where(
            OrchestrationWorkflow.clinic_id == clinic_id,
            AgentTask.agent_config_id == agent_id,
            OrchestrationWorkflow.created_at >= start_of_day,
        )
    )
    row = completed_result.one()
    completed, total = (row[0] or 0), (row[1] or 0)
    success_rate = (completed / total) if total else 0.0

    return AgentStats(
        conversations_today=conversations_today,
        messages_sent_today=messages_sent,
        avg_response_time_ms=0,
        success_rate=round(success_rate, 2),
    )


# ── T018: List agents ─────────────────────────────────────────────

@router.get("", response_model=AgentListResponse)
async def list_agents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    await _ensure_default_agents(db, clinic_id)
    result = await db.execute(
        select(AIAgentConfig)
        .where(AIAgentConfig.clinic_id == clinic_id)
        .order_by(AIAgentConfig.persona_id)
    )
    agents = result.scalars().all()

    items: list[AgentListItem] = []
    for agent in agents:
        stats = await _compute_agent_stats(db, clinic_id, agent.id)
        items.append(
            AgentListItem(
                id=agent.id,
                persona_id=agent.persona_id,
                functional_type=agent.functional_type.value,
                display_name=agent.display_name,
                role_description=agent.role_description or "",
                ai_provider=agent.ai_provider.value,
                ai_model=agent.ai_model,
                is_active=agent.is_active,
                language=agent.language.value,
                tone=agent.tone,
                confidence_threshold=agent.confidence_threshold,
                max_followup_attempts=agent.max_followup_attempts,
                followup_delay_minutes=agent.followup_delay_minutes,
                reactivation_delay_hours=agent.reactivation_delay_hours,
                rate_limit_messages=agent.rate_limit_messages,
                stats=stats,
            )
        )
    return AgentListResponse(agents=items)


# ── T022: List providers ─────────────────────────────────────────
# (Defined before the dynamic /{agent_id} route to avoid path collisions.)

@router.get("/providers", response_model=ProviderListResponse)
async def list_providers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(AIProviderCredential).where(
            AIProviderCredential.clinic_id == clinic_id
        )
    )
    credentials = {c.provider.value: c for c in result.scalars().all()}

    items: list[ProviderItem] = []
    for provider in AIProvider:
        cred = credentials.get(provider.value)
        items.append(
            ProviderItem(
                provider=provider.value,
                is_configured=bool(cred),
                is_active=bool(cred and cred.is_active),
            )
        )
    return ProviderListResponse(providers=items)


# ── T023: Set/update provider credential ─────────────────────────

@router.put(
    "/providers/{provider}", response_model=ProviderCredentialResponse
)
async def set_provider_credential(
    provider: str,
    body: ProviderCredentialUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    try:
        provider_enum = AIProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    result = await db.execute(
        select(AIProviderCredential).where(
            AIProviderCredential.clinic_id == clinic_id,
            AIProviderCredential.provider == provider_enum,
        )
    )
    credential = result.scalar_one_or_none()

    encrypted = encrypt_credentials({"api_key": body.api_key})
    if credential:
        credential.api_key_encrypted = encrypted
        credential.is_active = body.is_active
    else:
        credential = AIProviderCredential(
            clinic_id=clinic_id,
            provider=provider_enum,
            api_key_encrypted=encrypted,
            is_active=body.is_active,
        )
        db.add(credential)

    await db.commit()
    await db.refresh(credential)

    return ProviderCredentialResponse(
        provider=credential.provider.value,
        is_configured=True,
        is_active=credential.is_active,
        updated_at=credential.updated_at,
    )


# ── T019: Agent detail ────────────────────────────────────────────

@router.get("/{agent_id:uuid}", response_model=AgentDetailResponse)
async def get_agent(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(AIAgentConfig).where(
            AIAgentConfig.id == agent_id,
            AIAgentConfig.clinic_id == clinic_id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_to_detail(agent)


# ── T020: Update agent config ─────────────────────────────────────

_ALLOWED_TONES = {"professional", "friendly", "formal"}


@router.patch("/{agent_id:uuid}", response_model=AgentDetailResponse)
async def update_agent(
    agent_id: uuid.UUID,
    body: AgentUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(AIAgentConfig).where(
            AIAgentConfig.id == agent_id,
            AIAgentConfig.clinic_id == clinic_id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if body.is_active is not None:
        agent.is_active = body.is_active
    if body.ai_provider is not None:
        try:
            agent.ai_provider = AIProvider(body.ai_provider)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid ai_provider")
    if body.ai_model is not None:
        agent.ai_model = body.ai_model
    if body.language is not None:
        try:
            agent.language = AgentLanguage(body.language)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid language")
    if body.tone is not None:
        if body.tone not in _ALLOWED_TONES:
            raise HTTPException(status_code=400, detail="Invalid tone")
        agent.tone = body.tone
    if body.system_prompt is not None:
        agent.system_prompt = body.system_prompt
    if body.manual_context is not None:
        agent.manual_context = body.manual_context
    if body.memory_notes is not None:
        agent.memory_notes = body.memory_notes
    if body.skill_instructions is not None:
        agent.skill_instructions = body.skill_instructions
    if body.confidence_threshold is not None:
        if not 0 <= body.confidence_threshold <= 100:
            raise HTTPException(
                status_code=400, detail="confidence_threshold must be 0-100"
            )
        agent.confidence_threshold = body.confidence_threshold
    if body.max_followup_attempts is not None:
        agent.max_followup_attempts = max(0, body.max_followup_attempts)
    if body.followup_delay_minutes is not None:
        agent.followup_delay_minutes = max(1, body.followup_delay_minutes)
    if body.reactivation_delay_hours is not None:
        agent.reactivation_delay_hours = max(1, body.reactivation_delay_hours)
    if body.rate_limit_messages is not None:
        agent.rate_limit_messages = max(1, body.rate_limit_messages)

    await db.commit()
    await db.refresh(agent)
    return _agent_to_detail(agent)


# ── T021: Test an agent with sample input ────────────────────────

@router.post("/{agent_id:uuid}/test", response_model=AgentTestResponse)
async def test_agent(
    agent_id: uuid.UUID,
    body: AgentTestRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(AIAgentConfig).where(
            AIAgentConfig.id == agent_id,
            AIAgentConfig.clinic_id == clinic_id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Lazy-import to avoid circular imports at module load
    from app.services.ai.agents.lead_qualifier import LeadQualifierAgent
    from app.services.ai.agents.sales_responder import SalesResponderAgent

    extra_context = {
        "current_message": body.test_message,
        "dry_run": True,
    }

    # Capture scalar fields before any rollback expires ORM state
    agent_ai_provider = agent.ai_provider.value
    agent_ai_model = agent.ai_model

    qualification: dict | None = None
    generated_response: str | None = None
    confidence: float | None = None
    token_input = 0
    token_output = 0

    try:
        if agent.functional_type == FunctionalType.LEAD_QUALIFICATION:
            runner = LeadQualifierAgent(agent)
            out = await runner.run(db, extra_context=extra_context)
            qualification = {
                "score": out.get("score"),
                "intent": out.get("intent"),
                "service": out.get("service"),
                "urgency": out.get("urgency"),
            }
            confidence = out.get("confidence")
            token_input = out.get("token_count_input", 0)
            token_output = out.get("token_count_output", 0)
        elif agent.functional_type == FunctionalType.WHATSAPP_SALES:
            runner = SalesResponderAgent(agent)
            out = await runner.run(db, extra_context=extra_context)
            generated_response = out.get("message")
            confidence = out.get("confidence")
            token_input = out.get("token_count_input", 0)
            token_output = out.get("token_count_output", 0)
        else:
            # Generic test: try to invoke a sales-style chain to preview output
            runner = SalesResponderAgent(agent)
            out = await runner.run(db, extra_context=extra_context)
            generated_response = out.get("message")
            confidence = out.get("confidence")
            token_input = out.get("token_count_input", 0)
            token_output = out.get("token_count_output", 0)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Agent test failed: {str(exc)[:200]}",
        )
    finally:
        # Roll back any event log inserts the agent made — this is a dry run
        await db.rollback()

    return AgentTestResponse(
        qualification=qualification,
        generated_response=generated_response,
        confidence=confidence,
        ai_provider=agent_ai_provider,
        ai_model=agent_ai_model,
        token_count={"input": token_input, "output": token_output},
    )


# ── T044: Human takeover / release (US3 + US5) ───────────────────

class TakeoverResponse(BaseModel):
    conversation_id: uuid.UUID
    handled_by: str
    handled_by_user: str | None = None
    takeover_at: datetime | None = None


class ReleaseResponse(BaseModel):
    conversation_id: uuid.UUID
    handled_by: str
    released_at: datetime


@router.post(
    "/conversations/{conversation_id}/takeover",
    response_model=TakeoverResponse,
)
async def takeover_conversation(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    now = datetime.now(timezone.utc)
    conv.handled_by = ConversationHandler.HUMAN
    conv.handled_by_user_id = user.id
    conv.human_takeover_at = now

    # Cancel any pending AI tasks
    from app.services.ai.orchestrator import cancel_pending_tasks_for_conversation
    await cancel_pending_tasks_for_conversation(db, conversation_id)

    # Log event
    log = AgentEventLog(
        clinic_id=clinic_id,
        patient_id=conv.patient_id,
        event_type=AgentEventType.HUMAN_TAKEOVER,
        event_data={"user_id": str(user.id)},
    )
    db.add(log)
    await db.commit()

    return TakeoverResponse(
        conversation_id=conv.id,
        handled_by=conv.handled_by.value,
        handled_by_user=f"{user.first_name} {user.last_name}".strip() or user.email,
        takeover_at=now,
    )


@router.post(
    "/conversations/{conversation_id}/release",
    response_model=ReleaseResponse,
)
async def release_conversation(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    now = datetime.now(timezone.utc)
    conv.handled_by = ConversationHandler.AI
    conv.handled_by_user_id = None
    conv.human_takeover_at = None

    log = AgentEventLog(
        clinic_id=clinic_id,
        patient_id=conv.patient_id,
        event_type=AgentEventType.HUMAN_RELEASE,
        event_data={"user_id": str(user.id)},
    )
    db.add(log)
    await db.commit()

    return ReleaseResponse(
        conversation_id=conv.id,
        handled_by=conv.handled_by.value,
        released_at=now,
    )


# ── Per-conversation agent toggles ───────────────────────────────


class ConversationAgentEntry(BaseModel):
    persona_id: str
    persona_name: str
    functional_type: str
    is_active_clinic: bool  # clinic-level is_active
    is_enabled_conversation: bool  # effective: allowed on this conversation


class ConversationAgentsResponse(BaseModel):
    conversation_id: uuid.UUID
    inherits_clinic_defaults: bool  # True when enabled_agents is NULL
    enabled_agents: list[str] | None  # raw DB value
    agents: list[ConversationAgentEntry]


class SetConversationAgentsRequest(BaseModel):
    # None / missing → reset to clinic defaults (NULL in DB).
    # [] → all disabled on this conversation.
    # ["layla","omar"] → explicit allowlist.
    enabled_agents: list[str] | None = None


def _persona_display_name(persona_id: str) -> str:
    return {
        "rafiq": "Rafiq (Leader)",
        "layla": "Layla",
        "omar": "Omar",
        "sara": "Sara",
        "dr_ai": "Dr. AI",
        "dr-ai": "Dr. AI",
        "noor": "Noor",
        "zain": "Zain",
    }.get(persona_id, persona_id.title())


@router.get(
    "/conversations/{conversation_id}/agents",
    response_model=ConversationAgentsResponse,
)
async def get_conversation_agents(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    await _ensure_default_agents(db, clinic_id)

    conv_result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    agents_result = await db.execute(
        select(AIAgentConfig).where(AIAgentConfig.clinic_id == clinic_id)
    )
    clinic_agents = agents_result.scalars().all()

    inherits = conv.enabled_agents is None
    entries: list[ConversationAgentEntry] = []
    for a in clinic_agents:
        # Effective enablement: clinic-active AND (inherits defaults OR in allowlist)
        allowed_here = inherits or (a.persona_id in (conv.enabled_agents or []))
        entries.append(
            ConversationAgentEntry(
                persona_id=a.persona_id,
                persona_name=_persona_display_name(a.persona_id),
                functional_type=a.functional_type.value,
                is_active_clinic=a.is_active,
                is_enabled_conversation=bool(a.is_active and allowed_here),
            )
        )

    return ConversationAgentsResponse(
        conversation_id=conv.id,
        inherits_clinic_defaults=inherits,
        enabled_agents=conv.enabled_agents,
        agents=entries,
    )


@router.patch(
    "/conversations/{conversation_id}/agents",
    response_model=ConversationAgentsResponse,
)
async def set_conversation_agents(
    conversation_id: uuid.UUID,
    body: SetConversationAgentsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    conv_result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Validate persona_ids against clinic's configured agents
    if body.enabled_agents is not None:
        agents_result = await db.execute(
            select(AIAgentConfig.persona_id).where(AIAgentConfig.clinic_id == clinic_id)
        )
        valid_personas = {row[0] for row in agents_result.all()}
        invalid = [p for p in body.enabled_agents if p not in valid_personas]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown persona_ids: {', '.join(invalid)}",
            )
        conv.enabled_agents = list(dict.fromkeys(body.enabled_agents))  # dedupe, keep order
    else:
        conv.enabled_agents = None  # reset to clinic defaults

    await db.commit()
    await db.refresh(conv)

    # Re-build the response the same way as GET
    return await get_conversation_agents(conversation_id, user, db)


# ── T053: Dashboard stats ────────────────────────────────────────

class DashboardStats(BaseModel):
    period: str
    leads_qualified: int
    messages_sent: int
    conversations_active: int
    appointments_booked: int
    followups_sent: int
    escalated_to_human: int
    workflows_completed: int
    workflows_failed: int
    avg_response_time_ms: int
    conversion_rate: float


def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(
    period: str = Query("today", pattern="^(today|week|month)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    since = _period_start(period)

    async def _count_events(event_type: AgentEventType) -> int:
        res = await db.execute(
            select(func.count(AgentEventLog.id)).where(
                AgentEventLog.clinic_id == clinic_id,
                AgentEventLog.event_type == event_type,
                AgentEventLog.created_at >= since,
            )
        )
        return res.scalar_one() or 0

    leads_qualified = await _count_events(AgentEventType.LEAD_SCORED)
    messages_sent = await _count_events(AgentEventType.MESSAGE_SENT)
    followups_sent = await _count_events(AgentEventType.FOLLOWUP_SENT)
    escalated = await _count_events(AgentEventType.ESCALATED_TO_HUMAN)

    active_conv_res = await db.execute(
        select(func.count(func.distinct(OrchestrationWorkflow.conversation_id))).where(
            OrchestrationWorkflow.clinic_id == clinic_id,
            OrchestrationWorkflow.created_at >= since,
            OrchestrationWorkflow.conversation_id.isnot(None),
        )
    )
    conversations_active = active_conv_res.scalar_one() or 0

    wf_res = await db.execute(
        select(
            func.count(OrchestrationWorkflow.id).filter(
                OrchestrationWorkflow.status == WorkflowStatus.COMPLETED
            ),
            func.count(OrchestrationWorkflow.id).filter(
                OrchestrationWorkflow.status == WorkflowStatus.FAILED
            ),
            func.count(OrchestrationWorkflow.id),
        ).where(
            OrchestrationWorkflow.clinic_id == clinic_id,
            OrchestrationWorkflow.created_at >= since,
        )
    )
    wf_row = wf_res.one()
    wf_completed = wf_row[0] or 0
    wf_failed = wf_row[1] or 0
    wf_total = wf_row[2] or 0

    appt_booked_res = await db.execute(
        select(func.count(AgentEventLog.id)).where(
            AgentEventLog.clinic_id == clinic_id,
            AgentEventLog.event_type == AgentEventType.APPOINTMENT_RESCHEDULED,
            AgentEventLog.created_at >= since,
        )
    )
    appointments_booked = appt_booked_res.scalar_one() or 0

    conversion_rate = round(wf_completed / wf_total, 2) if wf_total else 0.0

    return DashboardStats(
        period=period,
        leads_qualified=leads_qualified,
        messages_sent=messages_sent,
        conversations_active=conversations_active,
        appointments_booked=appointments_booked,
        followups_sent=followups_sent,
        escalated_to_human=escalated,
        workflows_completed=wf_completed,
        workflows_failed=wf_failed,
        avg_response_time_ms=0,
        conversion_rate=conversion_rate,
    )


# ── T054: Dashboard activity feed ────────────────────────────────

class ActivityItem(BaseModel):
    id: uuid.UUID
    event_type: str
    agent_persona: str | None
    agent_display_name: str | None
    patient_name: str | None
    patient_id: uuid.UUID | None
    event_data: dict | None
    created_at: datetime


class ActivityListResponse(BaseModel):
    total: int
    items: list[ActivityItem]


@router.get("/dashboard/activity", response_model=ActivityListResponse)
async def dashboard_activity(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    agent_id: uuid.UUID | None = None,
    event_type: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    filters = [AgentEventLog.clinic_id == clinic_id]
    if agent_id:
        filters.append(AgentEventLog.agent_config_id == agent_id)
    if event_type:
        try:
            filters.append(AgentEventLog.event_type == AgentEventType(event_type))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid event_type")

    total_res = await db.execute(
        select(func.count(AgentEventLog.id)).where(and_(*filters))
    )
    total = total_res.scalar_one() or 0

    rows_res = await db.execute(
        select(AgentEventLog, AIAgentConfig, Patient)
        .outerjoin(AIAgentConfig, AgentEventLog.agent_config_id == AIAgentConfig.id)
        .outerjoin(Patient, AgentEventLog.patient_id == Patient.id)
        .where(and_(*filters))
        .order_by(AgentEventLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    items: list[ActivityItem] = []
    for log, agent, patient in rows_res.all():
        items.append(
            ActivityItem(
                id=log.id,
                event_type=log.event_type.value,
                agent_persona=agent.persona_id if agent else None,
                agent_display_name=agent.display_name if agent else None,
                patient_name=(
                    f"{patient.first_name} {patient.last_name}".strip()
                    if patient
                    else None
                ),
                patient_id=log.patient_id,
                event_data=log.event_data,
                created_at=log.created_at,
            )
        )

    return ActivityListResponse(total=total, items=items)


# ── T055: Dashboard workflows list ───────────────────────────────

class WorkflowItem(BaseModel):
    id: uuid.UUID
    trigger_type: str
    goal: str
    status: str
    patient_name: str | None
    patient_id: uuid.UUID | None
    tasks_total: int
    tasks_completed: int
    tasks_failed: int
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None
    created_at: datetime


class WorkflowListResponse(BaseModel):
    total: int
    items: list[WorkflowItem]


@router.get("/dashboard/workflows", response_model=WorkflowListResponse)
async def dashboard_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = None,
    trigger_type: str | None = None,
    patient_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    filters = [OrchestrationWorkflow.clinic_id == clinic_id]
    if status:
        try:
            filters.append(OrchestrationWorkflow.status == WorkflowStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    if trigger_type:
        from app.models.ai_agent import TriggerType
        try:
            filters.append(OrchestrationWorkflow.trigger_type == TriggerType(trigger_type))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid trigger_type")
    if patient_id:
        filters.append(OrchestrationWorkflow.patient_id == patient_id)

    total_res = await db.execute(
        select(func.count(OrchestrationWorkflow.id)).where(and_(*filters))
    )
    total = total_res.scalar_one() or 0

    rows_res = await db.execute(
        select(OrchestrationWorkflow, Patient)
        .outerjoin(Patient, OrchestrationWorkflow.patient_id == Patient.id)
        .where(and_(*filters))
        .order_by(OrchestrationWorkflow.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    items: list[WorkflowItem] = []
    for wf, patient in rows_res.all():
        task_counts_res = await db.execute(
            select(
                func.count(AgentTask.id),
                func.count(AgentTask.id).filter(AgentTask.status == TaskStatus.COMPLETED),
                func.count(AgentTask.id).filter(AgentTask.status == TaskStatus.FAILED),
            ).where(AgentTask.workflow_id == wf.id)
        )
        tc_total, tc_done, tc_failed = task_counts_res.one()

        duration_ms: int | None = None
        if wf.started_at and wf.completed_at:
            duration_ms = int(
                (wf.completed_at - wf.started_at).total_seconds() * 1000
            )

        items.append(
            WorkflowItem(
                id=wf.id,
                trigger_type=wf.trigger_type.value,
                goal=wf.goal,
                status=wf.status.value,
                patient_name=(
                    f"{patient.first_name} {patient.last_name}".strip()
                    if patient
                    else None
                ),
                patient_id=wf.patient_id,
                tasks_total=tc_total or 0,
                tasks_completed=tc_done or 0,
                tasks_failed=tc_failed or 0,
                started_at=wf.started_at,
                completed_at=wf.completed_at,
                duration_ms=duration_ms,
                created_at=wf.created_at,
            )
        )

    return WorkflowListResponse(total=total, items=items)


# ── List AI conversations (for the conversations page) ──────────

class ConversationListItem(BaseModel):
    id: uuid.UUID
    contact_name: str
    contact_phone: str
    last_message: str
    last_message_at: datetime | None
    unread_count: int
    handled_by: str
    handled_by_user_id: uuid.UUID | None
    human_takeover_at: datetime | None
    ai_opt_out: bool
    lead_score: int | None
    lead_intent: str | None
    lead_service: str | None
    patient_id: uuid.UUID | None
    patient_name: str | None


class ConversationListResponse(BaseModel):
    total: int
    items: list[ConversationListItem]


@router.get("/conversations", response_model=ConversationListResponse)
async def list_ai_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    handled_by: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    filters = [
        WhatsAppConversation.clinic_id == clinic_id,
        WhatsAppConversation.is_archived == False,  # noqa: E712
    ]
    if handled_by:
        try:
            filters.append(
                WhatsAppConversation.handled_by == ConversationHandler(handled_by)
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid handled_by")

    total_res = await db.execute(
        select(func.count(WhatsAppConversation.id)).where(and_(*filters))
    )
    total = total_res.scalar_one() or 0

    rows_res = await db.execute(
        select(WhatsAppConversation, Patient)
        .outerjoin(Patient, WhatsAppConversation.patient_id == Patient.id)
        .where(and_(*filters))
        .order_by(WhatsAppConversation.last_message_at.desc().nullslast())
        .offset(skip)
        .limit(limit)
    )

    items: list[ConversationListItem] = []
    for conv, patient in rows_res.all():
        items.append(
            ConversationListItem(
                id=conv.id,
                contact_name=conv.contact_name,
                contact_phone=conv.contact_phone,
                last_message=conv.last_message,
                last_message_at=conv.last_message_at,
                unread_count=conv.unread_count,
                handled_by=conv.handled_by.value,
                handled_by_user_id=conv.handled_by_user_id,
                human_takeover_at=conv.human_takeover_at,
                ai_opt_out=conv.ai_opt_out,
                lead_score=conv.lead_score,
                lead_intent=conv.lead_intent,
                lead_service=conv.lead_service,
                patient_id=conv.patient_id,
                patient_name=(
                    f"{patient.first_name} {patient.last_name}".strip()
                    if patient
                    else None
                ),
            )
        )

    return ConversationListResponse(total=total, items=items)


# ── T071: Knowledge base CRUD ────────────────────────────────────

class KBEntryItem(BaseModel):
    id: uuid.UUID
    agent_config_id: uuid.UUID | None
    entry_type: str
    title: str
    content: str
    language: str
    service_type: str | None
    is_active: bool
    sort_order: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class KBListResponse(BaseModel):
    total: int
    items: list[KBEntryItem]


class KBCreateRequest(BaseModel):
    agent_config_id: uuid.UUID | None = None
    entry_type: str
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    language: str = "en"
    service_type: str | None = None
    is_active: bool = True
    sort_order: int = 0


class KBUpdateRequest(BaseModel):
    agent_config_id: uuid.UUID | None = None
    entry_type: str | None = None
    title: str | None = Field(None, min_length=1, max_length=255)
    content: str | None = Field(None, min_length=1)
    language: str | None = None
    service_type: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


def _kb_to_item(entry: KnowledgeBaseEntry) -> KBEntryItem:
    return KBEntryItem(
        id=entry.id,
        agent_config_id=entry.agent_config_id,
        entry_type=entry.entry_type.value,
        title=entry.title,
        content=entry.content,
        language=entry.language.value,
        service_type=entry.service_type,
        is_active=entry.is_active,
        sort_order=entry.sort_order,
        created_at=getattr(entry, "created_at", None),
        updated_at=getattr(entry, "updated_at", None),
    )


@router.get("/knowledge-base", response_model=KBListResponse)
async def list_knowledge_base(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    agent_id: uuid.UUID | None = None,
    entry_type: str | None = None,
    service_type: str | None = None,
    language: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    filters = [KnowledgeBaseEntry.clinic_id == clinic_id]
    if agent_id:
        filters.append(KnowledgeBaseEntry.agent_config_id == agent_id)
    if entry_type:
        try:
            filters.append(KnowledgeBaseEntry.entry_type == KBEntryType(entry_type))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid entry_type")
    if service_type:
        filters.append(KnowledgeBaseEntry.service_type == service_type)
    if language:
        try:
            filters.append(KnowledgeBaseEntry.language == AgentLanguage(language))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid language")

    total_res = await db.execute(
        select(func.count(KnowledgeBaseEntry.id)).where(and_(*filters))
    )
    total = total_res.scalar_one() or 0

    rows_res = await db.execute(
        select(KnowledgeBaseEntry)
        .where(and_(*filters))
        .order_by(
            KnowledgeBaseEntry.sort_order.asc(),
            KnowledgeBaseEntry.title.asc(),
        )
        .offset(skip)
        .limit(limit)
    )
    items = [_kb_to_item(e) for e in rows_res.scalars().all()]
    return KBListResponse(total=total, items=items)


@router.post(
    "/knowledge-base",
    response_model=KBEntryItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_knowledge_entry(
    body: KBCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    try:
        entry_type_enum = KBEntryType(body.entry_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid entry_type")
    try:
        lang_enum = AgentLanguage(body.language)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid language")

    if body.agent_config_id:
        agent_res = await db.execute(
            select(AIAgentConfig.id).where(
                AIAgentConfig.id == body.agent_config_id,
                AIAgentConfig.clinic_id == clinic_id,
            )
        )
        if not agent_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Agent not found in clinic")

    entry = KnowledgeBaseEntry(
        clinic_id=clinic_id,
        agent_config_id=body.agent_config_id,
        entry_type=entry_type_enum,
        title=body.title,
        content=body.content,
        language=lang_enum,
        service_type=body.service_type,
        is_active=body.is_active,
        sort_order=body.sort_order,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _kb_to_item(entry)


@router.patch("/knowledge-base/{entry_id}", response_model=KBEntryItem)
async def update_knowledge_entry(
    entry_id: uuid.UUID,
    body: KBUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(KnowledgeBaseEntry).where(
            KnowledgeBaseEntry.id == entry_id,
            KnowledgeBaseEntry.clinic_id == clinic_id,
        )
    )
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")

    if body.agent_config_id is not None:
        if body.agent_config_id:
            agent_res = await db.execute(
                select(AIAgentConfig.id).where(
                    AIAgentConfig.id == body.agent_config_id,
                    AIAgentConfig.clinic_id == clinic_id,
                )
            )
            if not agent_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=400, detail="Agent not found in clinic"
                )
        entry.agent_config_id = body.agent_config_id
    if body.entry_type is not None:
        try:
            entry.entry_type = KBEntryType(body.entry_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid entry_type")
    if body.title is not None:
        entry.title = body.title
    if body.content is not None:
        entry.content = body.content
    if body.language is not None:
        try:
            entry.language = AgentLanguage(body.language)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid language")
    if body.service_type is not None:
        entry.service_type = body.service_type
    if body.is_active is not None:
        entry.is_active = body.is_active
    if body.sort_order is not None:
        entry.sort_order = body.sort_order

    await db.commit()
    await db.refresh(entry)
    return _kb_to_item(entry)


@router.delete(
    "/knowledge-base/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_knowledge_entry(
    entry_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(KnowledgeBaseEntry).where(
            KnowledgeBaseEntry.id == entry_id,
            KnowledgeBaseEntry.clinic_id == clinic_id,
        )
    )
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    await db.delete(entry)
    await db.commit()
    return None
