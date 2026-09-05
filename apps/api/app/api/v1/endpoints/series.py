"""Post series — an ordered run of posts on one subject.

A series is published independently of the posts in it, and both have to be
published for a reader to reach one through the other. That is not redundancy:
a series is drafted while its first two parts are already live, and until it is
published the reader sees the posts and no navigation between them.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_optional_admin, require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import Post, Series, SeriesCreate, SeriesUpdate
from app.services.portfolio_service import PortfolioService

router = APIRouter()


def _present(service: PortfolioService, record, include_unpublished: bool) -> Series:
    presented = Series.model_validate(record)
    presented.post_count = len(
        service.get_series_posts(record.id, include_unpublished=include_unpublished)
    )
    return presented


@router.get("/", response_model=List[Series])
def get_series_list(db: Session = Depends(get_db), viewer=Depends(get_optional_admin)):
    """Published series, alphabetically; admins also see drafts."""
    service = PortfolioService(db)
    include = viewer is not None
    return [
        _present(service, record, include)
        for record in service.get_series_list(include_unpublished=include)
    ]


@router.get("/slug/{slug}", response_model=Series)
def get_series_by_slug(
    slug: str, db: Session = Depends(get_db), viewer=Depends(get_optional_admin)
):
    service = PortfolioService(db)
    include = viewer is not None
    record = service.get_series_by_slug(slug, include_unpublished=include)
    if not record:
        raise HTTPException(status_code=404, detail=ErrorMessages.SERIES_NOT_FOUND)
    return _present(service, record, include)


@router.get("/slug/{slug}/posts", response_model=List[Post])
def get_series_posts(
    slug: str, db: Session = Depends(get_db), viewer=Depends(get_optional_admin)
):
    """The run, in reading order — oldest first, unlike every other listing.

    Part 1 is where a reader starts, so a series is the one place newest-first
    would be actively wrong.
    """
    service = PortfolioService(db)
    include = viewer is not None
    record = service.get_series_by_slug(slug, include_unpublished=include)
    if not record:
        raise HTTPException(status_code=404, detail=ErrorMessages.SERIES_NOT_FOUND)
    return service.get_series_posts(record.id, include_unpublished=include)


@router.get("/{series_id}", response_model=Series)
def get_series(
    series_id: int, db: Session = Depends(get_db), viewer=Depends(get_optional_admin)
):
    """One series by id — what the console's edit screen loads.

    Missing for the same reason as the tags one, and with the same symptom: the
    PUT and DELETE below claim the path, so a GET answered 405 and the console
    reported an outage. Declared after ``/slug/{slug}`` so that route keeps its
    two-segment match.
    """
    service = PortfolioService(db)
    include = viewer is not None
    record = service.get_series(series_id, include_unpublished=include)
    if not record:
        raise HTTPException(status_code=404, detail=ErrorMessages.SERIES_NOT_FOUND)
    return _present(service, record, include)


@router.post(
    "/", response_model=Series, status_code=201, dependencies=[Depends(require_admin)]
)
def create_series(series: SeriesCreate, db: Session = Depends(get_db)):
    service = PortfolioService(db)
    return _present(service, service.create_series(series), True)


@router.put("/{series_id}", response_model=Series, dependencies=[Depends(require_admin)])
def update_series(series_id: int, series: SeriesUpdate, db: Session = Depends(get_db)):
    service = PortfolioService(db)
    updated = service.update_series(series_id, series)
    if not updated:
        raise HTTPException(status_code=404, detail=ErrorMessages.SERIES_NOT_FOUND)
    return _present(service, updated, True)


@router.delete("/{series_id}", dependencies=[Depends(require_admin)])
def delete_series(series_id: int, db: Session = Depends(get_db)):
    """Delete a series. The posts in it survive, unfiled."""
    service = PortfolioService(db)
    if not service.delete_series(series_id):
        raise HTTPException(status_code=404, detail=ErrorMessages.SERIES_NOT_FOUND)
    return {"message": SuccessMessages.SERIES_DELETED}
