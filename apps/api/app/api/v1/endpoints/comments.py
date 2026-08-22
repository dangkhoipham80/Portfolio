"""Comment moderation. Admin-only throughout, reads included.

Separate from the posts router rather than living under ``/posts/comments``,
and that is a routing constraint rather than a preference: ``/posts/{post_id}``
declares an ``int`` path parameter, so ``/posts/comments/pending`` would be
matched against it and 422 on "comments" not being a number.

Reading a comment is as sensitive as approving one — the queue is where the spam
is, and it carries the author's email address, which the public schema
deliberately cannot express. So the router carries ``require_admin`` itself,
the same arrangement as endpoints/media.py, rather than each route repeating it
and one of them eventually not.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.models.portfolio import CommentStatus
from app.schemas.portfolio import PostCommentAdmin, PostCommentModerate
from app.services.portfolio_service import PortfolioService

router = APIRouter(dependencies=[Depends(require_admin)])


def _present(comment) -> PostCommentAdmin:
    """The comment, plus which post it is on.

    The queue spans every post, so a row without its post's title is a paragraph
    of text with no way to judge whether it belongs. Read through the
    relationship rather than joined by hand — the queue is a screenful, and the
    post is already in the session for most of them.
    """
    presented = PostCommentAdmin.model_validate(comment)
    if comment.post is not None:
        presented.post_slug = comment.post.slug
        presented.post_title = comment.post.title
    return presented


@router.get("/", response_model=List[PostCommentAdmin])
def get_comment_queue(
    status: Optional[CommentStatus] = Query(
        None, description="Filter to one moderation state; omit for all"
    ),
    db: Session = Depends(get_db),
):
    """The moderation queue across every post, newest first."""
    service = PortfolioService(db)
    return [_present(comment) for comment in service.get_comment_queue(status=status)]


@router.put("/{comment_id}", response_model=PostCommentAdmin)
def moderate_comment(
    comment_id: int, payload: PostCommentModerate, db: Session = Depends(get_db)
):
    """Approve or reject a comment.

    Rejection keeps the row rather than deleting it, so the same spam arriving
    again is recognisable in the queue instead of looking new. Deleting is a
    separate, explicit action.
    """
    service = PortfolioService(db)
    updated = service.moderate_comment(comment_id, payload.status)
    if not updated:
        raise HTTPException(status_code=404, detail=ErrorMessages.COMMENT_NOT_FOUND)
    return _present(updated)


@router.delete("/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    """Delete a comment, and any replies under it."""
    service = PortfolioService(db)
    if not service.delete_comment(comment_id):
        raise HTTPException(status_code=404, detail=ErrorMessages.COMMENT_NOT_FOUND)
    return {"message": SuccessMessages.COMMENT_DELETED}
