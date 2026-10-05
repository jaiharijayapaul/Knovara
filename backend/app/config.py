"""Application configuration using Pydantic Settings."""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration parameters for Knovara backend."""

    # Project metadata
    PROJECT_NAME: str = "Knovara"
    PROJECT_DESCRIPTION: str = "Personalized AI Tutoring & Adaptive Learning Platform"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/knovara"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://knovara-beta.vercel.app"

    # Security
    JWT_SECRET: str = "knovara_hackathon_super_secret_jwt_key_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # AI / LLM Configuration
    LLM_PROVIDER: str = "gemini"
    LLM_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    EMBEDDING_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "gemini-embedding-001"

    # Google Authentication
    GOOGLE_CLIENT_ID: str = "492252075082-6nevdued262p0qh347431blphbeertgs.apps.googleusercontent.com"

    # Supabase (optional for hosted storage/auth)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    DEFAULT_RATE_LIMIT: str = "60/minute"
    LLM_RATE_LIMIT: str = "15/minute"
    AUTH_RATE_LIMIT: str = "10/minute"
    REDIS_URL: str = ""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    def validate_production_security(self) -> None:
        """
        Validate security constraints in production mode.
        Called on startup to fail-fast if security invariants are violated.
        """
        is_prod = self.ENVIRONMENT.lower() in ("production", "prod")
        if not is_prod:
            return

        insecure_secrets = {
            "knovara_hackathon_super_secret_jwt_key_2026",
            "super_secret_jwt_encryption_key_change_in_production",
            "secret",
            "changeme",
            "your_jwt_secret_here",
        }

        secret = (self.JWT_SECRET or "").strip()
        if not secret or secret in insecure_secrets:
            raise ValueError(
                "SECURITY FATAL: In production mode, JWT_SECRET must be set to a custom secure key "
                "and cannot use a default, placeholder, or empty secret."
            )

        if len(secret) < 32:
            raise ValueError(
                f"SECURITY FATAL: In production mode, JWT_SECRET must be at least 32 characters long "
                f"(current length: {len(secret)})."
            )


settings = Settings()
