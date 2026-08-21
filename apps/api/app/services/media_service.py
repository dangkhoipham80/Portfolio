from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.portfolio import MediaAsset
from app.schemas.portfolio import MediaAssetCreate, MediaAssetUpdate


class MediaService:
    """The image library.

    Separate from ``PortfolioService`` rather than another set of methods on it,
    because the thing it manages is not content. Every read in that class takes
    ``include_unpublished`` and defaults to hiding drafts, since everything it
    returns is a candidate for a public page. Nothing here is: an asset has no
    published state, the whole table is admin-only, and giving it a parameter
    that is always the same value would be inviting someone to believe it means
    something.
    """

    def __init__(self, db: Session):
        self.db = db

    def register(self, payload: MediaAssetCreate) -> MediaAsset:
        """Record an upload, or return the row that already records it.

        Idempotent on the URL, which matters because the client calls this
        immediately after ``upload()`` returns and a retried request must not
        produce a second row for one object. The existing row wins outright: a
        re-registration carries no information the first one did not, and
        overwriting would let a retry with a failed dimension read blank out
        measurements the first attempt got right.
        """
        existing = self.db.query(MediaAsset).filter(MediaAsset.url == payload.url).first()
        if existing:
            return existing

        asset = MediaAsset(**payload.model_dump())
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def list(self, *, q: Optional[str] = None, limit: int = 60, offset: int = 0) -> List[MediaAsset]:
        """Newest first, which is what a picker wants — you almost always want
        the thing you just uploaded.

        ``limit`` is capped by the route rather than trusted from the caller.
        """
        query = self.db.query(MediaAsset)

        if q:
            # Filename and alt text are the only two human-written handles on a
            # row. Matching the URL as well would mean matching the random
            # suffix, which nobody types.
            pattern = f"%{q}%"
            query = query.filter(
                or_(MediaAsset.pathname.ilike(pattern), MediaAsset.alt.ilike(pattern))
            )

        return (
            query.order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get(self, asset_id: int) -> Optional[MediaAsset]:
        return self.db.query(MediaAsset).filter(MediaAsset.id == asset_id).first()

    def update(self, asset_id: int, payload: MediaAssetUpdate) -> Optional[MediaAsset]:
        asset = self.get(asset_id)
        if not asset:
            return None

        # exclude_unset, matching PortfolioService._apply_update: an explicit
        # null means "clear the alt text", and dropping nulls would make a
        # description impossible to remove once written.
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(asset, field, value)

        self.db.commit()
        self.db.refresh(asset)
        return asset

    def delete(self, asset_id: int) -> bool:
        """Forget the asset.

        This removes the index entry, not the object in Blob — the API has no
        credentials for the bucket, and the deployment that does is the web app.
        Content already referencing the URL keeps rendering, which is the
        documented trade in the model's docstring.
        """
        asset = self.get(asset_id)
        if not asset:
            return False

        self.db.delete(asset)
        self.db.commit()
        return True
