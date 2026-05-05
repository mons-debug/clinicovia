"""
Billing API — invoices (factures) + payments.

Issuance flow:
  POST   /invoices              create draft (no number yet)
  POST   /invoices/:id/issue    locks number FAC-YYYY-NNNN, status=issued
  POST   /invoices/:id/payments record a payment, recompute total_paid
                                + status (partial / paid)
  POST   /invoices/:id/cancel   cancel an issued invoice (keeps number,
                                status=cancelled)
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.billing import (
    Invoice,
    InvoiceCounter,
    InvoiceStatus,
    Payment,
    PaymentKind,
    PaymentMethod,
)
from app.models.clinic import Clinic
from app.models.patient import Patient
from app.models.user import User
from app.services.pdf import render_invoice_pdf
from app.schemas.billing import (
    CancelRequest,
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceUpdate,
    PaymentCreate,
    PaymentResponse,
)


router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _round2(x: float) -> float:
    return round(float(x), 2)


def _compute_totals(line_items: list[dict], discount: float, tva_rate: float) -> tuple[float, float, float]:
    subtotal = sum(li.get("quantity", 1) * li.get("unit_price", 0) for li in line_items)
    subtotal = _round2(subtotal)
    after_discount = max(0.0, subtotal - (discount or 0.0))
    tva = _round2(after_discount * (tva_rate or 0.0) / 100.0)
    total = _round2(after_discount + tva)
    return subtotal, tva, total


async def _next_invoice_number(db: AsyncSession, clinic_id: uuid.UUID, year: int) -> str:
    """SELECT ... FOR UPDATE the counter row (or insert it), then bump.

    Run inside the caller's transaction so the increment is atomic.
    """
    res = await db.execute(
        select(InvoiceCounter)
        .where(InvoiceCounter.clinic_id == clinic_id, InvoiceCounter.year == year)
        .with_for_update()
    )
    counter = res.scalar_one_or_none()
    if counter is None:
        counter = InvoiceCounter(clinic_id=clinic_id, year=year, last_number=0)
        db.add(counter)
        await db.flush()

    counter.last_number += 1
    seq = counter.last_number
    return f"FAC-{year}-{seq:04d}"


# ---------- Listing -----------------------------------------------------

@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    patient_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.clinic_id == clinic_id)
        .order_by(Invoice.created_at.desc())
    )
    if patient_id is not None:
        stmt = stmt.where(Invoice.patient_id == patient_id)
    if status_filter is not None:
        try:
            stmt = stmt.where(Invoice.status == InvoiceStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status: {status_filter}")

    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    return InvoiceListResponse(
        invoices=[InvoiceResponse.model_validate(r) for r in rows],
        total=len(rows),
    )


# ---------- Create draft ------------------------------------------------

@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Validate patient
    pres = await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == clinic_id)
    )
    if not pres.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    line_items_json = [
        {"label": li.label, "quantity": li.quantity, "unit_price": li.unit_price,
         "total": _round2(li.quantity * li.unit_price)}
        for li in body.line_items
    ]
    subtotal, tva, total = _compute_totals(line_items_json, body.discount, body.tva_rate)

    inv = Invoice(
        clinic_id=clinic_id,
        patient_id=body.patient_id,
        plan_id=body.plan_id,
        session_id=body.session_id,
        issued_by=user.id,
        number=f"DRAFT-{uuid.uuid4().hex[:8].upper()}",  # placeholder until issued
        issue_date=body.issue_date or date.today(),
        line_items=line_items_json,
        subtotal=subtotal,
        discount=_round2(body.discount or 0.0),
        tva_rate=body.tva_rate or 0.0,
        tva=tva,
        total=total,
        total_paid=0.0,
        currency=body.currency or "MAD",
        status=InvoiceStatus.DRAFT,
        notes=body.notes,
    )
    db.add(inv)
    await db.commit()

    res = await db.execute(
        select(Invoice).options(selectinload(Invoice.payments)).where(Invoice.id == inv.id)
    )
    return InvoiceResponse.model_validate(res.scalar_one())


# ---------- Issue -------------------------------------------------------

@router.post("/{invoice_id}/issue", response_model=InvoiceResponse)
async def issue_invoice(
    invoice_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.clinic_id == clinic_id).with_for_update()
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status != InvoiceStatus.DRAFT:
        raise HTTPException(status_code=409, detail=f"Only draft invoices can be issued (current: {inv.status.value})")
    if not inv.line_items:
        raise HTTPException(status_code=400, detail="Cannot issue an invoice with no line items")

    year = inv.issue_date.year
    inv.number = await _next_invoice_number(db, clinic_id, year)
    inv.status = InvoiceStatus.ISSUED
    inv.issued_at = datetime.now(timezone.utc)

    await db.commit()

    res2 = await db.execute(
        select(Invoice).options(selectinload(Invoice.payments)).where(Invoice.id == inv.id)
    )
    return InvoiceResponse.model_validate(res2.scalar_one())


# ---------- Detail / update --------------------------------------------

@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Invoice.clinic_id == clinic_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse.model_validate(inv)


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    body: InvoiceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Invoice.clinic_id == clinic_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status != InvoiceStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Only draft invoices can be modified")

    data = body.model_dump(exclude_unset=True)
    if "line_items" in data:
        line_items_json = [
            {"label": li["label"], "quantity": li["quantity"], "unit_price": li["unit_price"],
             "total": _round2(li["quantity"] * li["unit_price"])}
            for li in data["line_items"]
        ]
        inv.line_items = line_items_json

    if "discount" in data:
        inv.discount = _round2(data["discount"] or 0.0)
    if "tva_rate" in data:
        inv.tva_rate = data["tva_rate"] or 0.0
    if "notes" in data:
        inv.notes = data["notes"]

    inv.subtotal, inv.tva, inv.total = _compute_totals(
        list(inv.line_items or []), inv.discount, inv.tva_rate
    )

    await db.commit()
    await db.refresh(inv)
    return InvoiceResponse.model_validate(inv)


# ---------- Payments ----------------------------------------------------

@router.post("/{invoice_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    invoice_id: uuid.UUID,
    body: PaymentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Invoice.clinic_id == clinic_id)
        .with_for_update()
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status not in (InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.PAID):
        raise HTTPException(status_code=409, detail=f"Cannot record payment on {inv.status.value} invoice")

    try:
        method = PaymentMethod(body.method)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown method: {body.method}")
    try:
        kind = PaymentKind(body.kind)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown kind: {body.kind}")

    pay = Payment(
        clinic_id=clinic_id,
        invoice_id=inv.id,
        received_by=user.id,
        amount=_round2(body.amount),
        method=method,
        kind=kind,
        reference=body.reference,
        note=body.note,
        received_at=body.received_at or datetime.now(timezone.utc),
    )
    db.add(pay)
    await db.flush()

    # Recompute total_paid + status from the full payment ledger
    delta = sum(
        (p.amount if p.kind == PaymentKind.PAYMENT else -p.amount)
        for p in inv.payments
    ) + (pay.amount if kind == PaymentKind.PAYMENT else -pay.amount)
    inv.total_paid = _round2(max(0.0, delta))

    if inv.total_paid >= inv.total:
        inv.status = InvoiceStatus.PAID
    elif inv.total_paid > 0:
        inv.status = InvoiceStatus.PARTIAL

    await db.commit()
    await db.refresh(pay)
    return PaymentResponse.model_validate(pay)


# ---------- PDF ---------------------------------------------------------

@router.get("/{invoice_id}/pdf")
async def invoice_pdf(
    invoice_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Render the invoice as a downloadable PDF."""
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Invoice.clinic_id == clinic_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pat_res = await db.execute(select(Patient).where(Patient.id == inv.patient_id))
    patient = pat_res.scalar_one()
    cl_res = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = cl_res.scalar_one()

    pdf_bytes = render_invoice_pdf(clinic=clinic, patient=patient, invoice=inv)

    filename = f"{inv.number}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


# ---------- Cancel ------------------------------------------------------

@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: uuid.UUID,
    body: CancelRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Invoice.clinic_id == clinic_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status in (InvoiceStatus.PAID, InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED):
        raise HTTPException(status_code=409, detail=f"Cannot cancel a {inv.status.value} invoice")

    inv.status = InvoiceStatus.CANCELLED
    inv.cancelled_at = datetime.now(timezone.utc)
    inv.cancel_reason = body.reason

    await db.commit()
    await db.refresh(inv)
    return InvoiceResponse.model_validate(inv)
