from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import Project, ProjectCreate, ProjectUpdate
from app.services.portfolio_service import PortfolioService

router = APIRouter()

@router.get("/", response_model=List[Project])
def get_projects(
    featured_only: bool = Query(False, description="Get only featured projects"),
    db: Session = Depends(get_db)
):
    """Get all projects, optionally filtered by featured status"""
    service = PortfolioService(db)
    return service.get_projects(featured_only=featured_only)

@router.get("/{project_id}", response_model=Project)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get a specific project by ID"""
    service = PortfolioService(db)
    project = service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=ErrorMessages.PROJECT_NOT_FOUND)
    return project

@router.post("/", response_model=Project, dependencies=[Depends(require_admin)])
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project"""
    service = PortfolioService(db)
    return service.create_project(project)

@router.put("/{project_id}", response_model=Project, dependencies=[Depends(require_admin)])
def update_project(
    project_id: int,
    project: ProjectUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing project"""
    service = PortfolioService(db)
    updated_project = service.update_project(project_id, project)
    if not updated_project:
        raise HTTPException(status_code=404, detail=ErrorMessages.PROJECT_NOT_FOUND)
    return updated_project

@router.delete("/{project_id}", dependencies=[Depends(require_admin)])
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project"""
    service = PortfolioService(db)
    success = service.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.PROJECT_NOT_FOUND)
    return {"message": SuccessMessages.PROJECT_DELETED}