from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_optional_admin, require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import Project, ProjectCreate, ProjectUpdate
from app.services.portfolio_service import PortfolioService

router = APIRouter()

@router.get("/", response_model=List[Project])
def get_projects(
    featured_only: bool = Query(False, description="Get only featured projects"),
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get published projects; admins also see drafts"""
    service = PortfolioService(db)
    return service.get_projects(
        featured_only=featured_only,
        include_unpublished=viewer is not None,
    )

@router.get("/slug/{slug}", response_model=Project)
def get_project_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get a specific project by slug"""
    service = PortfolioService(db)
    project = service.get_project_by_slug(slug, include_unpublished=viewer is not None)
    if not project:
        raise HTTPException(status_code=404, detail=ErrorMessages.PROJECT_NOT_FOUND)
    return project

@router.get("/{project_id}", response_model=Project)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get a specific project by ID"""
    service = PortfolioService(db)
    # A draft 404s for anonymous callers rather than 403ing: whether an
    # unpublished project exists at that id is itself not public.
    project = service.get_project(project_id, include_unpublished=viewer is not None)
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
