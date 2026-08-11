from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_optional_admin, require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import Post, PostCreate, PostUpdate
from app.services.portfolio_service import PortfolioService

router = APIRouter()

@router.get("/", response_model=List[Post])
def get_posts(
    tag: Optional[str] = Query(None, description="Only posts carrying this tag"),
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get published posts, newest first; admins also see drafts"""
    service = PortfolioService(db)
    return service.get_posts(tag=tag, include_unpublished=viewer is not None)

@router.get("/slug/{slug}", response_model=Post)
def get_post_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get a specific post by slug"""
    service = PortfolioService(db)
    post = service.get_post_by_slug(slug, include_unpublished=viewer is not None)
    if not post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return post

@router.get("/{post_id}", response_model=Post)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get a specific post by ID"""
    service = PortfolioService(db)
    # A draft 404s for anonymous callers rather than 403ing, as everywhere
    # else: whether an unpublished post exists at that id is itself not public.
    post = service.get_post(post_id, include_unpublished=viewer is not None)
    if not post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return post

@router.post("/", response_model=Post, dependencies=[Depends(require_admin)])
def create_post(post: PostCreate, db: Session = Depends(get_db)):
    """Create a new post"""
    service = PortfolioService(db)
    return service.create_post(post)

@router.put("/{post_id}", response_model=Post, dependencies=[Depends(require_admin)])
def update_post(
    post_id: int,
    post: PostUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing post"""
    service = PortfolioService(db)
    updated_post = service.update_post(post_id, post)
    if not updated_post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return updated_post

@router.delete("/{post_id}", dependencies=[Depends(require_admin)])
def delete_post(post_id: int, db: Session = Depends(get_db)):
    """Delete a post"""
    service = PortfolioService(db)
    success = service.delete_post(post_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return {"message": SuccessMessages.POST_DELETED}
