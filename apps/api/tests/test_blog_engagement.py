"""Tags as rows, series, comments, ratings and revision history.

Four separate features share a file because they share a shape: each one is a
new table hanging off ``posts``, each has a public half and an admin half, and
the interesting cases are all about which half sees what.

The ones worth stating outright, because they are the failures that would
actually matter:

* A comment is never public until an admin says so. There is no code path that
  produces an approved comment, and ``test_a_new_comment_is_not_public``
  is what says so.
* A rating cannot be moved by voting twice.
* An edit is recoverable. A publish toggle is not an edit and must not fill the
  history with entries nobody wants to scroll past.

Runs against whatever ``DATABASE_URL`` points at and inserts rows; each test
cleans up what it made. See tests/conftest.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.slugs import unique_slug
from app.main import app
from app.models.portfolio import Post, Series, Tag

client = TestClient(app)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def track_post(db):
    made = []

    def _track(post_id: int) -> int:
        made.append(post_id)
        return post_id

    yield _track

    for post_id in made:
        record = db.query(Post).filter(Post.id == post_id).first()
        # Through the ORM so comments, ratings and revisions cascade with it.
        if record:
            db.delete(record)
    db.commit()


@pytest.fixture
def make_tag(db):
    made = []

    def _make(name: str, **fields) -> Tag:
        record = Tag(slug=unique_slug(db, Tag, name), name=name, **fields)
        db.add(record)
        db.commit()
        db.refresh(record)
        made.append(record.id)
        return record

    yield _make

    for tag_id in made:
        record = db.query(Tag).filter(Tag.id == tag_id).first()
        if record:
            record.posts = []
            db.delete(record)
    db.commit()


@pytest.fixture
def make_series(db):
    made = []

    def _make(title: str, *, published: bool = True) -> Series:
        record = Series(
            slug=unique_slug(db, Series, title), title=title, published=published
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        made.append(record.id)
        return record

    yield _make

    for series_id in made:
        record = db.query(Series).filter(Series.id == series_id).first()
        if record:
            for post in list(record.posts):
                post.series_id = None
            db.delete(record)
    db.commit()


@pytest.fixture
def make_post(db, track_post):
    def _make(title, *, published=True, tags=None, series=None, series_order=0):
        record = Post(
            slug=unique_slug(db, Post, title),
            title=title,
            body="Seeded by the test suite.",
            published=published,
            series_order=series_order,
        )
        if tags:
            record.tags = list(tags)
        if series is not None:
            record.series = series
        db.add(record)
        db.commit()
        db.refresh(record)
        track_post(record.id)
        return record

    return _make


# --- tags are rows now -----------------------------------------------------

def test_a_tag_must_exist_before_it_can_be_attached(admin_token, track_post):
    """The point of tags being rows: a typo fails loudly instead of forking a facet."""
    response = client.post(
        "/api/v1/posts/",
        json={"title": "Mistyped Tag", "body": "x", "tag_slugs": ["nextjs-typo"]},
        headers=_auth(admin_token),
    )

    assert response.status_code == 422
    assert "nextjs-typo" in response.text


def test_a_failed_tag_attach_creates_no_post(admin_token):
    """References resolve before the row is written, or every typo leaves a draft."""
    before = len(client.get("/api/v1/posts/", headers=_auth(admin_token)).json())

    client.post(
        "/api/v1/posts/",
        json={"title": "Never Written", "body": "x", "tag_slugs": ["does-not-exist"]},
        headers=_auth(admin_token),
    )

    after = len(client.get("/api/v1/posts/", headers=_auth(admin_token)).json())
    assert after == before


def test_every_missing_tag_is_named_at_once(admin_token):
    """Three typos should cost one round trip, not three."""
    response = client.post(
        "/api/v1/posts/",
        json={"title": "Several Typos", "body": "x", "tag_slugs": ["aa-x", "bb-y"]},
        headers=_auth(admin_token),
    )

    assert "aa-x" in response.text
    assert "bb-y" in response.text


def test_attaching_an_existing_tag_works(admin_token, track_post, make_tag):
    tag = make_tag("Postgres")

    created = client.post(
        "/api/v1/posts/",
        json={"title": "Properly Tagged", "body": "x", "tag_slugs": [tag.slug]},
        headers=_auth(admin_token),
    ).json()
    track_post(created["id"])

    assert [t["slug"] for t in created["tags"]] == [tag.slug]


def test_a_tag_count_only_counts_posts_the_caller_can_see(make_tag, make_post):
    """A facet promising nine posts and delivering two is worse than no facet."""
    tag = make_tag("Countable")
    make_post("Counted Because Published", published=True, tags=[tag])
    make_post("Not Counted Because Draft", published=False, tags=[tag])

    public = {t["slug"]: t["post_count"] for t in client.get("/api/v1/tags/").json()}

    assert public[tag.slug] == 1


def test_an_admin_sees_drafts_in_the_tag_count(make_tag, make_post, admin_token):
    tag = make_tag("Countable By Admin")
    make_post("Published One", published=True, tags=[tag])
    make_post("Draft One", published=False, tags=[tag])

    counts = {
        t["slug"]: t["post_count"]
        for t in client.get("/api/v1/tags/", headers=_auth(admin_token)).json()
    }

    assert counts[tag.slug] == 2


def test_deleting_a_tag_keeps_the_posts(make_tag, make_post, admin_token):
    """Only the filing goes."""
    tag = make_tag("Doomed")
    post = make_post("Survives Its Tag", published=True, tags=[tag])

    assert client.delete(f"/api/v1/tags/{tag.id}", headers=_auth(admin_token)).status_code == 200

    still_there = client.get(f"/api/v1/posts/{post.id}")
    assert still_there.status_code == 200
    assert still_there.json()["tags"] == []


def test_renaming_a_tag_leaves_its_slug_alone(make_tag, admin_token):
    """The slug is the URL. Renaming must not break links already published."""
    tag = make_tag("Old Name")

    updated = client.put(
        f"/api/v1/tags/{tag.id}", json={"name": "New Name"}, headers=_auth(admin_token)
    ).json()

    assert updated["name"] == "New Name"
    assert updated["slug"] == tag.slug


def test_writing_tags_needs_admin():
    assert client.post("/api/v1/tags/", json={"name": "Nope"}).status_code in (401, 403)


# --- search ----------------------------------------------------------------

def test_search_matches_the_body(make_post, db):
    """Readers search for a phrase they remember, which is rarely the title."""
    post = make_post("Search Target", published=True)
    post.body = "The distinguishing phrase is chiaroscuro."
    db.commit()

    slugs = [p["slug"] for p in client.get("/api/v1/posts/?q=chiaroscuro").json()]

    assert post.slug in slugs


def test_search_still_excludes_drafts(make_post, db):
    draft = make_post("Hidden Search Target", published=False)
    draft.body = "Another chiaroscuro mention."
    db.commit()

    slugs = [p["slug"] for p in client.get("/api/v1/posts/?q=chiaroscuro").json()]

    assert draft.slug not in slugs


def test_a_search_term_is_not_a_wildcard_pattern(make_post):
    """`%` is text a reader typed, not an instruction to match everything."""
    make_post("Definitely Published", published=True)

    results = client.get("/api/v1/posts/?q=%25").json()

    assert results == []


# --- series ----------------------------------------------------------------

def test_a_series_reads_oldest_first(make_series, make_post):
    """The one listing where newest-first would be wrong: part 1 comes first."""
    run = make_series("Building The Thing")
    make_post("Part Two", series=run, series_order=2)
    make_post("Part One", series=run, series_order=1)

    titles = [p["title"] for p in client.get(f"/api/v1/series/slug/{run.slug}/posts").json()]

    assert titles == ["Part One", "Part Two"]


def test_a_series_listing_excludes_draft_posts(make_series, make_post):
    run = make_series("Partly Written")
    make_post("Published Part", series=run, series_order=1)
    make_post("Unwritten Part", series=run, series_order=2, published=False)

    titles = [p["title"] for p in client.get(f"/api/v1/series/slug/{run.slug}/posts").json()]

    assert titles == ["Published Part"]


def test_a_draft_series_is_not_public(make_series):
    run = make_series("Not Announced Yet", published=False)

    assert client.get(f"/api/v1/series/slug/{run.slug}").status_code == 404


def test_deleting_a_series_keeps_its_posts(make_series, make_post, admin_token):
    """A series is a way of reading posts, not what they are."""
    run = make_series("Doomed Run")
    post = make_post("Outlives Its Series", series=run, series_order=1)

    client.delete(f"/api/v1/series/{run.id}", headers=_auth(admin_token))

    survivor = client.get(f"/api/v1/posts/{post.id}")
    assert survivor.status_code == 200
    assert survivor.json()["series"] is None


# --- comments --------------------------------------------------------------

def _comment(post_id, **fields):
    body = {
        "author_name": "A Reader",
        "author_email": "reader@example.com",
        "body": "This was useful, thank you.",
        **fields,
    }
    return client.post(f"/api/v1/posts/{post_id}/comments", json=body)


def test_a_new_comment_is_not_public(make_post):
    """The one that matters. Nothing here can approve a comment."""
    post = make_post("Commented On", published=True)

    assert _comment(post.id).status_code == 201

    assert client.get(f"/api/v1/posts/{post.id}/comments").json() == []


def test_an_approved_comment_is_public(make_post, admin_token):
    """Baseline: without it the test above could pass on a broken read."""
    post = make_post("Approved Comment Here", published=True)
    created = _comment(post.id).json()

    client.put(
        f"/api/v1/comments/{created['id']}",
        json={"status": "approved"},
        headers=_auth(admin_token),
    )

    public = client.get(f"/api/v1/posts/{post.id}/comments").json()
    assert [c["id"] for c in public] == [created["id"]]


def test_the_public_comment_shape_has_no_email(make_post, admin_token):
    """The address is how the owner replies. It is not published."""
    post = make_post("Email Must Not Leak", published=True)
    created = _comment(post.id).json()
    client.put(
        f"/api/v1/comments/{created['id']}",
        json={"status": "approved"},
        headers=_auth(admin_token),
    )

    public = client.get(f"/api/v1/posts/{post.id}/comments").json()[0]

    assert "author_email" not in public
    assert "author_hash" not in public
    assert "reader@example.com" not in str(public)


def test_the_create_response_also_hides_the_email(make_post):
    """The same model guards the echo the form shows back to its author."""
    post = make_post("Echo Hides Email", published=True)

    assert "author_email" not in _comment(post.id).json()


def test_an_admin_sees_pending_comments_in_the_queue(make_post, admin_token):
    post = make_post("Queued For Moderation", published=True)
    created = _comment(post.id).json()

    queue = client.get("/api/v1/comments/?status=pending", headers=_auth(admin_token)).json()

    entry = next(c for c in queue if c["id"] == created["id"])
    assert entry["status"] == "pending"
    # The queue spans every post, so it has to say which one this is on.
    assert entry["post_slug"] == post.slug


def test_the_moderation_queue_needs_admin():
    """It is where the spam is, and it carries commenters' addresses."""
    assert client.get("/api/v1/comments/").status_code in (401, 403)


