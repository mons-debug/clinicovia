import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.models.whatsapp import (
    WhatsAppSession,
    WhatsAppConversation,
    WhatsAppMessage,
    ConversationHandler,
    MessageDirection,
    MessageType,
    MessageStatus,
)


def _clean_phone(phone: str) -> str:
    """Strip device suffix from WhatsApp phone (e.g. '971501234567:0' → '971501234567')."""
    return phone.split(":")[0] if ":" in phone else phone


def _extract_number(jid: str) -> str:
    """Extract the pure phone number from a JID (strip device suffix and @domain)."""
    return _clean_phone(jid.split("@")[0])


def _normalize_jid(jid: str) -> str:
    """Normalize JID — strip device suffix from the number part."""
    parts = jid.split("@")
    if len(parts) == 2:
        return f"{_clean_phone(parts[0])}@{parts[1]}"
    return jid


async def get_or_create_conversation(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    session_id: uuid.UUID,
    jid: str,
    contact_name: str = "",
    contact_phone: str = "",
) -> WhatsAppConversation:
    jid = _normalize_jid(jid)
    phone_number = _extract_number(jid)
    contact_phone = _clean_phone(contact_phone) if contact_phone else phone_number

    # Match by exact JID, or by phone number in JID (handles old records with device suffix)
    result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.clinic_id == clinic_id,
            or_(
                WhatsAppConversation.jid == jid,
                WhatsAppConversation.contact_phone == phone_number,
                WhatsAppConversation.jid.like(f"{phone_number}%"),
            ),
        ).order_by(WhatsAppConversation.created_at).limit(1)
    )
    conv = result.scalar_one_or_none()

    if conv:
        # Normalize the stored JID if it was old format
        if conv.jid != jid:
            conv.jid = jid
        # A phone number can be logged out and scanned again as a new
        # WhatsAppSession. Keep the conversation history, but move the active
        # sending session forward so old chats remain visible and replyable.
        if conv.session_id != session_id:
            conv.session_id = session_id
        if conv.contact_phone != contact_phone:
            conv.contact_phone = contact_phone
        if contact_name and conv.contact_name != contact_name:
            conv.contact_name = contact_name
        await db.commit()
        return conv

    now = datetime.now(timezone.utc)
    conv = WhatsAppConversation(
        clinic_id=clinic_id,
        session_id=session_id,
        jid=jid,
        contact_name=contact_name or contact_phone,
        contact_phone=contact_phone,
        last_message="",
        last_message_at=now,
        unread_count=0,
        is_archived=False,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def list_conversations(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    session_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 50,
    patient_id: uuid.UUID | None = None,
    assigned_user_id: uuid.UUID | None = None,
    handled_by: ConversationHandler | None = None,
) -> tuple[list[WhatsAppConversation], int]:
    query = select(WhatsAppConversation).where(
        WhatsAppConversation.clinic_id == clinic_id,
    )
    if session_id:
        query = query.where(WhatsAppConversation.session_id == session_id)
    if patient_id:
        query = query.where(WhatsAppConversation.patient_id == patient_id)
    if assigned_user_id:
        query = query.where(WhatsAppConversation.handled_by_user_id == assigned_user_id)
    if handled_by:
        query = query.where(WhatsAppConversation.handled_by == handled_by)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(WhatsAppConversation.last_message_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    conversations = list(result.scalars().all())
    return conversations, total


async def get_conversation(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    clinic_id: uuid.UUID,
) -> WhatsAppConversation | None:
    result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
    )
    return result.scalar_one_or_none()


async def list_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    clinic_id: uuid.UUID,
    limit: int = 50,
) -> list[WhatsAppMessage]:
    result = await db.execute(
        select(WhatsAppMessage)
        .options(selectinload(WhatsAppMessage.reply_to))
        .where(
            WhatsAppMessage.conversation_id == conversation_id,
            WhatsAppMessage.clinic_id == clinic_id,
        )
        .order_by(WhatsAppMessage.timestamp.desc())
        .limit(limit)
    )
    messages = list(result.scalars().all())
    messages.reverse()
    return messages


async def save_inbound_message(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    session_id: uuid.UUID,
    jid: str,
    wa_message_id: str,
    content: str,
    msg_type: str = "text",
    media_url: str | None = None,
    contact_name: str = "",
    contact_phone: str = "",
    timestamp: float | None = None,
) -> tuple[WhatsAppMessage, WhatsAppConversation, bool]:
    # Check for duplicate message IDs before creating/matching a conversation.
    # WhatsApp can retry the same webhook with an older LID-shaped payload; if we
    # create the conversation first, the retry can resurrect a duplicate chat.
    existing = await db.execute(
        select(WhatsAppMessage)
        .options(selectinload(WhatsAppMessage.conversation))
        .where(WhatsAppMessage.wa_message_id == wa_message_id)
    )
    existing_msg = existing.scalar_one_or_none()
    if existing_msg and existing_msg.conversation:
        return existing_msg, existing_msg.conversation, False

    conv = await get_or_create_conversation(
        db, clinic_id, session_id, jid, contact_name, contact_phone
    )

    now = datetime.now(timezone.utc)
    msg_time = datetime.fromtimestamp(timestamp, tz=timezone.utc) if timestamp else now

    try:
        message_type = MessageType(msg_type)
    except ValueError:
        message_type = MessageType.TEXT

    msg = WhatsAppMessage(
        clinic_id=clinic_id,
        conversation_id=conv.id,
        wa_message_id=wa_message_id,
        direction=MessageDirection.INBOUND,
        type=message_type,
        content=content,
        media_url=media_url,
        status=MessageStatus.DELIVERED,
        timestamp=msg_time,
    )
    db.add(msg)

    conv.last_message = content[:200]
    conv.last_message_at = msg_time
    conv.unread_count = conv.unread_count + 1

    await db.commit()
    await db.refresh(msg)
    return msg, conv, True


