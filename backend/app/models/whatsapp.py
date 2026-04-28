import uuid
from enum import Enum as PyEnum
from datetime import datetime

from sqlalchemy import String, Enum, Boolean, DateTime, Integer, Text, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, TenantMixin


def _pg_enum(enum_cls):
    """Match postgres native enums created from .value (lowercase) strings."""
    return Enum(
        enum_cls,
        values_callable=lambda e: [m.value for m in e],
        native_enum=True,
    )


class ConversationHandler(str, PyEnum):
    AI = "ai"
    HUMAN = "human"
    PAUSED = "paused"


class WhatsAppSessionStatus(str, PyEnum):
    CONNECTING = "connecting"
    QR = "qr"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"


class WhatsAppSession(Base, TimestampMixin, TenantMixin):
    __tablename__ = "whatsapp_sessions"
    __table_args__ = (
        Index("ix_whatsapp_sessions_clinic_status", "clinic_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[WhatsAppSessionStatus] = mapped_column(
        _pg_enum(WhatsAppSessionStatus), default=WhatsAppSessionStatus.DISCONNECTED
    )
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    conversations: Mapped[list["WhatsAppConversation"]] = relationship(back_populates="session")


class WhatsAppConversation(Base, TimestampMixin, TenantMixin):
    __tablename__ = "whatsapp_conversations"
    __table_args__ = (
        Index("ix_wa_conv_clinic_session_last", "clinic_id", "session_id", "last_message_at"),
        Index("ix_wa_conv_patient", "patient_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("whatsapp_sessions.id", ondelete="CASCADE"), nullable=False
    )
    jid: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True
    )
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    contact_phone: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    last_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unread_count: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    # AI orchestration fields
    handled_by: Mapped[ConversationHandler] = mapped_column(
        _pg_enum(ConversationHandler), default=ConversationHandler.AI
    )
    handled_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    human_takeover_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ai_opt_out: Mapped[bool] = mapped_column(Boolean, default=False)
    # Per-conversation agent allowlist (persona_id strings). NULL = inherit clinic defaults.
    # Empty list = all agents disabled on this conversation.
    enabled_agents: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    lead_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lead_intent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lead_service: Mapped[str | None] = mapped_column(String(100), nullable=True)

    session: Mapped["WhatsAppSession"] = relationship(back_populates="conversations")
    messages: Mapped[list["WhatsAppMessage"]] = relationship(back_populates="conversation")


class MessageDirection(str, PyEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageType(str, PyEnum):
    TEXT = "text"
    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    VIDEO = "video"


class MessageStatus(str, PyEnum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class WhatsAppMessage(Base, TenantMixin):
    __tablename__ = "whatsapp_messages"
    __table_args__ = (
        Index("ix_wa_msg_conv_timestamp", "conversation_id", "timestamp"),
        Index("ix_wa_msg_message_id", "wa_message_id", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("whatsapp_conversations.id", ondelete="CASCADE"), nullable=False
    )
    wa_message_id: Mapped[str] = mapped_column(String(100), nullable=False)
    direction: Mapped[MessageDirection] = mapped_column(_pg_enum(MessageDirection), nullable=False)
    type: Mapped[MessageType] = mapped_column(_pg_enum(MessageType), default=MessageType.TEXT)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    media_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[MessageStatus] = mapped_column(_pg_enum(MessageStatus), default=MessageStatus.SENT)
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("whatsapp_messages.id", ondelete="SET NULL"), nullable=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )

    conversation: Mapped["WhatsAppConversation"] = relationship(back_populates="messages")
    reply_to: Mapped["WhatsAppMessage | None"] = relationship(remote_side="WhatsAppMessage.id")
