"""Blog endpoints: draft visibility, ordering, and the publication stamp.

The draft/published cases are the same question ``test_content_api.py`` asks of
the other content types, asked again here because the answer comes from a new
set of service methods rather than a shared one — a filter is only tested where
it is written.

The publication stamp is the part that is genuinely new. ``published_at`` drives
the order of the index, the ``<time>`` on each post, the sitemap's
``lastmod`` and the RSS ``pubDate``, and it is derived by the service rather
than supplied by the caller. That makes it worth pinning down: when it is set,
when it must not move, and who can override it.

Runs against whatever ``DATABASE_URL`` points at and inserts rows; each test
cleans up what it made.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.slugs import unique_slug
from app.main import app
from app.models.portfolio import Post

client = TestClient(app)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def track_post(db):
    """Remove post rows a test created, including ones made through the API."""
    made = []

    def _track(post_id: int) -> int:
        made.append(post_id)
        return post_id

    yield _track

    for post_id in made:
        db.query(Post).filter(Post.id == post_id).delete()
    db.commit()


@pytest.fixture
def make_post(db, track_post):
    def _make(title, *, published: bool, published_at=None, tags=None):
        record = Post(
            slug=unique_slug(db, Post, title),
            title=title,
            body="Seeded by the test suite.",
            tags=tags,
            published=published,
            published_at=published_at,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        track_post(record.id)
        return record

    return _make


def _create_via_api(admin_token, track_post, **payload):
    """POST a post as the admin and register it for cleanup."""
    body = {"title": "Written By The Suite", "body": "# Hello", **payload}
    response = client.post("/api/v1/posts/", json=body, headers=_auth(admin_token))
    assert response.status_code == 200, response.text
    created = response.json()
    track_post(created["id"])
    return created


# --- draft visibility ------------------------------------------------------

def test_a_draft_post_is_not_in_the_public_list(make_post):
    draft = make_post("Unfinished Thoughts", published=False)

    slugs = [p["slug"] for p in client.get("/api/v1/posts/").json()]

    assert draft.slug not in slugs


def test_a_published_post_is_in_the_public_list(make_post):
    """Baseline: without this the test above could pass on an empty list."""
    live = make_post("Finished Thoughts", published=True)

    slugs = [p["slug"] for p in client.get("/api/v1/posts/").json()]

    assert live.slug in slugs


def test_fetching_a_draft_post_by_id_is_a_404_not_a_403(make_post):
    """403 would confirm the row exists. Whether a draft exists is not public."""
    draft = make_post("Secret Draft Post", published=False)

    assert client.get(f"/api/v1/posts/{draft.id}").status_code == 404


def test_fetching_a_draft_post_by_slug_is_a_404(make_post):
    draft = make_post("Secret Draft Post By Slug", published=False)

    assert client.get(f"/api/v1/posts/slug/{draft.slug}").status_code == 404


def test_an_admin_sees_draft_posts(make_post, admin_token):
    draft = make_post("Visible To The Author", published=False)

    response = client.get("/api/v1/posts/", headers=_auth(admin_token))

    assert draft.slug in [p["slug"] for p in response.json()]


def test_a_bogus_token_still_gets_the_public_list(make_post):
    """A stale token in a visitor's browser means anonymous, not 401."""
    live = make_post("Readable Without Credentials", published=True)

    response = client.get("/api/v1/posts/", headers=_auth("not-a-real-token"))

    assert response.status_code == 200
    assert live.slug in [p["slug"] for p in response.json()]


def test_writing_posts_needs_admin():
    payload = {"title": "Unauthorised", "body": "nope"}

    assert client.post("/api/v1/posts/", json=payload).status_code in (401, 403)


def test_deleting_a_post_needs_admin(make_post):
    live = make_post("Not Yours To Delete", published=True)

    assert client.delete(f"/api/v1/posts/{live.id}").status_code in (401, 403)


# --- ordering --------------------------------------------------------------

def test_posts_are_listed_newest_first(make_post):
    """The index reads as a feed, so the newest publication date leads."""
    now = datetime.now(timezone.utc)
    older = make_post("Older Post", published=True, published_at=now - timedelta(days=30))
    newer = make_post("Newer Post", published=True, published_at=now - timedelta(days=1))

    slugs = [p["slug"] for p in client.get("/api/v1/posts/").json()]

    assert slugs.index(newer.slug) < slugs.index(older.slug)


