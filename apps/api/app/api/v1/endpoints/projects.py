from typing import List, Sequence

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_optional_admin, require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import GalleryImage, Project, ProjectCreate, ProjectUpdate
from app.services.media_service import MediaService
from app.services.portfolio_service import PortfolioService

router = APIRouter()


def _present(db: Session, projects: Sequence) -> List[Project]:
    """Fill in what the gallery's bare URLs do not say.

    ``projects.gallery`` stores URLs and nothing else, so that a description
    lives in one place — on the ``media_assets`` row — rather than being copied
    into every project that uses the image. The cost of that choice is paid
    here: the response has to carry alt text and dimensions, so they are looked
    up on the way out.

    Done at the route rather than in ``PortfolioService`` on purpose. That class
    returns ORM rows, and the update and delete paths re-read them to mutate
    them; a service method that handed back rows with ``gallery`` swapped for a
    list of dicts would eventually have one of those dicts flushed into the
    column. Pydantic models are inert, so the swap happens after the boundary
    where anything could still be written back.

    One ``IN`` query for the whole page, not one per image.
    """
    schemas = [Project.model_validate(project) for project in projects]

    index = MediaService(db).index_by_url(
        image.url for schema in schemas for image in schema.gallery
    )
    if not index:
        return schemas

    for schema in schemas:
        schema.gallery = [
            GalleryImage(
                url=image.url,
                alt=asset.alt if (asset := index.get(image.url)) else None,
                width=asset.width if asset else None,
                height=asset.height if asset else None,
            )
            for image in schema.gallery
        ]

    return schemas

@router.get("/", response_model=List[Project])
def get_projects(
    featured_only: bool = Query(False, description="Get only featured projects"),
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get published projects; admins also see drafts"""
    service = PortfolioService(db)
    projects = service.get_projects(
        featured_only=featured_only,
        include_unpublished=viewer is not None,
    )
    return _present(db, projects)

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
    return _present(db, [project])[0]

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
    return _present(db, [project])[0]

@router.post("/", response_model=Project, dependencies=[Depends(require_admin)])
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project"""
    service = PortfolioService(db)
    return _present(db, [service.create_project(project)])[0]

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
    return _present(db, [updated_project])[0]

@router.delete("/{project_id}", dependencies=[Depends(require_admin)])
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project"""
    service = PortfolioService(db)
    success = service.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.PROJECT_NOT_FOUND)
    return {"message": SuccessMessages.PROJECT_DELETED}
