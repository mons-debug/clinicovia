from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — merge duplicate WhatsApp conversations
    try:
        from app.database import async_session
        from app.services.whatsapp_chat import merge_duplicate_conversations
        async with async_session() as db:
            merged = await merge_duplicate_conversations(db)
            if merged > 0:
                import logging
                logging.getLogger(__name__).info(f"Merged {merged} duplicate WhatsApp conversations")
    except Exception:
        pass

    yield

    # Shutdown
    from app.database import engine
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="AI-powered clinic management platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "clinicovia-api"}
