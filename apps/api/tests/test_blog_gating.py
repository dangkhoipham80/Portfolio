"""The login gate: how much of a long post an anonymous caller is given.

The claim worth defending is narrow and is the reason this file exists: the part
of a gated post that a reader has not signed in for is **absent from the
response**, not present and marked. A gate implemented in the browser is a
gradient over content that was sent anyway, and "read the rest" is View Source.

So most of what follows is the same assertion pointed at every route that can
return a post body — the detail route, the slug route, and the *list*, which is
the one that would quietly undo the others: the blog index fetches every post to
build its facets, so a list that sent whole bodies would put the whole archive
one request away.

The rest of the file is about not over-reaching. A short post is not gated, a
signed-in reader gets everything, an admin gets everything, and the cut never
lands inside a fenced code block — a post that ends mid-fence renders its last
paragraphs as grey monospace, which is a worse failure than not gating at all.

Runs against whatever ``DATABASE_URL`` points at and inserts rows; see
tests/conftest.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.previews import GATE_MINIMUM_MULTIPLIER, preview_of, word_count
from app.core.slugs import unique_slug
from app.main import app
from app.models.portfolio import Post

client = TestClient(app)

CUTOFF = settings.PUBLIC_PREVIEW_CHARS

# A paragraph that is definitely past the cutoff by the time it is repeated, and
# is recognisable in a response so a test can say "this must not be here".
SECRET = "The part behind the gate."


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _long_body() -> str:
    """A body comfortably past the "worth gating" floor, with a marked tail."""
    opening = "The publicly readable opening.\n\n" * (CUTOFF // 16)
    return f"{opening}{SECRET}\n"


@pytest.fixture
def make_post(db, track_post):
    def _make(title, *, body, published=True):
        record = Post(
            slug=unique_slug(db, Post, title),
            title=title,
            body=body,
            published=published,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        track_post(record.id)
        return record

    return _make


@pytest.fixture
def long_post(make_post):
    return make_post("A Long Post Behind The Gate", body=_long_body())


# --- the cut itself, as a function -----------------------------------------

def test_a_short_post_is_not_gated():
    """Nobody makes an account to read the last 20 characters of a stub."""
    body = "Barely anything.\n\nTwo short paragraphs.\n"

    text, gated = preview_of(body, CUTOFF)

    assert text == body
    assert gated is False


def test_a_post_just_over_the_cutoff_is_still_not_gated():
    """The floor is a multiple of the cutoff, not the cutoff. See previews.py."""
    body = ("A paragraph.\n\n" * CUTOFF)[: CUTOFF + 50]

    assert preview_of(body, CUTOFF)[1] is False


def test_the_cut_never_lands_inside_a_fenced_code_block():
    """An unclosed fence turns the rest of the preview into grey monospace."""
    filler = "Ordinary prose.\n\n" * (CUTOFF // 17)
    body = f"Opening.\n\n```python\n{filler}\n```\n\n{SECRET}\n" * 2

    text, gated = preview_of(body, CUTOFF)

    assert gated is True
    # Every fence that was opened was also closed.
    assert text.count("```") % 2 == 0


def test_a_zero_cutoff_switches_gating_off_entirely():
    """The escape hatch: PUBLIC_PREVIEW_CHARS=0 makes every post whole again."""
    assert preview_of(_long_body(), 0) == (_long_body(), False)


def test_the_word_count_ignores_fenced_code():
    """A post that is half shell transcript is not a twenty-minute read."""
    prose = "one two three four five\n"
    fenced = f"{prose}\n```bash\n{'echo hello world ' * 200}\n```\n"

    assert word_count(fenced) == word_count(prose)


def test_the_word_count_keeps_the_prose_after_a_code_block():
    """The regression that made a 900-word post report 40.

    The first version of the fence pattern closed with `.*$` under DOTALL, where
    `.` matches a newline — so it ran from the first fence to the end of the
    document and ate every word after it. The reading estimate was simply wrong
    on any post with code in it, and nothing failed.
    """
    before = "one two three\n"
    after = " ".join(f"word{i}" for i in range(100))
    body = f"{before}\n```python\nx = 1\n```\n\n{after}\n"

    assert word_count(body) == word_count(before) + 100


# --- the cut, through the API ----------------------------------------------

def test_an_anonymous_reader_gets_the_opening_and_not_the_rest(long_post):
    """The one that matters. The tail is absent, not hidden."""
    body = client.get(f"/api/v1/posts/{long_post.id}").json()

    assert body["gated"] is True
    assert SECRET not in body["body"]
    assert len(body["body"]) < len(long_post.body)
    assert body["body"].startswith("The publicly readable opening.")


def test_the_slug_route_gates_the_same_way(long_post):
    """Two ways in to the same post must not disagree about what is public."""
    body = client.get(f"/api/v1/posts/slug/{long_post.slug}").json()

    assert body["gated"] is True
    assert SECRET not in body["body"]


def test_the_list_route_gates_too(long_post):
    """Otherwise the index hands over the whole archive in one request."""
    listed = client.get("/api/v1/posts/").json()

    mine = [post for post in listed if post["id"] == long_post.id]
    assert mine, "the post should be listed"
    assert mine[0]["gated"] is True
    assert SECRET not in mine[0]["body"]


def test_a_signed_in_reader_gets_the_whole_post(long_post, reader_token):
    """An ordinary account, not an admin: this is the gate's purpose."""
    body = client.get(
        f"/api/v1/posts/{long_post.id}", headers=_auth(reader_token)
    ).json()

    assert body["gated"] is False
    assert SECRET in body["body"]
    assert body["body"] == long_post.body


def test_an_admin_gets_the_whole_post(long_post, admin_token):
    assert (
        SECRET
        in client.get(
            f"/api/v1/posts/{long_post.id}", headers=_auth(admin_token)
        ).json()["body"]
    )


def test_an_expired_or_forged_token_reads_as_anonymous_rather_than_401(long_post):
    """A public route stays public. A bad token costs the tail, not the page."""
    response = client.get(
        f"/api/v1/posts/{long_post.id}", headers=_auth("not-a-real-token")
    )

    assert response.status_code == 200
    assert response.json()["gated"] is True


def test_a_short_post_is_whole_for_everyone(make_post):
    """Existing behaviour: nothing changes for the posts that were fine."""
    post = make_post("Short And Public", body="A stub.\n\nTwo paragraphs.\n")

    body = client.get(f"/api/v1/posts/{post.id}").json()

    assert body["gated"] is False
    assert body["body"] == post.body


def test_the_reading_estimate_does_not_change_when_a_reader_signs_in(
    long_post, reader_token
):
    """The word count is the whole post's in both cases. See previews.word_count."""
    anonymous = client.get(f"/api/v1/posts/{long_post.id}").json()
    signed_in = client.get(
        f"/api/v1/posts/{long_post.id}", headers=_auth(reader_token)
    ).json()

    assert anonymous["word_count"] == signed_in["word_count"]
    assert anonymous["word_count"] == word_count(long_post.body)


def test_a_draft_is_still_a_404_for_a_signed_in_reader(make_post, reader_token):
    """Signing in buys whole bodies, not drafts. Those stay admin-only."""
    draft = make_post("Not Published Yet", body=_long_body(), published=False)

    assert (
        client.get(
            f"/api/v1/posts/{draft.id}", headers=_auth(reader_token)
        ).status_code
        == 404
    )


def test_the_gate_floor_is_a_multiple_of_the_cutoff():
    """Stated as a test so the constant cannot be quietly set to 1."""
    assert GATE_MINIMUM_MULTIPLIER >= 2
