import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Session schemas ──────────────────────────────────────────────

class WhatsAppSessionCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100)


class WhatsAppSessionUpdate(BaseModel):
    label: str | None = None


class WhatsAppSessionResponse(BaseModel):
    id: uuid.UUID
    label: str
    phone_number: str | None
    status: str
    connected_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WhatsAppSessionListResponse(BaseModel):
    sessions: list[WhatsAppSessionResponse]


# ── Conversation schemas ─────────────────────────────────────────

class ConversationResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    jid: str
    patient_id: uuid.UUID | None = None
    contact_name: str
    contact_phone: str
    last_message: str = ""
    last_message_at: datetime | None = None
    unread_count: int = 0
    is_archived: bool = False
    handled_by: str = "ai"
    handled_by_user_id: uuid.UUID | None = None
    human_takeover_at: datetime | None = None
    ai_opt_out: bool = False
    lead_score: int | None = None
    lead_intent: str | None = None
    lead_service: str | None = None

    model_config = {"from_attributes": True}


class ConversationListResponse(BaseModel):
    conversations: list[ConversationResponse]
    total: int


# ── Message schemas ──────────────────────────────────────────────

class ReplyToResponse(BaseModel):
    id: uuid.UUID
    content: str
    direction: str
    type: str

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    direction: str
    type: str
    content: str
    media_url: str | None = None
    status: str
    reply_to_id: uuid.UUID | None = None
    reply_to: ReplyToResponse | None = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]


# ── Request schemas ──────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    text: str = Field(min_length=1)
    reply_to_id: uuid.UUID | None = None


class StartConversationRequest(BaseModel):
    session_id: uuid.UUID
    jid: str = Field(min_length=1)
    contact_name: str = ""


class LinkPatientRequest(BaseModel):
    patient_id: uuid.UUID


class AssignConversationRequest(BaseModel):
    assigned_user_id: uuid.UUID | None = None


class TeamMemberResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    avatar_url: str | None = None


class TeamMemberListResponse(BaseModel):
    members: list[TeamMemberResponse]


# ── Webhook schemas ──────────────────────────────────────────────

class WebhookMessagePayload(BaseModel):
    clinicId: str
    sessionId: str
    jid: str
    messageId: str
    contactName: str
    contactPhone: str
    content: str
    type: str = "text"
    mediaUrl: str | None = None
    timestamp: float


class WebhookStatusPayload(BaseModel):
    sessionId: str
    clinicId: str
    status: str
    phoneNumber: str | None = None
