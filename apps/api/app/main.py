import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Was `create_tables()` at module scope, which meant importing the app —
    # from a test, a script, or alembic — opened a connection and issued DDL.
    # Alembic owns the schema now; this only checks the database answers.
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database reachable")
    except Exception:
        logger.exception("Database unreachable at startup")
        raise
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Portfolio content API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if not settings.is_production else None,
    # Don't hand an attacker who finds the URL a browsable map of the API.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "Portfolio API is running!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
