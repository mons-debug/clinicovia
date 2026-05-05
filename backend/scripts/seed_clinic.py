import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session as async_session_maker
from app.models.clinic import Clinic

async def seed():
    async with async_session_maker() as session:
        clinic = Clinic(
            id=uuid.UUID("0cc8d2ca-98c3-4414-a0c2-2ed23a51e756"),
            name="Refine Beauty Clinic",
            whatsapp_number="123456789" # just a placeholder if required
        )
        session.add(clinic)
        await session.commit()
        print("Clinic seeded")

if __name__ == "__main__":
    asyncio.run(seed())
