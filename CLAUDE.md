# Clinicovia — Clinic OS

## What Is This

Clinicovia is a WhatsApp-first clinic management system (SaaS) built for aesthetic/cosmetic clinics in Morocco and MENA. It's being developed as an internal OS for **Refine Beauty Clinic** (Tanger) first, then will be offered as a product to other clinics.

**Owner:** Moncef Bennassar (moncef@refine.ma) — solo digital marketer running his own agency. This is his brother's product that Moncef is building the technical side for.

## Tech Stack

| Layer | Tech | Location |
|-------|------|----------|
| Frontend | Next.js 16 + React + TypeScript + Tailwind + shadcn/ui | `frontend/` |
| Backend | FastAPI + SQLAlchemy (async) + Alembic | `backend/` |
| Database | PostgreSQL 16 | Railway (prod) / Docker (local) |
| Cache | Redis | Railway (prod) / Docker (local) |
| Chat DB | MongoDB | Railway (prod) / Docker (local) |
| WhatsApp | Custom bridge (Node.js) | `whatsapp-bridge/` |
| Deployment (prod) | Frontend: Vercel / Backend: Railway | Auto-deploy from GitHub main |
| Deployment (legacy) | Hetzner + Docker + Caddy | clinicovia.com (brother's domain — DO NOT touch) |

## Production URLs

- **Frontend:** https://frontend-kappa-inky-51.vercel.app
- **Backend:** https://backend-production-003b5.up.railway.app
- **GitHub:** https://github.com/mons-debug/clinicovia.git

## Local Dev

```bash
# Start databases
docker compose up -d postgres redis

# Backend (port 8001 — 8000 taken by OrbStack)
cd backend
PYTHONPATH=$(pwd) POSTGRES_HOST=localhost POSTGRES_PORT=5434 POSTGRES_DB=clinicovia \
POSTGRES_USER=clinicovia POSTGRES_PASSWORD=change-me SECRET_KEY=dev-secret-key \
CORS_ORIGINS="http://localhost:3000,http://localhost:3003" \
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 3003 — 3000 taken)
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:8001 npm run dev -- -p 3003
```

## Accounts (all password: Refine2026!)

| Email | Role | Specialty |
|-------|------|-----------|
| moncef@refine.ma | super_admin + clinic_owner | — |
| amr@refine.ma | doctor | plastic_surgery |
| meryem@refine.ma | doctor | aesthetic_medicine |
| sabrina@refine.ma | receptionist | — |

## Architecture — Core Data Model

The system centers on **doctor-owned services**. Everything derives from the doctor + service pair.

```
DoctorService (doctor owns services with price, duration, consent template)
    ↓
Appointment (links to doctor_service → gets doctor, duration, service name)
    ↓
Queue / Salle d'attente (today's appointments filtered by who's physically here)
    ↓
Calendar (live view — columns per doctor, slots by service duration)

TreatmentPlan (links to doctor_service → price, consent inherited)
    ↓
TreatmentSession / Séance (each linked to an appointment)
    ↓
Consent + Facture (created on séance start, sent to reception)
```

## Key Tables

| Table | Purpose |
|-------|---------|
| `doctor_services` | Doctor-owned services (name, price, duration, consent_template) |
| `appointments` | Calendar slots (has `doctor_service_id` FK) |
| `treatment_plans` | Multi-session plans (has `doctor_service_id` FK) |
| `treatment_sessions` | Individual séances within a plan |
| `invoices` | Factures — lifecycle: DRAFT → ISSUED → PAID |
| `patient_consents` | Consent forms — lifecycle: PENDING → SIGNED / DECLINED |
| `patients` | Patient dossier with intake_status for queue |
| `prescriptions` | Ordonnances with drug lines |
| `consultations` | SOAP notes |

## State Machines

### Patient Journey (Queue)
```
awaiting_doctor → in_room → checkout_pending → done
(or fast-track: directly → in_room when clinic is empty)
```

### Appointment
```
scheduled → confirmed → checked_in → in_progress → completed
                                    → no_show / cancelled
```

### Facture (Invoice)
```
DRAFT (doctor starts séance) → ISSUED (reception validates) → PAID
Reception MUST review/edit before issuing. No payment on DRAFT.
```

### Consent
```
pending → signed (or declined → cascade cancels séance + facture)
```

### Séance
```
planned → scheduled → in_progress → completed
```

## Workflow — Doctor & Reception in Parallel

**Doctor side (en consultation):**
1. Opens séance → "Commencer" → sends consent + DRAFT facture to reception
2. Treats patient (photos, notes, etc.)
3. Clicks "Terminer la visite" → patient moves to "À encaisser"

**Reception side (in parallel):**
1. Sees "Documents reçus" → prints consent → patient signs → marks signed
2. Reviews DRAFT facture → edits items/price/discount → validates (DRAFT → ISSUED)
3. Patient at "À encaisser" → collects payment → prints PDF → releases

**Rule:** Doctor can Terminer even if facture is still DRAFT. Reception validates at checkout. Neither blocks the other.

## File Structure

```
clinicovia/
├── CLAUDE.md              ← You are here
├── backend/
│   ├── app/
│   │   ├── api/v1/        # FastAPI route handlers
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # PDF generation, etc.
│   │   ├── templates/     # Jinja2 HTML → PDF (invoice, prescription, consent)
│   │   ├── middleware/     # Auth middleware
│   │   └── config.py      # Settings from env vars
│   ├── alembic/           # Database migrations
│   ├── scripts/           # Seed scripts (seed_production.py)
│   └── venv/              # Python virtual environment
├── frontend/
│   ├── app/               # Next.js App Router pages
│   │   ├── (auth)/        # Login, register, forgot-password
│   │   ├── (dashboard)/   # All authenticated pages
│   │   └── (admin)/       # Super admin pages
│   ├── components/        # React components
│   │   ├── ui/            # shadcn/ui primitives
│   │   ├── queue/         # Walk-in dialog, facture review
│   │   ├── plans/         # Commencer séance, new plan
│   │   ├── patient/       # Dossier, session checklist, terminer
│   │   ├── calendar/      # Month/week views, quick-add, new appointment
│   │   ├── billing/       # Invoice dialogs
│   │   └── layout/        # Sidebar, header
│   ├── lib/api/           # React Query hooks (one file per entity)
│   ├── stores/            # Zustand stores (auth, UI)
│   └── hooks/             # Permissions, etc.
├── whatsapp-bridge/       # WhatsApp Business API bridge
├── docker-compose.yml     # Local dev databases
└── plans/                 # Architecture plans (HTML reports)
```

## Reusable Component: DoctorServiceSelect

Exported from `frontend/components/queue/walk-in-dialog.tsx`. Used in:
- Walk-in dialog (queue)
- New appointment dialog (calendar)
- New plan dialog (patient dossier)

Two dropdowns: pick doctor → pick their service. Services filtered by selected doctor.

## PDF Templates

All in `backend/app/templates/`. Rendered via WeasyPrint (Jinja2 → HTML → PDF).

| Template | Endpoint | Features |
|----------|----------|----------|
| `invoice.html` | `GET /invoices/:id/pdf` | Clinic logo, ICE/IF/RC, line items, totals, payments, stamp |
| `prescription.html` | `GET /prescriptions/:id/pdf` | Clinic logo, Rx symbol, drug lines, doctor signature |
| `consent.html` | `GET /consents/:id/pdf` | Clinic logo, consent text, checkboxes, dual signature areas |

## Rules

1. **clinicovia.com is the brother's domain** — never deploy there, never touch Hetzner
2. **Use Vercel domain** for frontend, Railway for backend
3. **Facture = DRAFT first** — reception validates before payment
4. **Doctor and reception work in parallel** — neither blocks the other
5. **One patient can't have overlapping appointments** (one body, one place)
6. **No-show is manual** — reception decides, not automatic
7. **Queue resets daily** — stale entries flagged next morning
8. **All appointments link to doctor_service** — doctor, price, duration derived from one source
9. **Consent declined = cascade cancel** (séance + DRAFT facture cancelled)
10. **Plan abandoned = remaining sessions + appointments cancelled**

## Current State (May 2026)

All 8 phases of the Smart Clinic OS are implemented:
1. ✅ Doctor services model + API + seed
2. ✅ Doctor portal ("Mes Services" page)
3. ✅ Walk-in with doctor+service picker
4. ✅ Reception workflow (DRAFT → review → ISSUED → pay)
5. ✅ Plans & séances linked to doctor services
6. ✅ Calendar with doctor columns + DoctorServiceSelect
7. ✅ Professional PDF templates (invoice, prescription, consent) with logo
8. ✅ Dossier integration + Terminer dialog with real séance data

## What's Next

- Test full end-to-end flow locally
- Push to production (Railway + Vercel)
- Logo upload in clinic settings
- Global consent (first visit)
- Calendar live state (show overruns, actual durations)
- No-show tracking on patient dossier
- Split payment dialog at caisse
