"""Blog tags.

Reads are public — the index draws its facets from them. Writes are admin-only,
and creating a tag is a deliberate act rather than a side effect of typing one
into a post: see the note on the model for why free-text tagging produces "api",
"API" and "apis" inside a month.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_optional_admin, require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import Tag, TagCreate, TagUpdate
from app.services.portfolio_service import PortfolioService

router = APIRouter()


def _present(tag, count: int) -> Tag:
    """A tag row plus the count the query worked out, as one response object.

    ``post_count`` is not a column and cannot be, so it is attached here rather
    than by mutating the ORM instance — which would look like a field and then
    disappear on the next refresh.
    """
    presented = Tag.model_validate(tag)
    presented.post_count = count
    return presented


@router.get("/", response_model=List[Tag])
def get_tags(db: Session = Depends(get_db), viewer=Depends(get_optional_admin)):
    """Every tag, with how many posts the caller can see under each.

    Empty tags are included. The public index drops them itself — a facet
    leading to nothing is worse than no facet — but the console needs them,
    because a tag with no posts yet is exactly the one you just made in order to
    attach it.
    """
    service = PortfolioService(db)
    return [
        _present(tag, count)
        for tag, count in service.get_tags(include_unpublished=viewer is not None)
    ]


@router.get("/slug/{slug}", response_model=Tag)
def get_tag_by_slug(
    slug: str, db: Session = Depends(get_db), viewer=Depends(get_optional_admin)
):
    """One tag, for its own page's heading and standfirst."""
    service = PortfolioService(db)
    tag = service.get_tag_by_slug(slug)
    if not tag:
        raise HTTPException(status_code=404, detail=ErrorMessages.TAG_NOT_FOUND)

    counts = dict(
        (row.id, n)
        for row, n in service.get_tags(include_unpublished=viewer is not None)
    )
    return _present(tag, counts.get(tag.id, 0))


@router.post("/", response_model=Tag, status_code=201, dependencies=[Depends(require_admin)])
def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
    """Create a tag. Admin only.

    A duplicate name is not rejected — ``unique_slug`` suffixes it — because two
    tags may legitimately want the same display name in different casings and
    the slug is what has to be unique. The console shows the existing tags
    while you type, which is the right place to prevent the mistake.
    """
    service = PortfolioService(db)
    return _present(service.create_tag(tag), 0)


@router.put("/{tag_id}", response_model=Tag, dependencies=[Depends(require_admin)])
def update_tag(tag_id: int, tag: TagUpdate, db: Session = Depends(get_db)):
    """Rename a tag or change its standfirst. The slug is fixed. Admin only."""
    service = PortfolioService(db)
    updated = service.update_tag(tag_id, tag)
    if not updated:
        raise HTTPException(status_code=404, detail=ErrorMessages.TAG_NOT_FOUND)

    counts = dict((row.id, n) for row, n in service.get_tags(include_unpublished=True))
    return _present(updated, counts.get(updated.id, 0))


@router.delete("/{tag_id}", dependencies=[Depends(require_admin)])
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    """Delete a tag. The posts carrying it keep everything but the filing."""
    service = PortfolioService(db)
    if not service.delete_tag(tag_id):
        raise HTTPException(status_code=404, detail=ErrorMessages.TAG_NOT_FOUND)
    return {"message": SuccessMessages.TAG_DELETED}
