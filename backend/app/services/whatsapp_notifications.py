"""WhatsApp notification service — sends templated messages for appointment events."""

import uuid
from datetime import date, time

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.whatsapp import WhatsAppSession, WhatsAppSessionStatus, WhatsAppConversation
from app.services.whatsapp_bridge import bridge_client
from app.services.whatsapp_chat import get_or_create_conversation, save_outbound_message, _extract_number


def _format_date(d: date) -> str:
    return d.strftime("%A, %B %d, %Y")


def _format_time(t: time) -> str:
    return t.strftime("%I:%M %p")


def _appointment_confirmation_msg(
    patient_name: str,
    treatment: str,
    apt_date: date,
    apt_time: time,
    doctor_name: str = "",
) -> str:
    lines = [
        f"Hi {patient_name},",
        "",
        f"Your appointment has been confirmed:",
        "",
        f"Treatment: {treatment}",
        f"Date: {_format_date(apt_date)}",
        f"Time: {_format_time(apt_time)}",
    ]
    if doctor_name:
        lines.append(f"Doctor: {doctor_name}")
    lines += [
        "",
        "Please arrive 10 minutes early.",
        "Reply to this message if you need to reschedule.",
    ]
    return "\n".join(lines)


def _appointment_reminder_msg(
    patient_name: str,
    treatment: str,
    apt_date: date,
    apt_time: time,
    doctor_name: str = "",
) -> str:
    lines = [
        f"Hi {patient_name},",
        "",
        f"Reminder: You have an appointment tomorrow.",
        "",
        f"Treatment: {treatment}",
        f"Date: {_format_date(apt_date)}",
        f"Time: {_format_time(apt_time)}",
    ]
    if doctor_name:
        lines.append(f"Doctor: {doctor_name}")
    lines += [
        "",
        "Reply YES to confirm or RESCHEDULE to change.",
    ]
    return "\n".join(lines)


def _appointment_cancelled_msg(patient_name: str, treatment: str, apt_date: date) -> str:
    return (
        f"Hi {patient_name},\n\n"
        f"Your appointment for {treatment} on {_format_date(apt_date)} has been cancelled.\n\n"
        f"Please contact us to reschedule."
    )


def _status_update_msg(patient_name: str, treatment: str, new_status: str) -> str:
    status_labels = {
        "confirmed": "has been confirmed",
        "checked_in": "- you are checked in",
        "completed": "is now completed. Thank you for visiting us!",
    }
    label = status_labels.get(new_status, f"status updated to {new_status}")
    return f"Hi {patient_name},\n\nYour appointment for {treatment} {label}"


async def send_appointment_whatsapp(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    message: str,
) -> bool:
    """Send a WhatsApp message to a patient. Returns True if sent."""
    # Find patient
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient or not patient.phone:
        return False

    # Find a connected session
    session_result = await db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.clinic_id == clinic_id,
            WhatsAppSession.is_active == True,  # noqa: E712
            WhatsAppSession.status == WhatsAppSessionStatus.CONNECTED,
        ).limit(1)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        return False

    # Build JID from patient phone
    phone = f"{patient.phone_country_code}{patient.phone}".replace("+", "").replace(" ", "").replace("-", "")
    jid = f"{phone}@s.whatsapp.net"

    # Get or create conversation
    conv = await get_or_create_conversation(
        db, clinic_id, session.id, jid,
        contact_name=f"{patient.first_name} {patient.last_name}",
        contact_phone=phone,
    )

    # Link patient if not already linked
    if not conv.patient_id:
        conv.patient_id = patient.id
        if not patient.whatsapp_id:
            patient.whatsapp_id = jid
        await db.commit()

    # Send via bridge
    try:
        result = await bridge_client.send_message(str(session.id), jid, message)
        wa_message_id = result.get("messageId", "")
    except Exception:
        return False

    # Save to DB
    await save_outbound_message(
        db,
        conversation_id=conv.id,
        clinic_id=clinic_id,
        text=message,
        wa_message_id=wa_message_id,
    )

    return True


async def notify_appointment_created(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    patient_name: str,
    treatment: str,
    apt_date: date,
    apt_time: time,
    doctor_name: str = "",
) -> bool:
    msg = _appointment_confirmation_msg(patient_name, treatment, apt_date, apt_time, doctor_name)
    return await send_appointment_whatsapp(db, clinic_id, patient_id, msg)


async def notify_appointment_status(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    patient_name: str,
    treatment: str,
    new_status: str,
    apt_date: date | None = None,
) -> bool:
    if new_status == "cancelled" and apt_date:
        msg = _appointment_cancelled_msg(patient_name, treatment, apt_date)
    elif new_status in ("confirmed", "checked_in", "completed"):
        msg = _status_update_msg(patient_name, treatment, new_status)
    else:
        return False
    return await send_appointment_whatsapp(db, clinic_id, patient_id, msg)


async def notify_appointment_reminder(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    patient_name: str,
    treatment: str,
    apt_date: date,
    apt_time: time,
    doctor_name: str = "",
) -> bool:
    msg = _appointment_reminder_msg(patient_name, treatment, apt_date, apt_time, doctor_name)
    return await send_appointment_whatsapp(db, clinic_id, patient_id, msg)