def test_a_rejected_comment_stays_out_of_the_public_thread(make_post, admin_token):
    post = make_post("Rejected Comment Here", published=True)
    created = _comment(post.id).json()

    client.put(
        f"/api/v1/comments/{created['id']}",
        json={"status": "rejected"},
        headers=_auth(admin_token),
    )

    assert client.get(f"/api/v1/posts/{post.id}/comments").json() == []


def test_a_reply_must_name_an_approved_parent_on_the_same_post(make_post):
    """A parent from another post would render under a comment that is not there."""
    post = make_post("Has A Thread", published=True)
    elsewhere = make_post("Somewhere Else", published=True)
    stranger = _comment(elsewhere.id).json()

    response = _comment(post.id, parent_id=stranger["id"])

    assert response.status_code == 422


def test_replies_do_not_nest_two_deep(make_post, admin_token):
    """Below 375px there is no indentation left to spend on a third level."""
    post = make_post("Threaded Once", published=True)
    top = _comment(post.id).json()
    approve = {"status": "approved"}
    client.put(f"/api/v1/comments/{top['id']}", json=approve, headers=_auth(admin_token))

    reply = _comment(post.id, parent_id=top["id"]).json()
    client.put(f"/api/v1/comments/{reply['id']}", json=approve, headers=_auth(admin_token))

    assert _comment(post.id, parent_id=reply["id"]).status_code == 422


