"""WhatsApp notification service — sends templated messages for appointment events."""

import uuid
from datetime import date, time

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.whatsapp import WhatsAppSession, WhatsAppSessionStatus, WhatsAppConversation
from app.services.whatsapp_bridge import bridge_client
from app.services.whatsapp_chat import get_or_create_conversation, save_outbound_message, _extract_number


_FR_DAYS = {0: "lundi", 1: "mardi", 2: "mercredi", 3: "jeudi", 4: "vendredi", 5: "samedi", 6: "dimanche"}
_FR_MONTHS = {1: "janvier", 2: "février", 3: "mars", 4: "avril", 5: "mai", 6: "juin",
              7: "juillet", 8: "août", 9: "septembre", 10: "octobre", 11: "novembre", 12: "décembre"}


def _format_date(d: date) -> str:
    return f"{_FR_DAYS[d.weekday()]} {d.day} {_FR_MONTHS[d.month]} {d.year}"


def _format_time(t: time) -> str:
    return t.strftime("%Hh%M")


# ── French templates (Refine clinic) ─────────────────────────────────
# 4 lifecycle templates: confirmation · reschedule · no_show · recall.
# Tone: warm, formal "vous", clinic signature on every message.
_CLINIC_SIG = "L'équipe de la clinique"


def _appointment_confirmation_msg(
    patient_name: str,
    treatment: str,
    apt_date: date,
    apt_time: time,
    doctor_name: str = "",
) -> str:
    lines = [
        f"Bonjour {patient_name},",
        "",
        f"Votre rendez-vous est confirmé :",
        f"• {treatment}",
        f"• {_format_date(apt_date)} à {_format_time(apt_time)}",
    ]
    if doctor_name:
        lines.append(f"• Avec {doctor_name}")
    lines += [
        "",
        "Merci d'arriver 10 minutes en avance.",
        "Répondez à ce message en cas d'empêchement.",
        "",
        _CLINIC_SIG,
    ]
    return "\n".join(lines)


def _appointment_reschedule_msg(
    patient_name: str,
    treatment: str,
    new_date: date,
    new_time: time,
    doctor_name: str = "",
) -> str:
    lines = [
        f"Bonjour {patient_name},",
        "",
        f"Votre rendez-vous a été reprogrammé :",
        f"• {treatment}",
        f"• {_format_date(new_date)} à {_format_time(new_time)}",
    ]
    if doctor_name:
        lines.append(f"• Avec {doctor_name}")
    lines += [
        "",
        "Merci de confirmer en répondant à ce message.",
        "",
        _CLINIC_SIG,
    ]
    return "\n".join(lines)


def _appointment_no_show_msg(
    patient_name: str,
    treatment: str,
    apt_date: date,
    apt_time: time,
) -> str:
    return (
        f"Bonjour {patient_name},\n\n"
        f"Nous vous attendions {_format_date(apt_date)} à {_format_time(apt_time)} "
        f"pour {treatment}.\n\n"
        f"N'hésitez pas à nous recontacter pour reprogrammer votre visite.\n\n"
        f"{_CLINIC_SIG}"
    )


def _appointment_recall_msg(
    patient_name: str,
    treatment: str,
) -> str:
    return (
        f"Bonjour {patient_name},\n\n"
        f"Quelques jours après votre {treatment}, nous voulions prendre de vos nouvelles.\n"
        f"Comment vous sentez-vous ?\n\n"
        f"Pour toute question ou pour planifier la suite, répondez simplement à ce message.\n\n"
        f"{_CLINIC_SIG}"
    )


def _appointment_reminder_msg(
    patient_name: str,
    treatment: str,
    apt_date: date,
    apt_time: time,
    doctor_name: str = "",
) -> str:
    lines = [
        f"Bonjour {patient_name},",
        "",
        f"Petit rappel — votre rendez-vous est demain :",
        f"• {treatment}",
        f"• {_format_date(apt_date)} à {_format_time(apt_time)}",
    ]
    if doctor_name:
        lines.append(f"• Avec {doctor_name}")
    lines += [
        "",
        "Répondez OUI pour confirmer ou REPROGRAMMER pour modifier.",
        "",
        _CLINIC_SIG,
    ]
    return "\n".join(lines)


def _appointment_cancelled_msg(patient_name: str, treatment: str, apt_date: date) -> str:
    return (
        f"Bonjour {patient_name},\n\n"
        f"Votre rendez-vous pour {treatment} du {_format_date(apt_date)} a été annulé.\n\n"
        f"Merci de nous contacter pour reprogrammer.\n\n"
        f"{_CLINIC_SIG}"
    )


def _status_update_msg(patient_name: str, treatment: str, new_status: str) -> str:
    status_labels = {
        "confirmed": "est confirmé",
        "checked_in": "— vous êtes enregistré(e)",
        "completed": "est terminé. Merci de votre confiance !",
    }
    label = status_labels.get(new_status, f"a été mis à jour ({new_status})")
    return f"Bonjour {patient_name},\n\nVotre rendez-vous pour {treatment} {label}.\n\n{_CLINIC_SIG}"


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


async def notify_appointment_rescheduled(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    patient_name: str,
    treatment: str,
    new_date: date,
    new_time: time,
    doctor_name: str = "",
) -> bool:
    msg = _appointment_reschedule_msg(patient_name, treatment, new_date, new_time, doctor_name)
    return await send_appointment_whatsapp(db, clinic_id, patient_id, msg)


async def notify_appointment_no_show(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    patient_name: str,
    treatment: str,
    apt_date: date,
    apt_time: time,
) -> bool:
    msg = _appointment_no_show_msg(patient_name, treatment, apt_date, apt_time)
    return await send_appointment_whatsapp(db, clinic_id, patient_id, msg)


async def notify_appointment_recall(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    patient_name: str,
    treatment: str,
) -> bool:
    """J+15-style recall — fire when the doctor wants to check in
    on a patient post-treatment."""
    msg = _appointment_recall_msg(patient_name, treatment)
    return await send_appointment_whatsapp(db, clinic_id, patient_id, msg)


# ── Template preview (no send) ────────────────────────────────────────
# Lets the UI show the doctor what will be sent before pushing.

def render_template(
    template: str,
    patient_name: str,
    treatment: str,
    apt_date: date | None = None,
    apt_time: time | None = None,
    doctor_name: str = "",
) -> str:
    """Render any of the 5 templates without sending.

    Returns the FR copy that would land on the patient's WhatsApp.
    Raises ValueError on unknown template name.
    """
    if template == "confirmation" and apt_date and apt_time:
        return _appointment_confirmation_msg(patient_name, treatment, apt_date, apt_time, doctor_name)
    if template == "reschedule" and apt_date and apt_time:
        return _appointment_reschedule_msg(patient_name, treatment, apt_date, apt_time, doctor_name)
    if template == "no_show" and apt_date and apt_time:
        return _appointment_no_show_msg(patient_name, treatment, apt_date, apt_time)
    if template == "recall":
        return _appointment_recall_msg(patient_name, treatment)
    if template == "reminder" and apt_date and apt_time:
        return _appointment_reminder_msg(patient_name, treatment, apt_date, apt_time, doctor_name)
    raise ValueError(f"Unknown or under-specified template: {template}")
