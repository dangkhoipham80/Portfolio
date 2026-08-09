from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_optional_admin, require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import CareerEntry, CareerEntryCreate, CareerEntryUpdate
from app.services.portfolio_service import PortfolioService

router = APIRouter()

@router.get("/", response_model=List[CareerEntry])
def get_career_entries(
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get published career entries, newest first; admins also see drafts"""
    service = PortfolioService(db)
    return service.get_career_entries(include_unpublished=viewer is not None)

@router.get("/{entry_id}", response_model=CareerEntry)
def get_career_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get a specific career entry by ID"""
    service = PortfolioService(db)
    entry = service.get_career_entry(entry_id, include_unpublished=viewer is not None)
    if not entry:
        raise HTTPException(status_code=404, detail=ErrorMessages.CAREER_ENTRY_NOT_FOUND)
    return entry

@router.post("/", response_model=CareerEntry, dependencies=[Depends(require_admin)])
def create_career_entry(entry: CareerEntryCreate, db: Session = Depends(get_db)):
    """Create a new career entry"""
    service = PortfolioService(db)
    return service.create_career_entry(entry)

@router.put("/{entry_id}", response_model=CareerEntry, dependencies=[Depends(require_admin)])
def update_career_entry(
    entry_id: int,
    entry: CareerEntryUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing career entry"""
    service = PortfolioService(db)
    updated_entry = service.update_career_entry(entry_id, entry)
    if not updated_entry:
        raise HTTPException(status_code=404, detail=ErrorMessages.CAREER_ENTRY_NOT_FOUND)
    return updated_entry

@router.delete("/{entry_id}", dependencies=[Depends(require_admin)])
def delete_career_entry(entry_id: int, db: Session = Depends(get_db)):
    """Delete a career entry"""
    service = PortfolioService(db)
    success = service.delete_career_entry(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.CAREER_ENTRY_NOT_FOUND)
    return {"message": SuccessMessages.CAREER_ENTRY_DELETED}