def test_commenting_on_a_draft_is_a_404(make_post):
    """The same answer the post itself gives a stranger."""
    draft = make_post("Not Yet Published", published=False)

    assert _comment(draft.id).status_code == 404


def test_deleting_a_comment_takes_its_replies(make_post, admin_token, db):
    post = make_post("Thread To Delete", published=True)
    top = _comment(post.id).json()
    approve = {"status": "approved"}
    client.put(f"/api/v1/comments/{top['id']}", json=approve, headers=_auth(admin_token))
    reply = _comment(post.id, parent_id=top["id"]).json()

    client.delete(f"/api/v1/comments/{top['id']}", headers=_auth(admin_token))

    remaining = client.get("/api/v1/comments/", headers=_auth(admin_token)).json()
    assert reply["id"] not in [c["id"] for c in remaining]


# --- ratings ---------------------------------------------------------------

def test_a_rating_shows_up_in_the_summary(make_post):
    post = make_post("Worth Five Stars", published=True)

    summary = client.post(f"/api/v1/posts/{post.id}/rating", json={"stars": 5}).json()

    assert summary["count"] == 1
    assert summary["average"] == 5.0
    assert summary["distribution"] == [0, 0, 0, 0, 1]
    assert summary["mine"] == 5


def test_voting_twice_replaces_the_first_vote(make_post):
    """Refreshing the page must not be able to move the average."""
    post = make_post("Changed My Mind", published=True)

    client.post(f"/api/v1/posts/{post.id}/rating", json={"stars": 5})
    summary = client.post(f"/api/v1/posts/{post.id}/rating", json={"stars": 2}).json()

    assert summary["count"] == 1
    assert summary["average"] == 2.0
    assert summary["mine"] == 2


