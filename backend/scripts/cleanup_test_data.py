"""Clean up test patients and their related data from the Refine clinic.

Deletes patients that are clearly test data (garbage names, wrong phones).
Keeps: Fatima Zahrae (real E2E test patient we'll keep as demo).

Run: docker compose exec -T backend python -m scripts.cleanup_test_data
"""
from __future__ import annotations
import asyncio
from sqlalchemy import select, delete
from app.database import async_session
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.billing import Invoice
from app.models.prescription import Prescription
from app.models.photo import PatientPhoto
from app.models.consultation import Consultation
from app.models.screening import PatientScreening

CLINIC_ID = "0cc8d2ca-98c3-4414-a0c2-2ed23a51e756"

# Test patients to remove (by first_name + last_name patterns)
TEST_PATTERNS = [
    ("bennassar", "mounnsif"),
    ("samir", "benasr"),
    ("mb", "kjh"),
    ("~", "(WhatsApp)"),
    ("zakaria", "lahlou"),
]


async def cleanup():
    async with async_session() as s:
        res = await s.execute(
            select(Patient).where(Patient.clinic_id == CLINIC_ID)
        )
        patients = list(res.scalars().all())

        removed = 0
        for p in patients:
            is_test = any(
                p.first_name.lower().strip() == fn.lower() and p.last_name.lower().strip() == ln.lower()
                for fn, ln in TEST_PATTERNS
            )
            if not is_test:
                print(f"  KEEP  {p.first_name} {p.last_name} ({p.id})")
                continue

            pid = p.id
            print(f"  DEL   {p.first_name} {p.last_name} ({pid})")

            # Delete related data first (FK cascades may handle some, but be explicit)
            for model in [PatientScreening, PatientPhoto, Consultation, Prescription, Invoice, Appointment]:
                await s.execute(delete(model).where(model.patient_id == pid, model.clinic_id == CLINIC_ID))

            await s.delete(p)
            removed += 1

        await s.commit()
        print(f"\nRemoved {removed} test patients. Kept {len(patients) - removed}.")


if __name__ == "__main__":
    asyncio.run(cleanup())
