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

    # Where the web app lives, for the links in outbound mail.
    #
    # The reset and verification mails carry a link into apps/web, not into this
    # API, and there was no setting for it: both built the link from
    # BACKEND_CORS_ORIGINS[0]. That happens to be right locally and is wrong the
    # moment a second origin is listed or the list is reordered — a preview
    # deployment added to the front of it silently starts collecting the live
    # site's password-reset links.
    #
    # Blank falls back to the old behaviour rather than to localhost, so an
    # existing deployment keeps working until this is set.
    FRONTEND_URL: str = ""

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
    # smtplib blocks with no timeout by default. A background task that hangs on
    # a dead SMTP host holds a thread from the pool until the process restarts.
    SMTP_TIMEOUT: int = 10

    # Notify the owner when the contact form is used. The kill switch is
    # explicit, but the effective default is off: `emails_enabled` is False
    # until real credentials are present, so CI and a fresh clone send nothing
    # without having to set anything.
    CONTACT_NOTIFY_ENABLED: bool = True
    # Who to notify. Empty means "whoever the mail is sent as".
    CONTACT_NOTIFY_TO: str = ""

    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)

    @property
    def emails_from_address(self) -> str:
        """Envelope sender. Falls back to the account we authenticate as.

        EMAILS_FROM_EMAIL is routinely left blank — it is the one SMTP setting
        with no obvious value to paste in. Blank used to reach the From header
        verbatim, producing `Portfolio Contact <>`, which Gmail rejects outright.
        """
        return self.EMAILS_FROM_EMAIL or self.SMTP_USER

    @property
    def frontend_base_url(self) -> str:
        """Origin for links in mail, with no trailing slash.

        The strip matters: FRONTEND_URL is pasted from a browser and arrives as
        "https://example.com/" about half the time, which would make every link
        in every mail a double slash.
        """
        base = self.FRONTEND_URL or (
            self.BACKEND_CORS_ORIGINS[0] if self.BACKEND_CORS_ORIGINS else "http://localhost:3000"
        )
        return base.rstrip("/")

    @property
    def contact_notify_recipient(self) -> str:
        return self.CONTACT_NOTIFY_TO or self.emails_from_address

    @property
    def contact_notifications_enabled(self) -> bool:
        return bool(
            self.CONTACT_NOTIFY_ENABLED and self.emails_enabled and self.contact_notify_recipient
        )


settings = Settings()
