import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.clinic import ClinicMembership
from app.models.patient import Patient
from app.models.whatsapp import (
    ConversationHandler,
    WhatsAppSession,
    WhatsAppSessionStatus,
    WhatsAppConversation,
    WhatsAppMessage,
)
from app.schemas.whatsapp import (
    WhatsAppSessionCreate,
    WhatsAppSessionResponse,
    WhatsAppSessionListResponse,
    ConversationResponse,
    ConversationListResponse,
    MessageResponse,
    MessageListResponse,
    ReplyToResponse,
    SendMessageRequest,
    StartConversationRequest,
    LinkPatientRequest,
    AssignConversationRequest,
    TeamMemberResponse,
    TeamMemberListResponse,
    WebhookMessagePayload,
    WebhookStatusPayload,
)
from app.middleware.auth import get_current_user
from app.services.whatsapp_bridge import bridge_client
from app.services import whatsapp_chat
from app.services.cache import cache_delete_pattern, cache_get_json, cache_set_json

router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _conv_to_response(conv: WhatsAppConversation) -> ConversationResponse:
    return ConversationResponse(
        id=conv.id,
        session_id=conv.session_id,
        jid=conv.jid,
        patient_id=conv.patient_id,
        contact_name=conv.contact_name,
        contact_phone=conv.contact_phone,
        last_message=conv.last_message,
        last_message_at=conv.last_message_at,
        unread_count=conv.unread_count,
        is_archived=conv.is_archived,
        handled_by=conv.handled_by.value if hasattr(conv.handled_by, "value") else str(conv.handled_by),
        handled_by_user_id=conv.handled_by_user_id,
        human_takeover_at=conv.human_takeover_at,
        ai_opt_out=conv.ai_opt_out,
        lead_score=conv.lead_score,
        lead_intent=conv.lead_intent,
        lead_service=conv.lead_service,
    )


def _msg_to_response(msg) -> MessageResponse:
    reply_to = None
    if msg.reply_to:
        reply_to = ReplyToResponse(
            id=msg.reply_to.id,
            content=msg.reply_to.content[:100],
            direction=msg.reply_to.direction.value if hasattr(msg.reply_to.direction, "value") else str(msg.reply_to.direction),
            type=msg.reply_to.type.value if hasattr(msg.reply_to.type, "value") else str(msg.reply_to.type),
        )
    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        direction=msg.direction.value if hasattr(msg.direction, "value") else str(msg.direction),
        type=msg.type.value if hasattr(msg.type, "value") else str(msg.type),
        content=msg.content,
        media_url=msg.media_url,
        status=msg.status.value if hasattr(msg.status, "value") else str(msg.status),
        reply_to_id=msg.reply_to_id,
        reply_to=reply_to,
        timestamp=msg.timestamp,
    )


def _cache_key(*parts: object) -> str:
    return ":".join(str(part) if part is not None else "all" for part in parts)


async def _invalidate_conversation_cache(
    clinic_id: uuid.UUID,
    conversation_id: uuid.UUID | None = None,
) -> None:
    await cache_delete_pattern(f"wa:{clinic_id}:conversations:*")
    if conversation_id:
        await cache_delete_pattern(f"wa:{clinic_id}:messages:{conversation_id}:*")
        await cache_delete_pattern(f"wa:{clinic_id}:conversation:{conversation_id}")
    else:
        await cache_delete_pattern(f"wa:{clinic_id}:conversation:*")
        await cache_delete_pattern(f"wa:{clinic_id}:messages:*")


async def _cache_conversation_snapshot(
    clinic_id: uuid.UUID,
    conv: WhatsAppConversation,
) -> ConversationResponse:
    response = _conv_to_response(conv)
    await cache_set_json(
        _cache_key("wa", clinic_id, "conversation", conv.id),
        response.model_dump(mode="json"),
        ttl_seconds=300,
    )
    return response


# ── Sessions ─────────────────────────────────────────────────────

@router.get("/sessions", response_model=WhatsAppSessionListResponse)
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.clinic_id == clinic_id,
            WhatsAppSession.is_active == True,  # noqa: E712
        ).order_by(WhatsAppSession.created_at)
    )
    sessions = result.scalars().all()
    return {"sessions": [WhatsAppSessionResponse.model_validate(s) for s in sessions]}


