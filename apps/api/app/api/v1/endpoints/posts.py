"""Blog posts, and everything hanging off one: comments, ratings, history.

Three audiences share this router and the split is worth stating once, because
every route below is one of the three:

* **Anonymous.** Reads of published posts, reads of approved comments, and one
  write — a star rating, which is a single integer and carries no text.
* **Anonymous but moderated.** Posting a comment. It is accepted and queued;
  nothing here can approve one.
* **Admin.** Writing posts, and reading the revision history. Drafts and
  unapproved comments are invisible to everyone else, and that is enforced by
  the service defaulting ``include_unpublished`` to False rather than by each
  route remembering to ask.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_optional_admin, require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.visitors import visitor_hash
from app.schemas.portfolio import (
    Post,
    PostComment,
    PostCommentCreate,
    PostCreate,
    PostRatingCreate,
    PostRatingSummary,
    PostRevision,
    PostUpdate,
)
from app.services.portfolio_service import PortfolioService

router = APIRouter()

# A second comment limit, keyed on the visitor handle rather than the address,
# over a window the in-process rate limiter cannot hold. slowapi's buckets live
# in a dict and are emptied by a deploy; this one is a count of rows and is not.
COMMENT_WINDOW = timedelta(hours=24)
COMMENT_LIMIT_PER_WINDOW = 10


@router.get("/", response_model=List[Post])
def get_posts(
    tag: Optional[str] = Query(None, description="Only posts carrying this tag slug"),
    series: Optional[str] = Query(None, description="Only posts in this series slug"),
    q: Optional[str] = Query(
        None, max_length=120, description="Match title, excerpt or body"
    ),
    db: Session = Depends(get_db),
    viewer=Depends(get_optional_admin),
):
    """Get published posts, newest first; admins also see drafts."""
    service = PortfolioService(db)
    return service.get_posts(
        tag=tag, series=series, q=q, include_unpublished=viewer is not None
    )


@router.get("/slug/{slug}", response_model=Post)
def get_post_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    viewer=Depends(get_optional_admin),
):
    """Get a specific post by slug"""
    service = PortfolioService(db)
    post = service.get_post_by_slug(slug, include_unpublished=viewer is not None)
    if not post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return post


@router.get("/{post_id}", response_model=Post)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    viewer=Depends(get_optional_admin),
):
    """Get a specific post by ID"""
    service = PortfolioService(db)
    # A draft 404s for anonymous callers rather than 403ing, as everywhere
    # else: whether an unpublished post exists at that id is itself not public.
    post = service.get_post(post_id, include_unpublished=viewer is not None)
    if not post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return post


@router.post("/", response_model=Post, dependencies=[Depends(require_admin)])
def create_post(post: PostCreate, db: Session = Depends(get_db)):
    """Create a new post"""
    service = PortfolioService(db)
    return service.create_post(post)


@router.put("/{post_id}", response_model=Post, dependencies=[Depends(require_admin)])
def update_post(
    post_id: int,
    post: PostUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing post"""
    service = PortfolioService(db)
    updated_post = service.update_post(post_id, post)
    if not updated_post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return updated_post


