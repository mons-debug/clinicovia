# Clinicovia — Status

**Last updated:** 2026-05-05

## Deployment

| Environment | Frontend | Backend | DB |
|-------------|----------|---------|-----|
| **Production** | Vercel: `frontend-kappa-inky-51.vercel.app` | Railway: `backend-production-003b5.up.railway.app` | Railway Postgres + MongoDB + Redis |
| **Local** | `localhost:3003` | `localhost:8001` | Docker (postgres:5434, redis:6380) |

## What's Built

### Core Clinic OS (8 phases — all complete)
- [x] Doctor-owned services (model, API, seed)
- [x] "Mes Services" doctor portal page
- [x] Walk-in dialog with doctor + service dropdowns
- [x] Reception workflow: facture DRAFT → review/edit → validate → pay
- [x] Plans & séances linked to doctor_service
- [x] Calendar with doctor columns + appointment booking with DoctorServiceSelect
- [x] Professional PDF templates (invoice, prescription, consent) with logo support
- [x] Dossier integration, Terminer dialog with real séance data + auto follow-up

### Already Existed Before
- [x] Patient CRUD + search + tabs + dossier
- [x] 4-column queue (kanban) with live polling
- [x] Calendar day/week/month views
- [x] Appointment CRUD + status transitions
- [x] Treatment plans + séance wizard (5-step)
- [x] Invoices + payments + PDF
- [x] Prescriptions + drug catalog + PDF
- [x] Consultations (SOAP editor)
- [x] Consent forms + signing
- [x] Patient photos (before/after)
- [x] Screening pre-treatment
- [x] WhatsApp integration (bridge)
- [x] AI agents + orchestration
- [x] Pipeline/CRM
- [x] Forms builder
- [x] Landing page + auth + onboarding
- [x] Role-based permissions (6 roles)
- [x] Multi-tenant architecture

## What's Not Done Yet

- [ ] Logo upload in clinic settings (templates support it, upload UI missing)
- [ ] Global consent on first visit (model supports it, auto-create logic not wired)
- [ ] Calendar live state (show overruns when appointment runs past duration)
- [ ] No-show count tracking on patient dossier
- [ ] Split payment dialog (multiple payment methods per invoice)
- [ ] Doctor absent — bulk reschedule
- [ ] Patient export (CSV/Excel)
- [ ] End-of-day queue cleanup alerts
- [ ] Consent declined cascade (backend logic exists, frontend abort path missing)

## Seeded Data (Local + Production)

**Clinic:** Refine Beauty Clinic (Tanger, Morocco)

**14 Doctor Services:**
- Dr. Meryem (aesthetic_medicine): Botox, Fillers, Thread Lift, PRP, Laser, Soin visage, Peeling, Mésothérapie, Cellulite, Soin corps
- Dr. Amr (plastic_surgery): Liposuccion, Abdominoplastie, Rhinoplastie, Mammoplastie

**Team:** Moncef (owner), Dr. Amr, Dr. Meryem, Sabrina (reception)

## Recent Changes (May 4-5, 2026)

1. Fixed login on production (seeded users on Railway DB)
2. Set NEXT_PUBLIC_API_URL on Vercel → Railway backend
3. Created doctor_services table + migration
4. Built 8 phases of Smart Clinic OS
5. Fixed facture lifecycle (DRAFT not ISSUED on create)
6. Fixed invoice.number nullable (DRAFT has no number)
7. Fixed InvoiceResponse schema (number: str | None)
8. Removed consent gate on séance start (parallel workflow)
9. Fixed can_terminate: séance only needs screening, not SOAP
10. Fixed Terminer dialog auto-fill follow-up from plan interval
11. Fixed checkout to link follow-up to next plan session (no duplicates)
