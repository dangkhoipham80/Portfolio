"""The media library.

Two things are worth testing here and neither is CRUD for its own sake.

The first is that the whole router is admin-only *including the reads*. Every
other content router is public on GET and widens for an admin, so "GET is open"
is the house pattern and this is the one place it is deliberately not. A
regression would turn the asset index into a public catalogue of everything ever
uploaded, including images that were never used on any page.

The second is that registration is idempotent. The console calls it immediately
after the browser finishes uploading to Blob, with no transaction spanning the
two, so a retry is ordinary rather than exceptional — and a second row for one
object is exactly the bookkeeping drift this table exists to prevent.

Runs against whatever ``DATABASE_URL`` points at and inserts rows; each test
cleans up what it made.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.portfolio import MediaAsset

client = TestClient(app)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def make_asset(db):
    """Insert assets directly and remove them afterwards."""
    made = []

    def _make(url, *, alt=None, pathname=None):
        record = MediaAsset(url=url, alt=alt, pathname=pathname)
        db.add(record)
        db.commit()
        db.refresh(record)
        made.append(record.id)
        return record

    yield _make

    for asset_id in made:
        db.query(MediaAsset).filter(MediaAsset.id == asset_id).delete()
    db.commit()


@pytest.fixture
def cleanup_urls(db):
    """Drop rows created through the API, which the fixture above never saw."""
    urls = []
    yield urls

    for url in urls:
        db.query(MediaAsset).filter(MediaAsset.url == url).delete()
    db.commit()


# --- the router is admin-only, reads included -------------------------------

@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/media/"),
        ("post", "/api/v1/media/"),
        ("patch", "/api/v1/media/1"),
        ("delete", "/api/v1/media/1"),
    ],
)
def test_every_media_route_refuses_an_anonymous_caller(method, path):
    # `client.request`, not `client.get`/`client.delete`: httpx's shorthands for
    # bodyless verbs do not take a `json` kwarg, and the parametrised body has
    # to reach POST and PATCH.
    response = client.request(
        method.upper(), path, json={"url": "https://example.invalid/a.png"}
    )

    assert response.status_code in (401, 403)


def test_listing_does_not_leak_assets_to_the_public(make_asset):
    """The bytes are public; the catalogue is not."""
    asset = make_asset("https://example.invalid/secret-draft-mockup.png")

    response = client.get("/api/v1/media/")

    assert response.status_code in (401, 403)
    assert str(asset.id) not in response.text


# --- registration -----------------------------------------------------------

def test_registering_an_upload_records_it(admin_token, cleanup_urls):
    url = "https://example.invalid/registered-once.png"
    cleanup_urls.append(url)

    response = client.post(
        "/api/v1/media/",
        json={"url": url, "pathname": "registered-once.png", "mime": "image/png",
              "size_bytes": 1234, "width": 800, "height": 600},
        headers=_auth(admin_token),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["url"] == url
    assert body["width"] == 800
    assert body["alt"] is None


def test_registering_the_same_url_twice_returns_the_same_row(admin_token, cleanup_urls):
    """A retried registration must not produce a second row for one object."""
    url = "https://example.invalid/retried.png"
    cleanup_urls.append(url)
    payload = {"url": url, "pathname": "retried.png"}

    first = client.post("/api/v1/media/", json=payload, headers=_auth(admin_token))
    second = client.post("/api/v1/media/", json=payload, headers=_auth(admin_token))

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]


def test_a_retry_does_not_blank_out_what_the_first_attempt_measured(
    admin_token, cleanup_urls
):
    """The existing row wins, so a retry missing dimensions cannot erase them."""
    url = "https://example.invalid/measured.png"
    cleanup_urls.append(url)

    client.post(
        "/api/v1/media/",
        json={"url": url, "width": 1200, "height": 900},
        headers=_auth(admin_token),
    )
    retry = client.post("/api/v1/media/", json={"url": url}, headers=_auth(admin_token))

    assert retry.json()["width"] == 1200
    assert retry.json()["height"] == 900


# --- alt text ---------------------------------------------------------------

def test_alt_text_can_be_written_and_cleared(admin_token, make_asset):
    asset = make_asset("https://example.invalid/describe-me.png")

    written = client.patch(
        f"/api/v1/media/{asset.id}",
        json={"alt": "A dashboard showing four charts"},
        headers=_auth(admin_token),
    )
    cleared = client.patch(
        f"/api/v1/media/{asset.id}", json={"alt": None}, headers=_auth(admin_token)
    )

    assert written.json()["alt"] == "A dashboard showing four charts"
    # Explicit null means "remove the description", not "leave it alone" —
    # the service uses exclude_unset for exactly this.
    assert cleared.json()["alt"] is None


def test_patching_a_missing_asset_is_a_404(admin_token):
    response = client.patch(
        "/api/v1/media/98765432", json={"alt": "nothing"}, headers=_auth(admin_token)
    )

    assert response.status_code == 404


# --- listing ----------------------------------------------------------------

def test_the_library_lists_newest_first(admin_token, make_asset):
    older = make_asset("https://example.invalid/older.png")
    newer = make_asset("https://example.invalid/newer.png")

    listed = client.get("/api/v1/media/?limit=200", headers=_auth(admin_token)).json()
    ids = [row["id"] for row in listed]

    assert ids.index(newer.id) < ids.index(older.id)


def test_search_matches_filename_and_alt_but_not_the_random_suffix(
    admin_token, make_asset
):
    named = make_asset(
        "https://example.invalid/blob-x7f2q1.png", pathname="architecture-diagram.png"
    )
    described = make_asset(
        "https://example.invalid/blob-b3k9z2.png", alt="The architecture, drawn"
    )
    other = make_asset("https://example.invalid/blob-m1n4p8.png", pathname="cat.png")

    found = client.get(
        "/api/v1/media/?q=architecture", headers=_auth(admin_token)
    ).json()
    ids = {row["id"] for row in found}

    assert named.id in ids
    assert described.id in ids
    assert other.id not in ids


def test_the_page_size_is_capped(admin_token):
    """A caller cannot ask for the whole table in one request."""
    response = client.get("/api/v1/media/?limit=5000", headers=_auth(admin_token))

    assert response.status_code == 422


# --- delete -----------------------------------------------------------------

def test_deleting_forgets_the_asset(admin_token, make_asset, db):
    asset = make_asset("https://example.invalid/forget-me.png")

    response = client.delete(f"/api/v1/media/{asset.id}", headers=_auth(admin_token))

    assert response.status_code == 200
    assert db.query(MediaAsset).filter(MediaAsset.id == asset.id).first() is None