@router.post("/sessions", response_model=WhatsAppSessionResponse, status_code=201)
async def create_session(
    body: WhatsAppSessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    session = WhatsAppSession(
        clinic_id=clinic_id,
        label=body.label,
        status=WhatsAppSessionStatus.CONNECTING,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    try:
        await bridge_client.start_session(str(session.id), str(clinic_id))
    except Exception:
        session.status = WhatsAppSessionStatus.DISCONNECTED
        await db.commit()

    return WhatsAppSessionResponse.model_validate(session)


@router.get("/sessions/{session_id}", response_model=WhatsAppSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.id == session_id,
            WhatsAppSession.clinic_id == clinic_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return WhatsAppSessionResponse.model_validate(session)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.id == session_id,
            WhatsAppSession.clinic_id == clinic_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        await bridge_client.stop_session(str(session_id))
    except Exception:
        pass

    session.is_active = False
    session.status = WhatsAppSessionStatus.DISCONNECTED
    await db.commit()


@router.post("/sessions/{session_id}/reconnect", response_model=WhatsAppSessionResponse)
async def reconnect_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.id == session_id,
            WhatsAppSession.clinic_id == clinic_id,
            WhatsAppSession.is_active == True,  # noqa: E712
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = WhatsAppSessionStatus.CONNECTING
    await db.commit()

    try:
        await bridge_client.start_session(str(session.id), str(clinic_id))
    except Exception:
        session.status = WhatsAppSessionStatus.DISCONNECTED
        await db.commit()

    await db.refresh(session)
    return WhatsAppSessionResponse.model_validate(session)


@router.post("/check-number")
async def check_whatsapp_number(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a phone number is registered on WhatsApp."""
    clinic_id = _get_clinic_id(user)
    body = await request.json()
    phone = body.get("phone", "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="phone is required")

    # Find a connected session for this clinic
    result = await db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.clinic_id == clinic_id,
            WhatsAppSession.is_active == True,  # noqa: E712
            WhatsAppSession.status == WhatsAppSessionStatus.CONNECTED,
        ).limit(1)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=400, detail="No connected WhatsApp session")

    try:
        data = await bridge_client.check_whatsapp(str(session.id), phone)
        return {"exists": data.get("exists", False), "jid": data.get("jid")}
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to check number")


# ── Conversations ────────────────────────────────────────────────

@router.get("/team-members", response_model=TeamMemberListResponse)
async def list_team_members(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(ClinicMembership, User)
        .join(User, ClinicMembership.user_id == User.id)
        .where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.is_active == True,  # noqa: E712
            User.is_active == True,  # noqa: E712
        )
        .order_by(User.first_name, User.last_name)
    )
    return {
        "members": [
            TeamMemberResponse(
                id=member.id,
                name=f"{member.first_name} {member.last_name}".strip() or member.email,
                email=member.email,
                role=membership.role.value if hasattr(membership.role, "value") else str(membership.role),
                avatar_url=member.avatar_url,
            )
            for membership, member in result.all()
        ]
    }


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    session_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
    assigned_user_id: uuid.UUID | None = None,
    handled_by: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    handler_filter = None
    if handled_by:
        try:
            handler_filter = ConversationHandler(handled_by)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid handled_by")

    cache_key = _cache_key(
        "wa",
        clinic_id,
        "conversations",
        session_id,
        patient_id,
        assigned_user_id,
        handled_by,
        page,
        page_size,
    )
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached

    conversations, total = await whatsapp_chat.list_conversations(
        db,
        clinic_id,
        session_id,
        page,
        page_size,
        patient_id=patient_id,
        assigned_user_id=assigned_user_id,
        handled_by=handler_filter,
    )
    response = {
        "conversations": [_conv_to_response(c) for c in conversations],
        "total": total,
    }
    await cache_set_json(
        cache_key,
        {
            "conversations": [
                item.model_dump(mode="json") for item in response["conversations"]
            ],
            "total": response["total"],
        },
        ttl_seconds=20,
    )
    return response


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    cache_key = _cache_key("wa", clinic_id, "conversation", conversation_id)
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached

    conv = await whatsapp_chat.get_conversation(db, conversation_id, clinic_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return await _cache_conversation_snapshot(clinic_id, conv)


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
async def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    conv = await whatsapp_chat.get_conversation(db, conversation_id, clinic_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    cache_key = _cache_key("wa", clinic_id, "messages", conversation_id, limit)
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return cached

    messages = await whatsapp_chat.list_messages(db, conversation_id, clinic_id, limit=limit)
    response = {"messages": [_msg_to_response(m) for m in messages]}
    await cache_set_json(
        cache_key,
        {"messages": [item.model_dump(mode="json") for item in response["messages"]]},
        ttl_seconds=20,
    )
    return response


@router.post("/conversations/{conversation_id}/send", response_model=MessageResponse)
async def send_message(
    conversation_id: uuid.UUID,
    body: SendMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    conv = await whatsapp_chat.get_conversation(db, conversation_id, clinic_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    session_result = await db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.id == conv.session_id,
            WhatsAppSession.clinic_id == clinic_id,
        )
    )
    send_session = session_result.scalar_one_or_none()
    if not send_session or send_session.status != WhatsAppSessionStatus.CONNECTED:
        old_phone_number = send_session.phone_number if send_session else None
        active_result = await db.execute(
            select(WhatsAppSession)
            .where(
                WhatsAppSession.clinic_id == clinic_id,
                WhatsAppSession.is_active == True,  # noqa: E712
                WhatsAppSession.status == WhatsAppSessionStatus.CONNECTED,
                *(
                    [WhatsAppSession.phone_number == old_phone_number]
                    if old_phone_number
                    else []
                ),
            )
            .order_by(WhatsAppSession.connected_at.desc().nullslast())
            .limit(1)
        )
        send_session = active_result.scalar_one_or_none()
        if not send_session and old_phone_number:
            active_result = await db.execute(
                select(WhatsAppSession)
                .where(
                    WhatsAppSession.clinic_id == clinic_id,
                    WhatsAppSession.is_active == True,  # noqa: E712
                    WhatsAppSession.status == WhatsAppSessionStatus.CONNECTED,
                )
                .order_by(WhatsAppSession.connected_at.desc().nullslast())
                .limit(1)
            )
            send_session = active_result.scalar_one_or_none()
        if not send_session:
            raise HTTPException(status_code=400, detail="No connected WhatsApp session")
        conv.session_id = send_session.id
        await db.commit()

    # A manual staff reply is a human takeover. Keep the AI and inbox state in
    # sync so pending automated responses do not race with the team.
    if conv.handled_by != ConversationHandler.HUMAN or not conv.handled_by_user_id:
        conv.handled_by = ConversationHandler.HUMAN
        conv.handled_by_user_id = user.id
        conv.human_takeover_at = datetime.now(timezone.utc)
        try:
            from app.services.ai.orchestrator import cancel_pending_tasks_for_conversation
            await cancel_pending_tasks_for_conversation(db, conversation_id)
        except Exception:
            pass
        await db.commit()

    # Look up the original WA message ID if replying
    quoted_wa_id: str | None = None
    if body.reply_to_id:
        reply_result = await db.execute(
            select(WhatsAppMessage).where(WhatsAppMessage.id == body.reply_to_id)
        )
        reply_msg = reply_result.scalar_one_or_none()
        if reply_msg:
            quoted_wa_id = reply_msg.wa_message_id

    try:
        result = await bridge_client.send_message(str(send_session.id), conv.jid, body.text, quoted_wa_id)
        wa_message_id = result.get("messageId", "")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to send message: {str(e)}")

    msg = await whatsapp_chat.save_outbound_message(
        db,
        conversation_id=conversation_id,
        clinic_id=clinic_id,
        text=body.text,
        wa_message_id=wa_message_id,
        reply_to_id=body.reply_to_id,
    )
    await _invalidate_conversation_cache(clinic_id, conversation_id)
    return _msg_to_response(msg)


@router.patch("/conversations/{conversation_id}/assignment", response_model=ConversationResponse)
async def assign_conversation(
    conversation_id: uuid.UUID,
    body: AssignConversationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    if body.assigned_user_id:
        member_result = await db.execute(
            select(ClinicMembership).where(
                ClinicMembership.clinic_id == clinic_id,
                ClinicMembership.user_id == body.assigned_user_id,
                ClinicMembership.is_active == True,  # noqa: E712
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Team member not found")

    conv = await whatsapp_chat.assign_conversation(
        db,
        conversation_id=conversation_id,
        clinic_id=clinic_id,
        assigned_user_id=body.assigned_user_id,
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.assigned_user_id:
        try:
            from app.services.ai.orchestrator import cancel_pending_tasks_for_conversation
            await cancel_pending_tasks_for_conversation(db, conversation_id)
            await db.commit()
            await db.refresh(conv)
        except Exception:
            pass

    await _invalidate_conversation_cache(clinic_id, conversation_id)
    return await _cache_conversation_snapshot(clinic_id, conv)


@router.post("/conversations/{conversation_id}/read", status_code=204)
async def mark_read(
    conversation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    await whatsapp_chat.mark_conversation_read(db, conversation_id, clinic_id)
    await _invalidate_conversation_cache(clinic_id, conversation_id)


@router.post("/conversations/{conversation_id}/link-patient", response_model=ConversationResponse)
async def link_patient(
    conversation_id: uuid.UUID,
    body: LinkPatientRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(Patient).where(
            Patient.id == body.patient_id,
            Patient.clinic_id == clinic_id,
            Patient.is_active == True,  # noqa: E712
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    conv = await whatsapp_chat.get_conversation(db, conversation_id, clinic_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await whatsapp_chat.link_patient(db, conversation_id, body.patient_id, clinic_id)

    if not patient.whatsapp_id:
        patient.whatsapp_id = conv.jid
        await db.commit()

    await db.refresh(conv)
    await _invalidate_conversation_cache(clinic_id, conversation_id)
    return await _cache_conversation_snapshot(clinic_id, conv)


@router.post("/conversations/start", response_model=ConversationResponse)
async def start_conversation(
    body: StartConversationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.id == body.session_id,
            WhatsAppSession.clinic_id == clinic_id,
            WhatsAppSession.is_active == True,  # noqa: E712
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    contact_phone = body.jid.split("@")[0]
    conv = await whatsapp_chat.get_or_create_conversation(
        db,
        clinic_id=clinic_id,
        session_id=body.session_id,
        jid=body.jid,
        contact_name=body.contact_name or contact_phone,
        contact_phone=contact_phone,
    )
    await _invalidate_conversation_cache(clinic_id, conv.id)
    return await _cache_conversation_snapshot(clinic_id, conv)


# ── Webhooks (bridge → backend, no JWT auth, uses secret header) ─

@router.post("/webhook/message", status_code=200)
async def webhook_message(
    payload: WebhookMessagePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    secret = request.headers.get("x-bridge-secret")
    if secret != settings.whatsapp_bridge_secret:
        raise HTTPException(status_code=401, detail="Invalid bridge secret")

    try:
        clinic_id = uuid.UUID(payload.clinicId)
        session_id = uuid.UUID(payload.sessionId)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid clinicId or sessionId")

    # Reject non-personal JIDs (groups, newsletters, status broadcasts, etc.).
    # Accept classic phone JIDs (@s.whatsapp.net) and new privacy LIDs (@lid).
    if not (payload.jid.endswith("@s.whatsapp.net") or payload.jid.endswith("@lid")):
        return {"status": "skipped", "reason": "not a personal chat JID"}

    # Normalize JID — strip device suffix
    clean_jid = payload.jid
    jid_parts = clean_jid.split("@")
    if len(jid_parts) == 2 and ":" in jid_parts[0]:
        clean_jid = f"{jid_parts[0].split(':')[0]}@{jid_parts[1]}"

    clean_phone = payload.contactPhone.split(":")[0] if ":" in payload.contactPhone else payload.contactPhone

    # Reject obviously invalid phones. For LID-based JIDs the "phone" may actually be
    # an opaque LID identifier — skip the length check in that case.
    is_lid = payload.jid.endswith("@lid")
    if not is_lid and len(clean_phone) < 10:
        return {"status": "skipped", "reason": "phone number too short"}

    msg, conv, is_new_message = await whatsapp_chat.save_inbound_message(
        db,
        clinic_id=clinic_id,
        session_id=session_id,
        jid=clean_jid,
        wa_message_id=payload.messageId,
        content=payload.content,
        msg_type=payload.type,
        media_url=payload.mediaUrl,
        contact_name=payload.contactName,
        contact_phone=clean_phone,
        timestamp=payload.timestamp,
    )
    await _invalidate_conversation_cache(clinic_id, conv.id)

    # Auto-link patient
    jid_number = clean_jid.split("@")[0]
    try:
        result = await db.execute(
            select(Patient).where(
                Patient.clinic_id == clinic_id,
                Patient.is_active == True,  # noqa: E712
                or_(
                    Patient.phone == jid_number,
                    Patient.phone.endswith(jid_number[-9:]),
                    Patient.whatsapp_id == payload.jid,
                ),
            ).limit(1)
        )
        patient = result.scalar_one_or_none()
        if patient and not conv.patient_id:
            await whatsapp_chat.link_patient(db, conv.id, patient.id, clinic_id)
            if not patient.whatsapp_id:
                patient.whatsapp_id = payload.jid
                await db.commit()
    except Exception:
        pass

    # Fire conversion tracking "Lead" event for new conversations (best effort)
    try:
        from sqlalchemy import select as sel2, func as fn2
        from app.models.whatsapp import WhatsAppMessage as WM2
        msg_count = (await db.execute(
            sel2(fn2.count()).select_from(WM2).where(WM2.conversation_id == conv.id)
        )).scalar_one()
        if is_new_message and msg_count <= 1:
            from app.services.tracking_hooks import on_whatsapp_new_conversation
            await on_whatsapp_new_conversation(db, clinic_id, conv.id, patient_id=conv.patient_id)
    except Exception:
        pass

    # Cancel any stale pending follow-up workflows for this conversation —
    # the lead just replied, so prior scheduled follow-ups are no longer needed.
    # Done BEFORE dispatching the new orchestration so we don't kill the fresh workflow.
    if is_new_message:
        try:
            from app.services.ai.orchestrator import cancel_pending_tasks_for_conversation
            await cancel_pending_tasks_for_conversation(db, conv.id)
            await db.commit()
        except Exception:
            pass

    # Dispatch AI orchestration workflow for the inbound message (best effort)
    if is_new_message:
        try:
            from app.services.ai_hooks import on_new_whatsapp_message
            wf_id = await on_new_whatsapp_message(
                db,
                clinic_id=clinic_id,
                message_id=msg.id,
                conversation=conv,
                message_content=payload.content,
                patient_id=conv.patient_id,
            )
            print(f"[ai_hooks] conv={conv.id} dispatched workflow={wf_id}")
        except Exception as e:
            import traceback
            print(f"[ai_hooks] DISPATCH FAILED for conv={conv.id}: {e}")
            traceback.print_exc()
    else:
        print(f"[ai_hooks] conv={conv.id} skipped duplicate webhook message={payload.messageId}")

    await _cache_conversation_snapshot(clinic_id, conv)
    return {"status": "ok"}


@router.post("/webhook/status", status_code=200)
async def webhook_status(
    payload: WebhookStatusPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    secret = request.headers.get("x-bridge-secret")
    if secret != settings.whatsapp_bridge_secret:
        raise HTTPException(status_code=401, detail="Invalid bridge secret")

    try:
        session_id = uuid.UUID(payload.sessionId)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid sessionId")

    result = await db.execute(
        select(WhatsAppSession).where(WhatsAppSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return {"status": "ok", "detail": "Session not found in DB"}

    status_map = {
        "connecting": WhatsAppSessionStatus.CONNECTING,
        "qr": WhatsAppSessionStatus.QR,
        "connected": WhatsAppSessionStatus.CONNECTED,
        "disconnected": WhatsAppSessionStatus.DISCONNECTED,
    }
    new_status = status_map.get(payload.status)
    if new_status:
        session.status = new_status

    if payload.status == "connected":
        session.connected_at = datetime.now(timezone.utc)
        if payload.phoneNumber:
            session.phone_number = payload.phoneNumber.split(":")[0]
            try:
                moved = await whatsapp_chat.transfer_conversations_to_session(
                    db,
                    clinic_id=session.clinic_id,
                    session_id=session.id,
                    phone_number=session.phone_number,
                )
                if moved:
                    await _invalidate_conversation_cache(session.clinic_id)
            except Exception:
                pass

    await db.commit()
    return {"status": "ok"}
