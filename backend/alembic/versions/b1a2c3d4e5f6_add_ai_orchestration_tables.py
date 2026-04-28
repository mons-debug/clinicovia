"""add ai orchestration tables

Revision ID: b1a2c3d4e5f6
Revises: fab078af044e
Create Date: 2026-04-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b1a2c3d4e5f6"
down_revision: Union[str, None] = "fab078af044e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ──
    ai_provider_enum = postgresql.ENUM(
        "openai", "google_gemini", name="aiprovider", create_type=False
    )
    functional_type_enum = postgresql.ENUM(
        "lead_qualification", "whatsapp_sales", "appointment_optimization",
        "personalization", "follow_up", "reactivation", "ad_attribution", "funnel_dropoff",
        name="functionaltype", create_type=False,
    )
    agent_language_enum = postgresql.ENUM("en", "ar", name="agentlanguage", create_type=False)
    workflow_status_enum = postgresql.ENUM(
        "pending", "running", "completed", "failed", "paused", "cancelled",
        name="workflowstatus", create_type=False,
    )
    task_status_enum = postgresql.ENUM(
        "pending", "running", "completed", "failed", "cancelled", "skipped",
        name="taskstatus", create_type=False,
    )
    trigger_type_enum = postgresql.ENUM(
        "new_whatsapp_message", "form_submission", "deal_stage_change",
        "appointment_status_change", "no_reply_timeout", "stale_lead_detected",
        name="ai_triggertype", create_type=False,
    )
    agent_task_type_enum = postgresql.ENUM(
        "qualify_lead", "generate_response", "send_message", "schedule_followup",
        "check_reply", "send_reminder", "reschedule_appointment",
        "detect_dropoff", "attribute_conversion",
        name="agenttasktype", create_type=False,
    )
    agent_event_type_enum = postgresql.ENUM(
        "lead_scored", "message_generated", "message_sent", "followup_scheduled",
        "followup_sent", "reactivation_sent", "reminder_sent", "appointment_rescheduled",
        "human_takeover", "human_release", "opt_out_detected", "escalated_to_human",
        "task_failed", "attribution_linked",
        name="agenteventtype", create_type=False,
    )
    kb_entry_type_enum = postgresql.ENUM(
        "system_prompt", "response_template", "service_info", "faq",
        "objection_handler", "custom_context",
        name="kbentrytype", create_type=False,
    )
    conversation_handler_enum = postgresql.ENUM(
        "ai", "human", "paused", name="conversationhandler", create_type=False
    )

    # Create all enums
    for enum in [
        ai_provider_enum, functional_type_enum, agent_language_enum,
        workflow_status_enum, task_status_enum, trigger_type_enum,
        agent_task_type_enum, agent_event_type_enum, kb_entry_type_enum,
        conversation_handler_enum,
    ]:
        enum.create(op.get_bind(), checkfirst=True)

    # ── ai_agent_configs ──
    op.create_table(
        "ai_agent_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("persona_id", sa.String(50), nullable=False),
        sa.Column("functional_type", functional_type_enum, nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("role_description", sa.String(255), nullable=False, server_default=""),
        sa.Column("ai_provider", ai_provider_enum, nullable=False, server_default="openai"),
        sa.Column("ai_model", sa.String(100), nullable=False, server_default="gpt-4o"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("language", agent_language_enum, nullable=False, server_default="en"),
        sa.Column("tone", sa.String(50), server_default="professional"),
        sa.Column("system_prompt", sa.Text, nullable=True),
        sa.Column("manual_context", sa.Text, nullable=True),
        sa.Column("memory_notes", sa.Text, nullable=True),
        sa.Column("skill_instructions", sa.Text, nullable=True),
        sa.Column("confidence_threshold", sa.Integer, server_default="70"),
        sa.Column("max_followup_attempts", sa.Integer, server_default="3"),
        sa.Column("followup_delay_minutes", sa.Integer, server_default="30"),
        sa.Column("reactivation_delay_hours", sa.Integer, server_default="24"),
        sa.Column("rate_limit_messages", sa.Integer, server_default="10"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("clinic_id", "persona_id", name="uq_ai_agent_clinic_persona"),
    )
    op.create_index("ix_ai_agent_clinic_type", "ai_agent_configs", ["clinic_id", "functional_type"])
    op.create_index("ix_ai_agent_clinic_active", "ai_agent_configs", ["clinic_id", "is_active"])

    # ── ai_provider_credentials ──
    op.create_table(
        "ai_provider_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("provider", ai_provider_enum, nullable=False),
        sa.Column("api_key_encrypted", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("clinic_id", "provider", name="uq_ai_provider_clinic"),
    )

    # ── orchestration_workflows ──
    op.create_table(
        "orchestration_workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("trigger_type", trigger_type_enum, nullable=False),
        sa.Column("trigger_entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trigger_entity_type", sa.String(50), nullable=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("whatsapp_conversations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("goal", sa.String(255), nullable=False),
        sa.Column("status", workflow_status_enum, nullable=False, server_default="pending"),
        sa.Column("current_task_index", sa.Integer, server_default="0"),
        sa.Column("result_summary", sa.Text, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("escalated_to_human", sa.Boolean, server_default="false"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_orch_wf_clinic_status", "orchestration_workflows", ["clinic_id", "status"])
    op.create_index("ix_orch_wf_clinic_patient", "orchestration_workflows", ["clinic_id", "patient_id"])
    op.create_index("ix_orch_wf_clinic_trigger", "orchestration_workflows", ["clinic_id", "trigger_type"])
    op.create_index("ix_orch_wf_created", "orchestration_workflows", ["created_at"])

    # ── agent_tasks ──
    op.create_table(
        "agent_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orchestration_workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_agent_configs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("task_type", agent_task_type_enum, nullable=False),
        sa.Column("task_order", sa.Integer, nullable=False),
        sa.Column("status", task_status_enum, nullable=False, server_default="pending"),
        sa.Column("input_data", postgresql.JSONB, nullable=True),
        sa.Column("output_data", postgresql.JSONB, nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("retry_count", sa.Integer, server_default="0"),
        sa.Column("max_retries", sa.Integer, server_default="3"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agent_task_workflow", "agent_tasks", ["workflow_id"])
    op.create_index("ix_agent_task_clinic_status", "agent_tasks", ["clinic_id", "status"])
    op.create_index("ix_agent_task_scheduled", "agent_tasks", ["scheduled_at"])
    op.create_index("ix_agent_task_celery", "agent_tasks", ["celery_task_id"])

    # ── agent_event_logs ──
    op.create_table(
        "agent_event_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orchestration_workflows.id", ondelete="SET NULL"), nullable=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("agent_config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_agent_configs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", agent_event_type_enum, nullable=False),
        sa.Column("event_data", postgresql.JSONB, nullable=True),
        sa.Column("ai_provider", sa.String(50), nullable=True),
        sa.Column("ai_model", sa.String(100), nullable=True),
        sa.Column("token_count_input", sa.Integer, nullable=True),
        sa.Column("token_count_output", sa.Integer, nullable=True),
        sa.Column("confidence_score", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agent_event_clinic_patient", "agent_event_logs", ["clinic_id", "patient_id"])
    op.create_index("ix_agent_event_clinic_type", "agent_event_logs", ["clinic_id", "event_type"])
    op.create_index("ix_agent_event_clinic_created", "agent_event_logs", ["clinic_id", "created_at"])
    op.create_index("ix_agent_event_workflow", "agent_event_logs", ["workflow_id"])

    # ── knowledge_base_entries ──
    op.create_table(
        "knowledge_base_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("agent_config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_agent_configs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("entry_type", kb_entry_type_enum, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("language", agent_language_enum, server_default="en"),
        sa.Column("service_type", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_kb_entry_clinic_agent", "knowledge_base_entries", ["clinic_id", "agent_config_id"])
    op.create_index("ix_kb_entry_clinic_type", "knowledge_base_entries", ["clinic_id", "entry_type"])
    op.create_index("ix_kb_entry_clinic_service", "knowledge_base_entries", ["clinic_id", "service_type"])

    # ── Modify whatsapp_conversations ──
    op.add_column("whatsapp_conversations", sa.Column("handled_by", conversation_handler_enum, server_default="ai"))
    op.add_column("whatsapp_conversations", sa.Column("handled_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("whatsapp_conversations", sa.Column("human_takeover_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("whatsapp_conversations", sa.Column("ai_opt_out", sa.Boolean, server_default="false"))
    op.add_column("whatsapp_conversations", sa.Column("lead_score", sa.Integer, nullable=True))
    op.add_column("whatsapp_conversations", sa.Column("lead_intent", sa.String(100), nullable=True))
    op.add_column("whatsapp_conversations", sa.Column("lead_service", sa.String(100), nullable=True))

    # ── Modify patients ──
    op.add_column("patients", sa.Column("ai_opt_out", sa.Boolean, server_default="false"))
    op.add_column("patients", sa.Column("last_ai_contact_at", sa.String(50), nullable=True))
    op.add_column("patients", sa.Column("ai_message_count_today", sa.Integer, server_default="0"))


def downgrade() -> None:
    # Remove patient columns
    op.drop_column("patients", "ai_message_count_today")
    op.drop_column("patients", "last_ai_contact_at")
    op.drop_column("patients", "ai_opt_out")

    # Remove conversation columns
    op.drop_column("whatsapp_conversations", "lead_service")
    op.drop_column("whatsapp_conversations", "lead_intent")
    op.drop_column("whatsapp_conversations", "lead_score")
    op.drop_column("whatsapp_conversations", "ai_opt_out")
    op.drop_column("whatsapp_conversations", "human_takeover_at")
    op.drop_column("whatsapp_conversations", "handled_by_user_id")
    op.drop_column("whatsapp_conversations", "handled_by")

    # Drop tables in reverse dependency order
    op.drop_table("knowledge_base_entries")
    op.drop_table("agent_event_logs")
    op.drop_table("agent_tasks")
    op.drop_table("orchestration_workflows")
    op.drop_table("ai_provider_credentials")
    op.drop_table("ai_agent_configs")

    # Drop enums
    for name in [
        "conversationhandler", "kbentrytype", "agenteventtype",
        "agenttasktype", "ai_triggertype", "taskstatus",
        "workflowstatus", "agentlanguage", "functionaltype", "aiprovider",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {name}")
