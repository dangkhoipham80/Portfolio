"""What language a post is in, and how its other language versions are reached.

A translation is its own post row — its own slug, body, draft state and
revisions — linked to the original by one nullable self-referencing key. That
choice is what these tests are really pinning down, because it has three
consequences that are not obvious from the column:

* Only one of the two rows carries the key, so the *original's* list of
  translations has to be assembled from the rows pointing at it. Both ends have
  to answer, or the switcher works on one page and not the other.
* Drafts are posts. A translation nobody has published must not appear on the
  live original, and must appear for an admin previewing it.
* A set of versions is a star and never a chain, which the service enforces by
  re-pointing a link that names a translation at that translation's original.

Runs against whatever ``DATABASE_URL`` points at and inserts rows; ``track_post``
in conftest.py removes them, through the ORM so the cascades run.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _create(admin_token, track_post, **payload):
    """POST a post as the admin and register it for cleanup."""
    body = {"title": "Written By The Suite", "body": "# Hello", **payload}
    response = client.post("/api/v1/posts/", json=body, headers=_auth(admin_token))
    assert response.status_code == 200, response.text
    created = response.json()
    track_post(created["id"])
    return created


# --- language --------------------------------------------------------------

def test_a_post_defaults_to_vietnamese(admin_token, track_post):
    """The column is NOT NULL, so there is always an answer; this pins which.

    Every post on the site when the column was added was Vietnamese, and the
    migration backfills to the same value the API defaults to. A drift between
    those two would show as posts written before the change reading in one
    language and posts written after it in another.
    """
    created = _create(admin_token, track_post)

    assert created["language"] == "vi"


def test_an_unknown_language_is_refused_and_the_message_names_the_choices(
    admin_token,
):
    """422 rather than a post filed under a language nothing can render.

    The console shows the message verbatim under the field, and "invalid input"
    on a two-letter code says nothing about which two letters were wanted.
    """
    response = client.post(
        "/api/v1/posts/",
        json={"title": "In Klingon", "body": "x", "language": "tlh"},
        headers=_auth(admin_token),
    )

    assert response.status_code == 422
    assert "vi, en" in response.text


def test_the_author_name_is_null_unless_it_is_given(admin_token, track_post):
    """Null means the site owner, which the web app fills in — not the API.

    Copying the owner's name onto every row instead is how a rename leaves half
    the blog signed with the old spelling.
    """
    default = _create(admin_token, track_post)
    named = _create(admin_token, track_post, author_name="A Guest")

    assert default["author_name"] is None
    assert named["author_name"] == "A Guest"


# --- translations ----------------------------------------------------------

def test_a_translation_and_its_original_each_list_the_other(admin_token, track_post):
    """The link is navigable from both ends, which is the whole point.

    A reader arriving at either version needs the switcher, and only one of the
    two rows carries the foreign key.
    """
    original = _create(
        admin_token, track_post, title="Bai Goc", language="vi", published=True
    )
    translation = _create(
        admin_token,
        track_post,
        title="The Original",
        language="en",
        published=True,
        translation_of_slug=original["slug"],
    )

    from_translation = client.get(f"/api/v1/posts/{translation['id']}").json()
    from_original = client.get(f"/api/v1/posts/{original['id']}").json()

    assert [t["slug"] for t in from_translation["translations"]] == [original["slug"]]
    assert from_translation["translation_of"]["slug"] == original["slug"]

    assert [t["slug"] for t in from_original["translations"]] == [translation["slug"]]
    assert from_original["translation_of"] is None


def test_a_draft_translation_is_hidden_from_the_public_original(
    admin_token, track_post
):
    """A draft translation must not be one click from a published post.

    It is a page nobody has published. An admin previewing the original does
    want to see it, so the same request differs by who is asking.
    """
    original = _create(
        admin_token, track_post, title="Published Original", published=True
    )
    _create(
        admin_token,
        track_post,
        title="Unfinished Translation",
        language="en",
        published=False,
        translation_of_slug=original["slug"],
    )

    anonymous = client.get(f"/api/v1/posts/{original['id']}").json()
    admin = client.get(
        f"/api/v1/posts/{original['id']}", headers=_auth(admin_token)
    ).json()

    assert anonymous["translations"] == []
    assert [t["language"] for t in admin["translations"]] == ["en"]


def test_a_draft_original_is_hidden_from_its_published_translation(
    admin_token, track_post
):
    """The same rule in the other direction, which is a separate code path.

    ``translation_of`` is read straight off the row rather than assembled, so
    it needs its own visibility check — without one, publishing a translation
    of a draft would leak the draft's title and slug.
    """
    original = _create(
        admin_token, track_post, title="Still A Draft", published=False
    )
    translation = _create(
        admin_token,
        track_post,
        title="Published Ahead Of Its Original",
        language="en",
        published=True,
        translation_of_slug=original["slug"],
    )

    anonymous = client.get(f"/api/v1/posts/{translation['id']}").json()
    admin = client.get(
        f"/api/v1/posts/{translation['id']}", headers=_auth(admin_token)
    ).json()

    assert anonymous["translation_of"] is None
    assert anonymous["translations"] == []
    assert admin["translation_of"]["slug"] == original["slug"]


def test_translating_a_translation_files_it_under_the_original(
    admin_token, track_post
):
    """The set of versions is a star, never a chain.

    Pointing C at B, where B is already a translation of A, links C to A. Left
    as given, "the other versions of this post" would be a graph walk, and the
    switcher on B would not list C at all.
    """
    original = _create(admin_token, track_post, title="The Root", published=True)
    english = _create(
        admin_token,
        track_post,
        title="The Root In English",
        language="en",
        published=True,
        translation_of_slug=original["slug"],
    )
    third = _create(
        admin_token,
        track_post,
        title="The Root Again",
        published=True,
        translation_of_slug=english["slug"],
    )

    assert third["translation_of"]["slug"] == original["slug"]

    from_english = client.get(f"/api/v1/posts/{english['id']}").json()
    assert sorted(t["slug"] for t in from_english["translations"]) == sorted(
        [original["slug"], third["slug"]]
    )


def test_a_post_cannot_be_a_translation_of_itself(admin_token, track_post):
    """The one cycle the normalisation above cannot absorb."""
    post = _create(admin_token, track_post, title="Alone")

    response = client.put(
        f"/api/v1/posts/{post['id']}",
        json={"translation_of_slug": post["slug"]},
        headers=_auth(admin_token),
    )

    assert response.status_code == 422
    assert "itself" in response.text


def test_translating_a_post_that_does_not_exist_names_the_slug(admin_token):
    """Same treatment as a bad tag or series slug: loud, and specific."""
    response = client.post(
        "/api/v1/posts/",
        json={
            "title": "Orphan",
            "body": "x",
            "translation_of_slug": "no-such-post-anywhere",
        },
        headers=_auth(admin_token),
    )

    assert response.status_code == 422
    assert "no-such-post-anywhere" in response.text


def test_an_update_saying_nothing_about_the_link_leaves_it_alone(
    admin_token, track_post
):
    """Unset and null mean different things, as they do for ``series_slug``."""
    original = _create(admin_token, track_post, title="Was The Original")
    translation = _create(
        admin_token,
        track_post,
        title="Was A Translation",
        language="en",
        translation_of_slug=original["slug"],
    )

    kept = client.put(
        f"/api/v1/posts/{translation['id']}",
        json={"title": "Renamed But Still Linked"},
        headers=_auth(admin_token),
    ).json()

    assert kept["translation_of"]["slug"] == original["slug"]


def test_an_explicit_null_makes_a_translation_an_original_again(
    admin_token, track_post
):
    original = _create(admin_token, track_post, title="No Longer Referenced")
    translation = _create(
        admin_token,
        track_post,
        title="Breaking Away",
        language="en",
        translation_of_slug=original["slug"],
    )

    broken = client.put(
        f"/api/v1/posts/{translation['id']}",
        json={"translation_of_slug": None},
        headers=_auth(admin_token),
    ).json()

    assert broken["translation_of"] is None
    assert broken["translations"] == []


def test_deleting_an_original_leaves_its_translations_standing(
    admin_token, track_post
):
    """SET NULL, not CASCADE.

    They are the same writing in another language, not parts of the original —
    cascading here deletes a published English post because someone tidied up a
    Vietnamese draft.
    """
    original = _create(admin_token, track_post, title="Doomed Original")
    translation = _create(
        admin_token,
        track_post,
        title="Surviving Translation",
        language="en",
        published=True,
        translation_of_slug=original["slug"],
    )

    deleted = client.delete(
        f"/api/v1/posts/{original['id']}", headers=_auth(admin_token)
    )
    assert deleted.status_code == 200

    survivor = client.get(f"/api/v1/posts/{translation['id']}")
    assert survivor.status_code == 200
    assert survivor.json()["translation_of"] is None
