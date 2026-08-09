"""Contact messages.

Only POST is public — it backs the contact form on the site. Everything else
reads or mutates messages the public sent us, so it is admin-only.

Before this, every route here was unauthenticated: `GET /api/v1/contacts`
returned the name, email address and message body of everyone who had ever used
the contact form, to anyone who asked.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.schemas.portfolio import Contact, ContactCreate
from app.services.portfolio_service import PortfolioService

router = APIRouter()


@router.get("/", response_model=List[Contact], dependencies=[Depends(require_admin)])
def get_contacts(
    unread_only: bool = Query(False, description="Get only unread contacts"),
    db: Session = Depends(get_db),
):
    """List contact messages. Admin only."""
    service = PortfolioService(db)
    return service.get_contacts(unread_only=unread_only)


@router.get("/{contact_id}", response_model=Contact, dependencies=[Depends(require_admin)])
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    """Get one contact message. Admin only."""
    service = PortfolioService(db)
    contact = service.get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail=ErrorMessages.CONTACT_NOT_FOUND)
    return contact


@router.post("/", response_model=Contact, status_code=201)
@limiter.limit("5/hour")
def create_contact(
    request: Request,
    # Declared but unused by the body below, and load-bearing anyway: the
    # limiter is built with headers_enabled=True, and when a decorated endpoint
    # returns something that is not a Response — this one returns a model —
    # slowapi reaches for a `response` keyword argument to write the
    # X-RateLimit-* headers into. Without the parameter it raises on every
    # successful submission, not just on the 429.
    response: Response,
    contact: ContactCreate,
    db: Session = Depends(get_db),
):
    """Submit a contact message. Public, rate limited per IP."""
    service = PortfolioService(db)
    return service.create_contact(contact)


@router.put(
    "/{contact_id}/read",
    response_model=Contact,
    dependencies=[Depends(require_admin)],
)
def mark_contact_as_read(contact_id: int, db: Session = Depends(get_db)):
    """Mark a message as read. Admin only."""
    service = PortfolioService(db)
    contact = service.mark_contact_as_read(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail=ErrorMessages.CONTACT_NOT_FOUND)
    return contact


@router.delete("/{contact_id}", dependencies=[Depends(require_admin)])
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    """Delete a message. Admin only."""
    service = PortfolioService(db)
    success = service.delete_contact(contact_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.CONTACT_NOT_FOUND)
    return {"message": SuccessMessages.CONTACT_DELETED}
