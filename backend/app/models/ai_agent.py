import uuid
from enum import Enum as PyEnum
from datetime import datetime

from sqlalchemy import (
    String, Enum, Boolean, DateTime, Integer, Float, Text,
    ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, TenantMixin


def _pg_enum(enum_cls, name: str | None = None):
    """Build a SQLAlchemy Enum column type that uses enum VALUES (not names)
    when talking to the postgres native enum type. The migration created the
    postgres enums with the lowercase `.value` strings, so we must match.

    `name` lets us override the pg type name when it diverges from the Python
    class name (e.g. TriggerType → ai_triggertype to avoid collision with the
    tracking module's TriggerType enum).
    """
    kwargs = {
        "values_callable": lambda e: [m.value for m in e],
        "native_enum": True,
    }
    if name is not None:
        kwargs["name"] = name
    return Enum(enum_cls, **kwargs)


# ──────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────

class AIProvider(str, PyEnum):
    OPENAI = "openai"
    GOOGLE_GEMINI = "google_gemini"


class FunctionalType(str, PyEnum):
    LEAD_QUALIFICATION = "lead_qualification"
    WHATSAPP_SALES = "whatsapp_sales"
    APPOINTMENT_OPTIMIZATION = "appointment_optimization"
    PERSONALIZATION = "personalization"
    FOLLOW_UP = "follow_up"
    REACTIVATION = "reactivation"
    AD_ATTRIBUTION = "ad_attribution"
    FUNNEL_DROPOFF = "funnel_dropoff"
    ORCHESTRATION_ROUTER = "orchestration_router"  # Leader / Rafiq — classifies intent and routes


class AgentLanguage(str, PyEnum):
    EN = "en"
    AR = "ar"


class WorkflowStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class TaskStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class TriggerType(str, PyEnum):
    NEW_WHATSAPP_MESSAGE = "new_whatsapp_message"
    FORM_SUBMISSION = "form_submission"
    DEAL_STAGE_CHANGE = "deal_stage_change"
    APPOINTMENT_STATUS_CHANGE = "appointment_status_change"
    NO_REPLY_TIMEOUT = "no_reply_timeout"
    STALE_LEAD_DETECTED = "stale_lead_detected"


class AgentTaskType(str, PyEnum):
    QUALIFY_LEAD = "qualify_lead"
    GENERATE_RESPONSE = "generate_response"
    SEND_MESSAGE = "send_message"
    SCHEDULE_FOLLOWUP = "schedule_followup"
    CHECK_REPLY = "check_reply"
    SEND_REMINDER = "send_reminder"
    RESCHEDULE_APPOINTMENT = "reschedule_appointment"
    DETECT_DROPOFF = "detect_dropoff"
    ATTRIBUTE_CONVERSION = "attribute_conversion"


class AgentEventType(str, PyEnum):
    LEAD_SCORED = "lead_scored"
    MESSAGE_GENERATED = "message_generated"
    MESSAGE_SENT = "message_sent"
    FOLLOWUP_SCHEDULED = "followup_scheduled"
    FOLLOWUP_SENT = "followup_sent"
    REACTIVATION_SENT = "reactivation_sent"
    REMINDER_SENT = "reminder_sent"
    APPOINTMENT_RESCHEDULED = "appointment_rescheduled"
    HUMAN_TAKEOVER = "human_takeover"
    HUMAN_RELEASE = "human_release"
    OPT_OUT_DETECTED = "opt_out_detected"
    ESCALATED_TO_HUMAN = "escalated_to_human"
    TASK_FAILED = "task_failed"
    ATTRIBUTION_LINKED = "attribution_linked"
    MESSAGE_ROUTED = "message_routed"  # Leader routed an inbound message to a specialist


class KBEntryType(str, PyEnum):
    SYSTEM_PROMPT = "system_prompt"
    RESPONSE_TEMPLATE = "response_template"
    SERVICE_INFO = "service_info"
    FAQ = "faq"
    OBJECTION_HANDLER = "objection_handler"
    CUSTOM_CONTEXT = "custom_context"


# ──────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────

class AIAgentConfig(Base, TimestampMixin, TenantMixin):
    __tablename__ = "ai_agent_configs"
    __table_args__ = (
        UniqueConstraint("clinic_id", "persona_id", name="uq_ai_agent_clinic_persona"),
        Index("ix_ai_agent_clinic_type", "clinic_id", "functional_type"),
        Index("ix_ai_agent_clinic_active", "clinic_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    persona_id: Mapped[str] = mapped_column(String(50), nullable=False)
    functional_type: Mapped[FunctionalType] = mapped_column(_pg_enum(FunctionalType), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role_description: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    ai_provider: Mapped[AIProvider] = mapped_column(_pg_enum(AIProvider), default=AIProvider.OPENAI)
    ai_model: Mapped[str] = mapped_column(String(100), nullable=False, default="gpt-5.4-mini-2026-03-17")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[AgentLanguage] = mapped_column(_pg_enum(AgentLanguage), default=AgentLanguage.EN)
    tone: Mapped[str] = mapped_column(String(50), default="professional")

    # Prompts & knowledge
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    manual_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    memory_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    skill_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Behavior thresholds
    confidence_threshold: Mapped[int] = mapped_column(Integer, default=70)
    max_followup_attempts: Mapped[int] = mapped_column(Integer, default=3)
    followup_delay_minutes: Mapped[int] = mapped_column(Integer, default=30)
    reactivation_delay_hours: Mapped[int] = mapped_column(Integer, default=24)
    rate_limit_messages: Mapped[int] = mapped_column(Integer, default=10)

    # Relationships
    tasks: Mapped[list["AgentTask"]] = relationship(back_populates="agent_config")
    event_logs: Mapped[list["AgentEventLog"]] = relationship(back_populates="agent_config")
    knowledge_entries: Mapped[list["KnowledgeBaseEntry"]] = relationship(back_populates="agent_config")


class AIProviderCredential(Base, TimestampMixin, TenantMixin):
    __tablename__ = "ai_provider_credentials"
    __table_args__ = (
        UniqueConstraint("clinic_id", "provider", name="uq_ai_provider_clinic"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[AIProvider] = mapped_column(_pg_enum(AIProvider), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class OrchestrationWorkflow(Base, TimestampMixin, TenantMixin):
    __tablename__ = "orchestration_workflows"
    __table_args__ = (
        Index("ix_orch_wf_clinic_status", "clinic_id", "status"),
        Index("ix_orch_wf_clinic_patient", "clinic_id", "patient_id"),
        Index("ix_orch_wf_clinic_trigger", "clinic_id", "trigger_type"),
        Index("ix_orch_wf_created", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trigger_type: Mapped[TriggerType] = mapped_column(_pg_enum(TriggerType, name="ai_triggertype"), nullable=False)
    trigger_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    trigger_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("whatsapp_conversations.id", ondelete="SET NULL"), nullable=True
    )
    goal: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[WorkflowStatus] = mapped_column(_pg_enum(WorkflowStatus), default=WorkflowStatus.PENDING)
    current_task_index: Mapped[int] = mapped_column(Integer, default=0)
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    escalated_to_human: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    tasks: Mapped[list["AgentTask"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")
    event_logs: Mapped[list["AgentEventLog"]] = relationship(back_populates="workflow")


class AgentTask(Base, TenantMixin):
    __tablename__ = "agent_tasks"
    __table_args__ = (
        Index("ix_agent_task_workflow", "workflow_id"),
        Index("ix_agent_task_clinic_status", "clinic_id", "status"),
        Index("ix_agent_task_scheduled", "scheduled_at"),
        Index("ix_agent_task_celery", "celery_task_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orchestration_workflows.id", ondelete="CASCADE"), nullable=False
    )
    agent_config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_agent_configs.id", ondelete="SET NULL"), nullable=True
    )
    task_type: Mapped[AgentTaskType] = mapped_column(_pg_enum(AgentTaskType), nullable=False)
    task_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(_pg_enum(TaskStatus), default=TaskStatus.PENDING)
    input_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    # Relationships
    workflow: Mapped["OrchestrationWorkflow"] = relationship(back_populates="tasks")
    agent_config: Mapped["AIAgentConfig | None"] = relationship(back_populates="tasks")


class AgentEventLog(Base, TenantMixin):
    __tablename__ = "agent_event_logs"
    __table_args__ = (
        Index("ix_agent_event_clinic_patient", "clinic_id", "patient_id"),
        Index("ix_agent_event_clinic_type", "clinic_id", "event_type"),
        Index("ix_agent_event_clinic_created", "clinic_id", "created_at"),
        Index("ix_agent_event_workflow", "workflow_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orchestration_workflows.id", ondelete="SET NULL"), nullable=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True
    )
    agent_config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_agent_configs.id", ondelete="SET NULL"), nullable=True
    )
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[AgentEventType] = mapped_column(_pg_enum(AgentEventType), nullable=False)
    event_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ai_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    token_count_input: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_count_output: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    # Relationships
    workflow: Mapped["OrchestrationWorkflow | None"] = relationship(back_populates="event_logs")
    agent_config: Mapped["AIAgentConfig | None"] = relationship(back_populates="event_logs")


class KnowledgeBaseEntry(Base, TimestampMixin, TenantMixin):
    __tablename__ = "knowledge_base_entries"
    __table_args__ = (
        Index("ix_kb_entry_clinic_agent", "clinic_id", "agent_config_id"),
        Index("ix_kb_entry_clinic_type", "clinic_id", "entry_type"),
        Index("ix_kb_entry_clinic_service", "clinic_id", "service_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_agent_configs.id", ondelete="CASCADE"), nullable=True
    )
    entry_type: Mapped[KBEntryType] = mapped_column(_pg_enum(KBEntryType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[AgentLanguage] = mapped_column(_pg_enum(AgentLanguage), default=AgentLanguage.EN)
    service_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    agent_config: Mapped["AIAgentConfig | None"] = relationship(back_populates="knowledge_entries")
