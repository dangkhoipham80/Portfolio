from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.constants import ErrorMessages, SuccessMessages
from app.services.portfolio_service import PortfolioService
from app.schemas.portfolio import Contact, ContactCreate

router = APIRouter()

@router.get("/", response_model=List[Contact])
def get_contacts(
    unread_only: bool = Query(False, description="Get only unread contacts"),
    db: Session = Depends(get_db)
):
    """Get all contacts, optionally filtered by read status"""
    service = PortfolioService(db)
    return service.get_contacts(unread_only=unread_only)

@router.get("/{contact_id}", response_model=Contact)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    """Get a specific contact by ID"""
    service = PortfolioService(db)
    contact = service.get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail=ErrorMessages.CONTACT_NOT_FOUND)
    return contact

@router.post("/", response_model=Contact)
def create_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    """Create a new contact message"""
    service = PortfolioService(db)
    return service.create_contact(contact)

@router.put("/{contact_id}/read", response_model=Contact)
def mark_contact_as_read(contact_id: int, db: Session = Depends(get_db)):
    """Mark a contact as read"""
    service = PortfolioService(db)
    contact = service.mark_contact_as_read(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail=ErrorMessages.CONTACT_NOT_FOUND)
    return contact

@router.delete("/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    """Delete a contact"""
    service = PortfolioService(db)
    success = service.delete_contact(contact_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.CONTACT_NOT_FOUND)
    return {"message": SuccessMessages.CONTACT_DELETED}