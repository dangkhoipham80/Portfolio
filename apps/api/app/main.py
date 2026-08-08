from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import create_tables
from app.api.v1.api import api_router

# Import all models to register them in metadata
from app.models import *

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Portfolio Backend API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Create tables on startup (after models are imported)
create_tables()

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "Portfolio API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}