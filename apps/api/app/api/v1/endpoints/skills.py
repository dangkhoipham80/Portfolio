from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.constants import ErrorMessages, SuccessMessages
from app.services.portfolio_service import PortfolioService
from app.schemas.portfolio import Skill, SkillCreate, SkillUpdate

router = APIRouter()

@router.get("/", response_model=List[Skill])
def get_skills(
    category: str = Query(None, description="Filter skills by category"),
    db: Session = Depends(get_db)
):
    """Get all skills, optionally filtered by category"""
    service = PortfolioService(db)
    return service.get_skills(category=category)

@router.get("/{skill_id}", response_model=Skill)
def get_skill(skill_id: int, db: Session = Depends(get_db)):
    """Get a specific skill by ID"""
    service = PortfolioService(db)
    skill = service.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail=ErrorMessages.SKILL_NOT_FOUND)
    return skill

@router.post("/", response_model=Skill)
def create_skill(skill: SkillCreate, db: Session = Depends(get_db)):
    """Create a new skill"""
    service = PortfolioService(db)
    return service.create_skill(skill)

@router.put("/{skill_id}", response_model=Skill)
def update_skill(
    skill_id: int,
    skill: SkillUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing skill"""
    service = PortfolioService(db)
    updated_skill = service.update_skill(skill_id, skill)
    if not updated_skill:
        raise HTTPException(status_code=404, detail=ErrorMessages.SKILL_NOT_FOUND)
    return updated_skill

@router.delete("/{skill_id}")
def delete_skill(skill_id: int, db: Session = Depends(get_db)):
    """Delete a skill"""
    service = PortfolioService(db)
    success = service.delete_skill(skill_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.SKILL_NOT_FOUND)
    return {"message": SuccessMessages.SKILL_DELETED}