def test_drafts_sort_after_published_posts_for_an_admin(make_post, admin_token):
    """A draft has no publication date; NULLS LAST is what keeps it off the top."""
    live = make_post(
        "Published And Dated",
        published=True,
        published_at=datetime.now(timezone.utc) - timedelta(days=365),
    )
    draft = make_post("Draft With No Date", published=False)

    slugs = [p["slug"] for p in client.get("/api/v1/posts/", headers=_auth(admin_token)).json()]

    assert slugs.index(live.slug) < slugs.index(draft.slug)


# --- the publication stamp -------------------------------------------------

def test_a_draft_has_no_publication_date(admin_token, track_post):
    created = _create_via_api(admin_token, track_post, title="Still A Draft", published=False)

    assert created["published_at"] is None


def test_publishing_stamps_the_date(admin_token, track_post):
    created = _create_via_api(admin_token, track_post, title="About To Go Live", published=False)

    updated = client.put(
        f"/api/v1/posts/{created['id']}",
        json={"published": True},
        headers=_auth(admin_token),
    ).json()

    assert updated["published_at"] is not None


def test_republishing_keeps_the_original_date(admin_token, track_post):
    """Unpublishing to fix a typo must not reorder the feed or rewrite history."""
    created = _create_via_api(admin_token, track_post, title="Briefly Retracted", published=True)
    original = created["published_at"]
    assert original is not None

    def put(body):
        return client.put(
            f"/api/v1/posts/{created['id']}", json=body, headers=_auth(admin_token)
        ).json()

    put({"published": False})
    republished = put({"published": True})

    assert republished["published_at"] == original


def test_an_explicit_publication_date_is_kept(admin_token, track_post):
    """Backdating a post that was written before the blog existed."""
    backdated = "2020-01-02T03:04:05Z"

    created = _create_via_api(
        admin_token,
        track_post,
        title="Written Long Ago",
        published=True,
        published_at=backdated,
    )

    assert created["published_at"].startswith("2020-01-02T03:04:05")


# --- slugs and shapes ------------------------------------------------------

def test_a_slug_is_derived_from_the_title(admin_token, track_post):
    created = _create_via_api(admin_token, track_post, title="Hello, World!!")

    assert created["slug"] == "hello-world"


def test_an_explicit_slug_is_honoured(admin_token, track_post):
    """A post's URL is the one thing worth hand-setting: it is permanent."""
    created = _create_via_api(
        admin_token, track_post, title="A Long Editorial Title", slug="short-url"
    )

    assert created["slug"] == "short-url"


def test_a_post_with_no_tags_serialises_them_as_empty_not_null(make_post):
    """The JSON column is nullable; a NULL would 500 the list on the way out."""
    live = make_post("No Tags At All", published=True, tags=None)

    assert client.get(f"/api/v1/posts/{live.id}").json()["tags"] == []


def test_the_body_is_returned_verbatim(admin_token, track_post):
    """The API stores Markdown and does not render or escape it."""
    markdown = "# Heading\n\nSome *emphasis* and `code`.\n"

    created = _create_via_api(admin_token, track_post, body=markdown)

    assert created["body"] == markdown


# --- tags ------------------------------------------------------------------

def test_the_tag_filter_selects_matching_posts(make_post):
    tagged = make_post("Tagged Post", published=True, tags=["Tailwind", "CSS"])
    untagged = make_post("Differently Tagged Post", published=True, tags=["FastAPI"])

    slugs = [p["slug"] for p in client.get("/api/v1/posts/?tag=Tailwind").json()]

    assert tagged.slug in slugs
    assert untagged.slug not in slugs


def test_the_tag_filter_still_excludes_drafts(make_post):
    """Two filters compose here, and the publish one has to survive."""
    draft = make_post("Tagged But Unpublished", published=False, tags=["Tailwind"])

    slugs = [p["slug"] for p in client.get("/api/v1/posts/?tag=Tailwind").json()]

    assert draft.slug not in slugs
