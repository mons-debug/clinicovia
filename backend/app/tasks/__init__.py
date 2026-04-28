from celery import Celery
from app.config import settings

celery_app = Celery(
    "clinicovia",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Import task modules so their @celery_app.task decorators register them.
# Must be at bottom to avoid circular imports with app.tasks.celery_app refs.
from app.tasks import ai as _ai  # noqa: E402,F401
from app.tasks import tracking as _tracking  # noqa: E402,F401
