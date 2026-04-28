from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "Clinicovia"
    debug: bool = False

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "clinicovia"
    postgres_user: str = "clinicovia"
    postgres_password: str = "clinicovia_dev_password"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # MongoDB
    mongo_url: str = "mongodb://localhost:27017/clinicovia_chat"
    mongo_db: str = "clinicovia_chat"

    # Auth
    secret_key: str = "change-me-in-production"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    jwt_algorithm: str = "HS256"

    # CORS
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    # Tracking Encryption
    tracking_encryption_key: str = ""

    # WhatsApp Bridge
    whatsapp_bridge_url: str = "http://localhost:3001"
    whatsapp_bridge_secret: str = "change-me-whatsapp-secret"

    # AI
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_gemini_api_key: str = ""

    # Email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "noreply@clinicovia.com"

    # S3
    s3_bucket: str = "clinicovia-uploads"
    s3_region: str = "me-south-1"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_endpoint: str = ""


settings = Settings()
