"""Where a reader has got to in each post. Authenticated throughout.

## Why this is its own router rather than routes under /posts

Routing, in the first instance, and the same constraint that put the moderation
queue in its own file: ``/posts/{post_id}`` declares an ``int`` path parameter,
so ``/posts/reading`` would be matched against it and 422 on "reading" not being
a number. The reading list spans every post and needs a path that is not under
one.

It earns the separation on its own account too. Every route in endpoints/posts.py
is about a post and most of them are public; every route here is about a
*person* and none of them are. Mixing the two would mean one file where the
default is "anyone may read this" and one route where it is emphatically not.

## The ownership rule

There is no route here that takes a user id, and that is the whole design rather
than an omission. The account is resolved from the bearer token by
``get_current_user_dependency`` and the service methods require it as their
first argument, so "read somebody else's progress" is not a request that can be
expressed — there is no path to put another id in and no payload field that
carries one. See ReadingProgressWrite.

An admin is an ordinary reader here. ``require_admin`` appears nowhere in this
file: the owner reading their own blog has reading progress like anyone else,
kept under their own account, and there is deliberately no route that lets them
see anyone else's.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user_dependency
from app.core.constants import ErrorMessages
from app.core.database import get_db
from app.schemas.portfolio import ReadingProgress, ReadingProgressWrite
from app.services.portfolio_service import PortfolioService

router = APIRouter(dependencies=[Depends(get_current_user_dependency)])


def _present(record) -> ReadingProgress:
    """The row, plus enough of its post to render a list entry.

    Read through the relationship rather than joined by hand: a reading list is
    a screenful, and the alternative is a second request per row from whoever is
    rendering it.
    """
    presented = ReadingProgress.model_validate(record)
    if record.post is not None:
        presented.post_slug = record.post.slug
        presented.post_title = record.post.title
    return presented


@router.get("/", response_model=List[ReadingProgress])
def list_my_reading(
    db: Session = Depends(get_db),
    reader=Depends(get_current_user_dependency),
):
    """Everything this account has opened, most recently read first.

    Includes finished posts rather than filtering them out. "Which of these have
    I already read" is the other half of the question this list answers, and a
    list that silently drops a post the moment it is finished cannot answer it.
    """
    service = PortfolioService(db)
    return [_present(record) for record in service.list_reading_progress(reader.id)]


@router.get("/posts/{post_id}", response_model=ReadingProgress)
def get_my_progress(
    post_id: int,
    db: Session = Depends(get_db),
    reader=Depends(get_current_user_dependency),
):
    """This account's progress on one post.

    404 when there is no row, which is the honest answer: the reader has not
    opened this post, and inventing a zeroed row would make "never opened" and
    "opened and read nothing" the same state.
    """
    service = PortfolioService(db)
    record = service.get_reading_progress(reader.id, post_id)
    if record is None:
        raise HTTPException(status_code=404, detail="No reading progress for that post")
    return _present(record)


@router.put("/posts/{post_id}", response_model=ReadingProgress)
def save_my_progress(
    post_id: int,
    payload: ReadingProgressWrite,
    db: Session = Depends(get_db),
    reader=Depends(get_current_user_dependency),
):
    """Record how far this account has got. Creates the row if it is the first time.

    PUT rather than POST because it is idempotent and the resource is "this
    reader's progress on this post", which is one thing at one address however
    many times it is written. The client sends these while somebody scrolls, so
    a verb that promises a new resource each time would be a lie about what a
    retry does.

    The post has to exist and be visible, and it is checked *through the reader*
    — a draft is a 404 to a reader who is not an admin, exactly as it is on the
    post routes, so this cannot be used to discover that an unpublished post
    exists by watching for a different error.

    Deliberately not rate limited. The recorder in the browser already throttles
    to at most ten writes for a whole article, and a limit here would silently
    stop recording mid-post for the one reader who genuinely reads all day.
    """
    service = PortfolioService(db)

    post = service.get_post(post_id, include_unpublished=reader.is_admin)
    if not post:
        raise HTTPException(status_code=404, detail=ErrorMessages.POST_NOT_FOUND)

    record = service.save_reading_progress(
        reader.id, post_id, payload.progress, finished=payload.finished
    )
    return _present(record)
