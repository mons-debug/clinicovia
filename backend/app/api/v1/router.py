from fastapi import APIRouter

from app.api.v1 import auth, patients, dashboard, deals, appointments, forms, whatsapp, doctors, tracking, ai_agents, queue, calendar, treatment_plans

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(queue.router, prefix="/queue", tags=["Queue"])
api_router.include_router(deals.router, prefix="/deals", tags=["Deals"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])
api_router.include_router(treatment_plans.router, prefix="/plans", tags=["Treatment Plans"])
api_router.include_router(forms.router, prefix="/forms", tags=["Forms"])
api_router.include_router(forms.public_router, prefix="/public/forms", tags=["Public Forms"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp"])
api_router.include_router(doctors.router, prefix="/doctors", tags=["Doctors"])
api_router.include_router(tracking.router, prefix="/tracking", tags=["Tracking"])
api_router.include_router(ai_agents.router, prefix="/ai-agents", tags=["AI Agents"])

# These will be added as we build each module:
# api_router.include_router(conversations.router, prefix="/conversations", tags=["Conversations"])
# api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
# api_router.include_router(tracking.router, prefix="/tracking", tags=["Tracking"])
# api_router.include_router(settings_router, prefix="/settings", tags=["Settings"])
# api_router.include_router(admin.router, prefix="/admin", tags=["Super Admin"])
