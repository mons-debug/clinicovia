"""LangChain provider factory — creates chat models for OpenAI or Google Gemini."""

from langchain_core.language_models import BaseChatModel
from app.config import settings


def get_chat_model(
    provider: str,
    model: str,
    api_key: str | None = None,
    temperature: float = 0.7,
) -> BaseChatModel:
    """Create a LangChain chat model for the given provider.

    Args:
        provider: "openai" or "google_gemini"
        model: Model ID (e.g., "gpt-5.4-mini-2026-03-17", "gemini-2.5-flash")
        api_key: Override API key. Falls back to env settings.
        temperature: Sampling temperature.
    """
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        key = api_key or settings.openai_api_key
        if not key:
            raise ValueError("OpenAI API key not configured")
        return ChatOpenAI(
            model=model,
            api_key=key,
            temperature=temperature,
        )

    if provider == "google_gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        key = api_key or settings.google_gemini_api_key
        if not key:
            raise ValueError("Google Gemini API key not configured")
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=key,
            temperature=temperature,
        )

    raise ValueError(f"Unsupported AI provider: {provider}")


async def get_provider_api_key(db, clinic_id, provider: str) -> str | None:
    """Get the API key for a provider, checking per-clinic credential first, then env."""
    from sqlalchemy import select
    from app.models.ai_agent import AIProviderCredential, AIProvider
    from app.utils.encryption import decrypt_credentials

    result = await db.execute(
        select(AIProviderCredential).where(
            AIProviderCredential.clinic_id == clinic_id,
            AIProviderCredential.provider == provider,
            AIProviderCredential.is_active == True,  # noqa: E712
        )
    )
    credential = result.scalar_one_or_none()
    if credential:
        decrypted = decrypt_credentials(credential.api_key_encrypted)
        if decrypted and decrypted.get("api_key"):
            return decrypted["api_key"]

    # Fall back to global env settings
    if provider == "openai":
        return settings.openai_api_key or None
    if provider == "google_gemini":
        return settings.google_gemini_api_key or None
    return None
