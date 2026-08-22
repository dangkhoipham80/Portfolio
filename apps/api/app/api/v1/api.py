from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    career,
    certificates,
    comments,
    contacts,
    media,
    posts,
    projects,
    series,
    skills,
    tags,
    users,
)

api_router = APIRouter()

# Public routes (no authentication required)
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])

# Protected routes (authentication required)
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(skills.router, prefix="/skills", tags=["skills"])
api_router.include_router(certificates.router, prefix="/certificates", tags=["certificates"])
api_router.include_router(career.router, prefix="/career", tags=["career"])
api_router.include_router(posts.router, prefix="/posts", tags=["blog"])
api_router.include_router(tags.router, prefix="/tags", tags=["blog"])
api_router.include_router(series.router, prefix="/series", tags=["blog"])
# Admin-only throughout, reads included — the queue is where the spam is and it
# carries commenters' email addresses. The router carries require_admin itself;
# see endpoints/comments.py for why it is not mounted under /posts.
api_router.include_router(comments.router, prefix="/comments", tags=["blog"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["contacts"])
# Admin-only throughout, reads included — the router carries require_admin
# itself rather than repeating it per route. See endpoints/media.py.
api_router.include_router(media.router, prefix="/media", tags=["media"])