async def save_outbound_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    clinic_id: uuid.UUID,
    text: str,
    wa_message_id: str = "",
    reply_to_id: uuid.UUID | None = None,
) -> WhatsAppMessage:
    now = datetime.now(timezone.utc)

    msg = WhatsAppMessage(
        clinic_id=clinic_id,
        conversation_id=conversation_id,
        wa_message_id=wa_message_id or str(uuid.uuid4()),
        direction=MessageDirection.OUTBOUND,
        type=MessageType.TEXT,
        content=text,
        status=MessageStatus.SENT,
        reply_to_id=reply_to_id,
        timestamp=now,
    )
    db.add(msg)

    await db.execute(
        update(WhatsAppConversation)
        .where(WhatsAppConversation.id == conversation_id)
        .values(
            last_message=text[:200],
            last_message_at=now,
            unread_count=0,
        )
    )

    await db.commit()
    await db.refresh(msg)
    return msg


async def mark_conversation_read(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    clinic_id: uuid.UUID,
) -> None:
    await db.execute(
        update(WhatsAppConversation)
        .where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
        .values(unread_count=0)
    )
    await db.commit()


async def transfer_conversations_to_session(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    session_id: uuid.UUID,
    phone_number: str,
) -> int:
    """Move historic conversations for the same WhatsApp number to a new session.

    This preserves history after a user logs out of WhatsApp and scans a QR
    again into a new session row.
    """
    clean_phone = _clean_phone(phone_number)
    if not clean_phone:
        return 0

    session_result = await db.execute(
        select(WhatsAppSession.id).where(
            WhatsAppSession.clinic_id == clinic_id,
            WhatsAppSession.id != session_id,
            WhatsAppSession.phone_number == clean_phone,
        )
    )
    old_session_ids = [row[0] for row in session_result.all()]
    if not old_session_ids:
        return 0

    result = await db.execute(
        update(WhatsAppConversation)
        .where(
            WhatsAppConversation.clinic_id == clinic_id,
            WhatsAppConversation.session_id.in_(old_session_ids),
        )
        .values(session_id=session_id)
    )
    await db.flush()
    return result.rowcount or 0


async def link_patient(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    patient_id: uuid.UUID,
    clinic_id: uuid.UUID,
) -> None:
    await db.execute(
        update(WhatsAppConversation)
        .where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
        .values(patient_id=patient_id)
    )
    await db.commit()


async def assign_conversation(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    clinic_id: uuid.UUID,
    assigned_user_id: uuid.UUID | None,
) -> WhatsAppConversation | None:
    result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        return None

    conv.handled_by_user_id = assigned_user_id
    if assigned_user_id:
        conv.handled_by = ConversationHandler.HUMAN
        conv.human_takeover_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(conv)
    return conv


async def merge_duplicate_conversations(db: AsyncSession) -> int:
    """Find conversations with the same phone number (ignoring device suffix) and merge them.
    Keeps the oldest conversation, moves all messages from duplicates to it, then deletes duplicates.
    Returns count of merged duplicates."""
    # Get all conversations
    result = await db.execute(select(WhatsAppConversation).order_by(WhatsAppConversation.created_at))
    all_convs = list(result.scalars().all())

    # Group by (clinic_id, clean phone number)
    groups: dict[tuple, list[WhatsAppConversation]] = {}
    for conv in all_convs:
        phone = _extract_number(conv.jid)
        key = (str(conv.clinic_id), phone)
        groups.setdefault(key, []).append(conv)

    merged_count = 0
    for key, convs in groups.items():
        if len(convs) <= 1:
            continue

        # Keep the first (oldest), merge the rest
        primary = convs[0]
        primary_jid = _normalize_jid(primary.jid)
        if primary.jid != primary_jid:
            primary.jid = primary_jid
            primary.contact_phone = _extract_number(primary_jid)

        for duplicate in convs[1:]:
            # Move all messages from duplicate to primary
            await db.execute(
                update(WhatsAppMessage)
                .where(WhatsAppMessage.conversation_id == duplicate.id)
                .values(conversation_id=primary.id)
            )

            # Keep the best contact_name (non-phone-number one)
            if duplicate.contact_name and not duplicate.contact_name.replace("+", "").isdigit():
                if primary.contact_name.replace("+", "").isdigit():
                    primary.contact_name = duplicate.contact_name

            # Keep patient_id if primary doesn't have one
            if duplicate.patient_id and not primary.patient_id:
                primary.patient_id = duplicate.patient_id

            # Update unread count
            primary.unread_count = (primary.unread_count or 0) + (duplicate.unread_count or 0)

            # Update last_message if duplicate is newer
            if duplicate.last_message_at and (
                not primary.last_message_at or duplicate.last_message_at > primary.last_message_at
            ):
                primary.last_message = duplicate.last_message
                primary.last_message_at = duplicate.last_message_at

            # Delete the duplicate conversation
            await db.delete(duplicate)
            merged_count += 1

    if merged_count > 0:
        await db.commit()

    return merged_count
