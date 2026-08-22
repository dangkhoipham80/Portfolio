"""The image library.

Every route here is admin-only, including the reads. That is the difference
between this and the content routers: a project or a post is a thing the site
exists to show, so its GET is public and widens for an admin. The asset index is
not content — it is a record of what is in a storage bucket, including images
that were uploaded and never used, and listing it publicly would hand out a
catalogue of everything ever put there.

The bytes themselves are public. Blob serves them, the URLs are unguessable
because uploads carry a random suffix, and a published page links to them
directly. Nothing here changes that; what is protected is the *list*.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import MediaAsset, MediaAssetCreate, MediaAssetUpdate
from app.services.media_service import MediaService

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/", response_model=List[MediaAsset])
def list_media(
    q: str | None = Query(None, description="Match filename or alt text"),
    # Capped in the signature rather than checked in the body, so the bound is
    # part of the schema and FastAPI rejects an over-large page with a 422
    # instead of the service quietly deciding what the caller meant.
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Newest first. Admin only."""
    service = MediaService(db)
    return service.list(q=q, limit=limit, offset=offset)


@router.post("/", response_model=MediaAsset, status_code=201)
def register_media(payload: MediaAssetCreate, db: Session = Depends(get_db)):
    """Record an upload that has already reached Blob. Admin only.

    201 even when the URL was already registered. The call is idempotent by
    design — the console fires it straight after `upload()` returns, and a retry
    must not create a second row — and answering 200-vs-201 by whether a retry
    happened would make the client care about a difference it cannot act on.
    """
    service = MediaService(db)
    return service.register(payload)


@router.patch("/{asset_id}", response_model=MediaAsset)
def update_media(asset_id: int, payload: MediaAssetUpdate, db: Session = Depends(get_db)):
    """Edit alt text. Admin only.

    PATCH rather than PUT, because it is the accurate verb here and the schema
    has one optional field: a PUT carrying `{}` would have to mean "clear
    everything", which is not what any caller wants from a partial form.
    """
    service = MediaService(db)
    asset = service.update(asset_id, payload)
    if not asset:
        raise HTTPException(status_code=404, detail=ErrorMessages.MEDIA_NOT_FOUND)
    return asset


@router.delete("/{asset_id}")
def delete_media(asset_id: int, db: Session = Depends(get_db)):
    """Forget an asset. Admin only.

    Removes the index row, not the object in Blob — see MediaService.delete.
    Anything already pointing at the URL keeps working.
    """
    service = MediaService(db)
    if not service.delete(asset_id):
        raise HTTPException(status_code=404, detail=ErrorMessages.MEDIA_NOT_FOUND)
    return {"message": SuccessMessages.MEDIA_DELETED}
