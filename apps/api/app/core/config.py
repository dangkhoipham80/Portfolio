from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    PROJECT_NAME: str = "Portfolio API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"

    # Comma-separated in the environment; a list once parsed. Never "*" —
    # allow_credentials plus a wildcard origin lets any site call the API with
    # the browser's cookies attached.
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @field_validator("BACKEND_CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: str) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return []

    DATABASE_URL: str

    # Security
    SECRET_KEY: str

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def secret_key_is_strong(cls, v: str) -> str:
        # RFC 7518 3.2: an HMAC key for HS256 must be at least as long as the
        # hash output. Refuse to boot on a weak or placeholder key rather than
        # signing tokens an attacker could brute-force.
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters. Generate one with: "
                'python -c "import secrets; print(secrets.token_hex(32))"'
            )
        return v
    # Was 11520 — eight days. A stolen access token stayed usable for over a
    # week; short-lived access tokens plus a refresh token is the point of
    # having both.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Email. Defaults are empty rather than "your-email@gmail.com" so an
    # unconfigured SMTP setup fails loudly instead of pretending to be set up.
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = ""
    EMAILS_FROM_NAME: str = "Portfolio Contact"

    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)


settings = Settings()
