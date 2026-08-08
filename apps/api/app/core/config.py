from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings
import json

class Settings(BaseSettings):
    # Application Settings
    PROJECT_NAME: str = "Portfolio API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"

    @field_validator("BACKEND_CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: str) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return []

    # Database - Neon PostgreSQL
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 11520

    # Email Configuration
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_USER: str = "your-email@gmail.com"
    SMTP_PASSWORD: str = "your-app-password"
    EMAILS_FROM_EMAIL: str = "your-email@gmail.com"
    EMAILS_FROM_NAME: str = "Portfolio Contact"

    # Development Settings
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()