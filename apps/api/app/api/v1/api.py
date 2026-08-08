from fastapi import APIRouter
from app.api.v1.endpoints import projects, skills, certificates, contacts, auth, users

api_router = APIRouter()

# Public routes (no authentication required)
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])

# Protected routes (authentication required)
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(skills.router, prefix="/skills", tags=["skills"])
api_router.include_router(certificates.router, prefix="/certificates", tags=["certificates"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["contacts"])