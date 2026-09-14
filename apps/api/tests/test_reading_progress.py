"""Where a reader has got to in each post.

The claim this file is really about is the boring one: **progress belongs to the
account it was written by, and there is no way to ask for anyone else's**. That
is enforced by shape rather than by a check — no route here takes a user id and
no payload carries one — so the test for it has to do the only thing an attacker
could actually do, which is write with one account and then look with another.

The rest is the behaviour that makes the number useful: it is a high-water mark
rather than a cursor, so re-opening a post does not erase what you read; and
reaching the end sets a flag that scrolling back up does not clear.

Runs against whatever ``DATABASE_URL`` points at; see tests/conftest.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.slugs import unique_slug
from app.main import app
from app.models.portfolio import Post
from app.models.token import TokenType
from app.services.portfolio_service import FINISHED_AT_PROGRESS
from app.services.user_service import UserService

client = TestClient(app)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def make_post(db, track_post):
    def _make(title, *, published=True):
        record = Post(
            slug=unique_slug(db, Post, title),
            title=title,
            body="Seeded by the test suite.",
            published=published,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        track_post(record.id)
        return record

    return _make


@pytest.fixture
def other_reader_token(db, make_user):
    """A second account, for the case that matters."""
    user = make_user("someone-else@example.invalid")
    return UserService(db).create_token(user.id, TokenType.ACCESS, expires_in_minutes=10)


def _save(post_id, token, progress, **fields):
    return client.put(
        f"/api/v1/reading/posts/{post_id}",
        json={"progress": progress, **fields},
        headers=_auth(token),
    )


# --- ownership --------------------------------------------------------------

def test_anonymous_callers_are_refused(make_post):
    post = make_post("No Anonymous Progress")

    assert client.get("/api/v1/reading/").status_code in (401, 403)
    assert (
        client.put(
            f"/api/v1/reading/posts/{post.id}", json={"progress": 0.5}
        ).status_code
        in (401, 403)
    )


def test_one_reader_cannot_move_anothers_progress(
    make_post, reader_token, other_reader_token
):
    """The one that matters.

    There is no route that takes a user id, so this is the strongest form the
    attack can take: write to the same post as somebody else and check that two
    rows exist rather than one.
    """
    post = make_post("Two Readers One Post")

    _save(post.id, reader_token, 0.8)
    _save(post.id, other_reader_token, 0.1)

    mine = client.get(
        f"/api/v1/reading/posts/{post.id}", headers=_auth(reader_token)
    ).json()
    theirs = client.get(
        f"/api/v1/reading/posts/{post.id}", headers=_auth(other_reader_token)
    ).json()

    assert mine["progress"] == pytest.approx(0.8)
    assert theirs["progress"] == pytest.approx(0.1)


def test_the_list_shows_only_your_own(make_post, reader_token, other_reader_token):
    post = make_post("Only Mine")
    _save(post.id, other_reader_token, 0.9)

    listed = client.get("/api/v1/reading/", headers=_auth(reader_token)).json()

    assert all(entry["post_id"] != post.id for entry in listed)


def test_an_admin_is_an_ordinary_reader_here(make_post, admin_token, reader_token):
    """Admins have reading progress, under their own account, like anyone else.

    The owner reading their own blog from the public site is not anonymous and
    is not special: their row is their row, and there is no route that hands
    them anyone else's.
    """
    post = make_post("The Owner Reads Too")

    _save(post.id, admin_token, 0.42)
    _save(post.id, reader_token, 0.11)

    theirs = client.get(
        f"/api/v1/reading/posts/{post.id}", headers=_auth(admin_token)
    ).json()

    assert theirs["progress"] == pytest.approx(0.42)


# --- the number itself ------------------------------------------------------

def test_progress_is_stored_and_read_back(make_post, reader_token):
    post = make_post("Stored And Read Back")

    saved = _save(post.id, reader_token, 0.25)
    assert saved.status_code == 200

    read = client.get(
        f"/api/v1/reading/posts/{post.id}", headers=_auth(reader_token)
    ).json()
    assert read["progress"] == pytest.approx(0.25)
    assert read["post_slug"] == post.slug
    assert read["post_title"] == post.title


def test_a_second_write_updates_rather_than_appending(make_post, reader_token, db):
    """One row per reader per post. The unique constraint says so; this checks."""
    post = make_post("Upsert Not Append")

    for value in (0.1, 0.2, 0.3):
        _save(post.id, reader_token, value)

    listed = client.get("/api/v1/reading/", headers=_auth(reader_token)).json()
    assert len([e for e in listed if e["post_id"] == post.id]) == 1


def test_progress_only_goes_up(make_post, reader_token):
    """Re-opening a post puts the browser at the top. That is not "unread"."""
    post = make_post("High Water Mark")

    _save(post.id, reader_token, 0.7)
    _save(post.id, reader_token, 0.02)

    read = client.get(
        f"/api/v1/reading/posts/{post.id}", headers=_auth(reader_token)
    ).json()
    assert read["progress"] == pytest.approx(0.7)


def test_reaching_the_end_marks_the_post_finished(make_post, reader_token):
    post = make_post("Read To The End")

    body = _save(post.id, reader_token, FINISHED_AT_PROGRESS).json()

    assert body["finished"] is True
    assert body["finished_at"] is not None


def test_stopping_short_does_not_mark_it_finished(make_post, reader_token):
    post = make_post("Stopped Halfway")

    assert _save(post.id, reader_token, 0.5).json()["finished"] is False


def test_scrolling_back_up_does_not_un_finish_it(make_post, reader_token):
    """Finished is a decision, not a measurement of where the scrollbar is."""
    post = make_post("Still Finished")
    _save(post.id, reader_token, 1.0)

    assert _save(post.id, reader_token, 0.1).json()["finished"] is True


def test_finished_can_be_set_by_hand_before_the_end(make_post, reader_token):
    """"I am done with this" is a thing a reader is allowed to say."""
    post = make_post("Marked By Hand")

    assert _save(post.id, reader_token, 0.3, finished=True).json()["finished"] is True


def test_finished_can_be_taken_back(make_post, reader_token):
    """The one direction the inferred flag will not go, the explicit one will."""
    post = make_post("Actually Not Yet")
    _save(post.id, reader_token, 1.0)

    body = _save(post.id, reader_token, 1.0, finished=False).json()

    assert body["finished"] is False
    assert body["finished_at"] is None


def test_a_progress_outside_zero_to_one_is_refused(make_post, reader_token):
    """The schema's range, so a nonsense value is a 422 and not a stored 47."""
    post = make_post("Out Of Range")

    assert _save(post.id, reader_token, 47).status_code == 422
    assert _save(post.id, reader_token, -1).status_code == 422


def test_progress_on_a_post_that_does_not_exist_is_a_404(reader_token):
    assert _save(999_999_999, reader_token, 0.5).status_code == 404


def test_progress_on_a_draft_is_a_404_for_a_reader(make_post, reader_token):
    """Same answer a draft gives a stranger everywhere else on this API."""
    draft = make_post("Unpublished", published=False)

    assert _save(draft.id, reader_token, 0.5).status_code == 404


def test_a_post_never_opened_has_no_row(make_post, reader_token):
    """404 rather than a zeroed row: "never opened" is not "read nothing"."""
    post = make_post("Never Opened")

    assert (
        client.get(
            f"/api/v1/reading/posts/{post.id}", headers=_auth(reader_token)
        ).status_code
        == 404
    )


def test_the_list_is_most_recently_read_first(make_post, reader_token):
    first = make_post("Read First")
    second = make_post("Read Second")

    _save(first.id, reader_token, 0.3)
    _save(second.id, reader_token, 0.3)

    listed = client.get("/api/v1/reading/", headers=_auth(reader_token)).json()
    ordered = [e["post_id"] for e in listed if e["post_id"] in (first.id, second.id)]

    assert ordered == [second.id, first.id]