def test_a_rating_outside_one_to_five_is_rejected(make_post):
    post = make_post("Not Six Stars", published=True)

    assert client.post(f"/api/v1/posts/{post.id}/rating", json={"stars": 6}).status_code == 422
    assert client.post(f"/api/v1/posts/{post.id}/rating", json={"stars": 0}).status_code == 422


def test_an_unrated_post_reports_zero_rather_than_nothing(make_post):
    """The control renders the summary unconditionally; None would 500 it."""
    post = make_post("Nobody Voted", published=True)

    summary = client.get(f"/api/v1/posts/{post.id}/rating").json()

    assert summary == {
        "average": 0.0,
        "count": 0,
        "distribution": [0, 0, 0, 0, 0],
        "mine": None,
    }


def test_rating_a_draft_is_a_404(make_post):
    draft = make_post("Unpublished And Unrateable", published=False)

    assert client.post(f"/api/v1/posts/{draft.id}/rating", json={"stars": 5}).status_code == 404


# --- revision history ------------------------------------------------------

def _revisions(post_id, token):
    return client.get(f"/api/v1/posts/{post_id}/revisions", headers=_auth(token)).json()


def test_editing_the_body_records_the_previous_version(make_post, admin_token, db):
    post = make_post("Edited Once", published=True)
    original = post.body

    client.put(
        f"/api/v1/posts/{post.id}",
        json={"body": "Rewritten entirely."},
        headers=_auth(admin_token),
    )

    history = _revisions(post.id, admin_token)
    assert len(history) == 1
    # The revision holds what the post *left*, not what it became.
    assert history[0]["body"] == original


def test_a_publish_toggle_is_not_an_edit(make_post, admin_token):
    """Otherwise the history fills with entries nobody wants to scroll past."""
    post = make_post("Toggled Only", published=False)

    client.put(
        f"/api/v1/posts/{post.id}", json={"published": True}, headers=_auth(admin_token)
    )

    assert _revisions(post.id, admin_token) == []


def test_a_revision_note_is_kept(make_post, admin_token):
    post = make_post("Noted Edit", published=True)

    client.put(
        f"/api/v1/posts/{post.id}",
        json={"body": "New text.", "revision_note": "Fixed the benchmark numbers"},
        headers=_auth(admin_token),
    )

    assert _revisions(post.id, admin_token)[0]["note"] == "Fixed the benchmark numbers"


def test_restoring_puts_the_body_back(make_post, admin_token):
    post = make_post("Restored Later", published=True)
    original = post.body
    client.put(
        f"/api/v1/posts/{post.id}", json={"body": "A regrettable rewrite."},
        headers=_auth(admin_token),
    )
    revision_id = _revisions(post.id, admin_token)[0]["id"]

    restored = client.post(
        f"/api/v1/posts/{post.id}/revisions/{revision_id}/restore",
        headers=_auth(admin_token),
    ).json()

    assert restored["body"] == original


def test_restoring_is_itself_undoable(make_post, admin_token):
    """The version being replaced is snapshotted first, so a misclick is cheap."""
    post = make_post("Restore Then Undo", published=True)
    client.put(
        f"/api/v1/posts/{post.id}", json={"body": "Second draft."},
        headers=_auth(admin_token),
    )
    first_revision = _revisions(post.id, admin_token)[0]["id"]

    client.post(
        f"/api/v1/posts/{post.id}/revisions/{first_revision}/restore",
        headers=_auth(admin_token),
    )

    history = _revisions(post.id, admin_token)
    assert len(history) == 2
    assert history[0]["body"] == "Second draft."


def test_revision_history_is_admin_only(make_post):
    """It holds drafts and paragraphs that were thought better of."""
    post = make_post("Public Post Private History", published=True)

    assert client.get(f"/api/v1/posts/{post.id}/revisions").status_code in (401, 403)


def test_a_restored_revision_drops_tags_that_no_longer_exist(
    make_post, make_tag, admin_token, db
):
    """The snapshot records what the post carried, not permission to resurrect a tag."""
    tag = make_tag("Temporarily Used")
    post = make_post("Tagged Then Untagged", published=True, tags=[tag])
    client.put(
        f"/api/v1/posts/{post.id}", json={"body": "Changed."}, headers=_auth(admin_token)
    )
    revision_id = _revisions(post.id, admin_token)[0]["id"]
    client.delete(f"/api/v1/tags/{tag.id}", headers=_auth(admin_token))

    restored = client.post(
        f"/api/v1/posts/{post.id}/revisions/{revision_id}/restore",
        headers=_auth(admin_token),
    ).json()

    assert restored["tags"] == []