@router.delete("/{post_id}", dependencies=[Depends(require_admin)])
def delete_post(post_id: int, db: Session = Depends(get_db)):
    """Delete a post"""
    service = PortfolioService(db)
    success = service.delete_post(post_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return {"message": SuccessMessages.POST_DELETED}


def _visible_post(service: PortfolioService, post_id: int, viewer) -> Post:
    """The post, or a 404 — the same answer a draft gives a stranger.

    Every route hanging off a post starts here, so none of them can be used to
    discover that an unpublished post exists by watching for a different error.
    """
    post = service.get_post(post_id, include_unpublished=viewer is not None)
    if not post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return post


# Comments
@router.get("/{post_id}/comments", response_model=List[PostComment])
def get_post_comments(
    post_id: int,
    db: Session = Depends(get_db),
    viewer=Depends(get_optional_admin),
):
    """Approved comments on a post, oldest first.

    Approved only, for admins too. The moderation queue is its own screen and
    mixing pending comments into the public thread here would mean the response
    shape depended on who asked — which is exactly how an unapproved comment
    ends up rendered on the public page by a consumer that did not check.
    """
    service = PortfolioService(db)
    _visible_post(service, post_id, viewer)
    return service.get_comments(post_id)


@router.post("/{post_id}/comments", response_model=PostComment, status_code=201)
@limiter.limit("5/hour")
def create_post_comment(
    request: Request,
    # Load-bearing despite being unused — see the same parameter on the contact
    # form: slowapi writes its X-RateLimit-* headers into it, and without the
    # parameter it raises on every *successful* post rather than only on the 429.
    response: Response,
    post_id: int,
    payload: PostCommentCreate,
    db: Session = Depends(get_db),
    viewer=Depends(get_optional_admin),
):
    """Queue a comment for moderation. Public, rate limited.

    The response is the comment as stored, which is deliberately not the same as
    the comment being visible: it comes back so the form can show the author
    their own words while they wait, and `GET /comments` will not return it
    until it is approved.
    """
    service = PortfolioService(db)
    _visible_post(service, post_id, viewer)

    author_hash = visitor_hash(request, scope="comment")
    since = datetime.now(timezone.utc) - COMMENT_WINDOW

    if service.count_recent_comments(author_hash, since) >= COMMENT_LIMIT_PER_WINDOW:
        # 429 rather than a silent drop: a person who has genuinely written ten
        # comments in a day should be told the limit exists, not left thinking
        # the form is broken.
        raise HTTPException(
            status_code=429,
            detail="That is a lot of comments for one day. Try again tomorrow.",
        )

    return service.create_comment(post_id, payload, author_hash=author_hash)


# Ratings
@router.get("/{post_id}/rating", response_model=PostRatingSummary)
def get_post_rating(
    request: Request,
    post_id: int,
    db: Session = Depends(get_db),
    viewer=Depends(get_optional_admin),
):
    """A post's star summary, including this caller's own vote if they have one."""
    service = PortfolioService(db)
    _visible_post(service, post_id, viewer)
    return service.get_rating_summary(
        post_id, voter_hash=visitor_hash(request, scope="rating")
    )


@router.post("/{post_id}/rating", response_model=PostRatingSummary)
@limiter.limit("30/hour")
def rate_post(
    request: Request,
    response: Response,
    post_id: int,
    payload: PostRatingCreate,
    db: Session = Depends(get_db),
    viewer=Depends(get_optional_admin),
):
    """Score a post out of five. Public; one standing vote per visitor.

    Re-voting replaces the previous score rather than adding to it, so the
    limiter above is a brake on hammering the endpoint and not what protects the
    average — the unique constraint does that.
    """
    service = PortfolioService(db)
    _visible_post(service, post_id, viewer)
    return service.rate_post(
        post_id, payload.stars, voter_hash=visitor_hash(request, scope="rating")
    )


# Revision history
@router.get(
    "/{post_id}/revisions",
    response_model=List[PostRevision],
    dependencies=[Depends(require_admin)],
)
def get_post_revisions(post_id: int, db: Session = Depends(get_db)):
    """Every past version of a post, newest first. Admin only.

    Admin-only even though a published post's current text is public: the
    history holds drafts, deleted paragraphs and things written and thought
    better of, none of which were ever published.
    """
    service = PortfolioService(db)
    post = service.get_post(post_id, include_unpublished=True)
    if not post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)
    return service.get_revisions(post_id)


@router.post(
    "/{post_id}/revisions/{revision_id}/restore",
    response_model=Post,
    dependencies=[Depends(require_admin)],
)
def restore_post_revision(
    post_id: int, revision_id: int, db: Session = Depends(get_db)
):
    """Put a post back to an earlier version. Admin only.

    The version being replaced is snapshotted first, so this is undoable by the
    same route.
    """
    service = PortfolioService(db)
    restored = service.restore_revision(post_id, revision_id)
    if not restored:
        raise HTTPException(status_code=404, detail=ErrorMessages.REVISION_NOT_FOUND)
    return restored
