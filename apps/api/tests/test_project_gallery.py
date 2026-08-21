"""Project galleries and extra links.

The gallery column stores bare URLs and the response carries alt text and
dimensions, resolved from ``media_assets``. That asymmetry is the whole design
and it is the thing worth testing: it is what keeps a description in one place
instead of copied into every project that uses the image, and it is invisible
from either side on its own.

Runs against whatever ``DATABASE_URL`` points at and inserts rows; each test
cleans up what it made.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.slugs import unique_slug
from app.main import app
from app.models.portfolio import MediaAsset, Project, ProjectStatus

client = TestClient(app)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def make_project(db):
    made = []

    def _make(title, **columns):
        record = Project(
            slug=unique_slug(db, Project, title),
            title=title,
            description="Seeded by the test suite.",
            status=ProjectStatus.COMPLETED,
            published=True,
            **columns,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        made.append(record.id)
        return record

    yield _make

    for project_id in made:
        db.query(Project).filter(Project.id == project_id).delete()
    db.commit()


@pytest.fixture
def make_asset(db):
    made = []

    def _make(url, **columns):
        record = MediaAsset(url=url, **columns)
        db.add(record)
        db.commit()
        db.refresh(record)
        made.append(record.id)
        return record

    yield _make

    for asset_id in made:
        db.query(MediaAsset).filter(MediaAsset.id == asset_id).delete()
    db.commit()


# --- the stored form and the returned form differ ----------------------------

def test_a_gallery_is_stored_as_urls_and_returned_as_objects(make_project, db):
    project = make_project(
        "Stored As Strings", gallery=["https://example.invalid/one.png"]
    )

    # The column really is a list of strings...
    db.refresh(project)
    assert project.gallery == ["https://example.invalid/one.png"]

    # ...and the response really is a list of objects.
    body = client.get(f"/api/v1/projects/{project.id}").json()
    assert body["gallery"] == [
        {"url": "https://example.invalid/one.png", "alt": None, "width": None, "height": None}
    ]


def test_alt_text_comes_from_the_library_not_the_project(make_project, make_asset):
    """One description, inherited — the reason gallery does not store captions."""
    url = "https://example.invalid/described.png"
    make_asset(url, alt="A terminal running the test suite", width=1200, height=800)
    project = make_project("Inherits Its Alt Text", gallery=[url])

    image = client.get(f"/api/v1/projects/{project.id}").json()["gallery"][0]

    assert image["alt"] == "A terminal running the test suite"
    assert image["width"] == 1200
    assert image["height"] == 800


def test_editing_the_library_changes_every_project_using_the_image(
    make_project, make_asset, admin_token, db
):
    """The payoff. Nothing about the projects is touched."""
    url = "https://example.invalid/shared.png"
    asset = make_asset(url, alt="First description")
    one = make_project("Uses Shared Image One", gallery=[url])
    two = make_project("Uses Shared Image Two", gallery=[url])

    client.patch(
        f"/api/v1/media/{asset.id}",
        json={"alt": "Corrected description"},
        headers=_auth(admin_token),
    )

    for project in (one, two):
        image = client.get(f"/api/v1/projects/{project.id}").json()["gallery"][0]
        assert image["alt"] == "Corrected description"


def test_an_unknown_url_still_renders_with_no_description(make_project):
    """Pasted by hand, or uploaded before the library existed. Not an error."""
    project = make_project(
        "Points At A Stranger", gallery=["https://example.invalid/never-registered.png"]
    )

    image = client.get(f"/api/v1/projects/{project.id}").json()["gallery"][0]

    assert image["url"] == "https://example.invalid/never-registered.png"
    assert image["alt"] is None


def test_a_null_gallery_reads_as_empty(make_project):
    """Every row written before this migration has NULL, and must not 500."""
    project = make_project("Written Before Galleries Existed")

    body = client.get(f"/api/v1/projects/{project.id}")

    assert body.status_code == 200
    assert body.json()["gallery"] == []
    assert body.json()["links"] == []


def test_the_list_endpoint_resolves_galleries_too(make_project, make_asset):
    url = "https://example.invalid/in-the-list.png"
    make_asset(url, alt="Seen from the index")
    project = make_project("Listed With A Gallery", gallery=[url])

    listed = client.get("/api/v1/projects/").json()
    row = next(p for p in listed if p["id"] == project.id)

    assert row["gallery"][0]["alt"] == "Seen from the index"


# --- writing ----------------------------------------------------------------

def test_a_gallery_round_trips_through_an_update(make_project, admin_token, db):
    project = make_project("Gallery Gets Replaced", gallery=["https://example.invalid/old.png"])

    response = client.put(
        f"/api/v1/projects/{project.id}",
        json={"gallery": ["https://example.invalid/new-a.png", "https://example.invalid/new-b.png"]},
        headers=_auth(admin_token),
    )

    assert response.status_code == 200
    assert [i["url"] for i in response.json()["gallery"]] == [
        "https://example.invalid/new-a.png",
        "https://example.invalid/new-b.png",
    ]
    db.refresh(project)
    # Order is display order, and it is preserved exactly as sent.
    assert project.gallery == [
        "https://example.invalid/new-a.png",
        "https://example.invalid/new-b.png",
    ]


def test_links_round_trip_with_their_labels(make_project, admin_token):
    project = make_project("Has Extra Links")

    response = client.put(
        f"/api/v1/projects/{project.id}",
        json={"links": [{"label": "Demo video", "url": "https://example.invalid/demo"}]},
        headers=_auth(admin_token),
    )

    assert response.json()["links"] == [
        {"label": "Demo video", "url": "https://example.invalid/demo"}
    ]


def test_a_link_without_a_label_is_rejected(make_project, admin_token):
    """It would render as a button with nothing written on it."""
    project = make_project("Rejects A Bare Link")

    response = client.put(
        f"/api/v1/projects/{project.id}",
        json={"links": [{"label": "", "url": "https://example.invalid/x"}]},
        headers=_auth(admin_token),
    )

    assert response.status_code == 422


def test_creating_a_project_accepts_a_gallery(admin_token, db):
    response = client.post(
        "/api/v1/projects/",
        json={
            "title": "Created With A Gallery",
            "description": "Seeded by the test suite.",
            "gallery": ["https://example.invalid/created.png"],
            "links": [{"label": "Docs", "url": "https://example.invalid/docs"}],
        },
        headers=_auth(admin_token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["gallery"] == [
        {"url": "https://example.invalid/created.png", "alt": None, "width": None, "height": None}
    ]

    db.query(Project).filter(Project.id == body["id"]).delete()
    db.commit()


def test_the_gallery_is_resolved_with_one_query_per_request(
    make_project, make_asset, db
):
    """A page of projects must not cost one query per image.

    Counted rather than asserted about in prose: the naive version of this
    resolver looked identical from the outside and issued a SELECT per URL.
    """
    urls = [f"https://example.invalid/counted-{i}.png" for i in range(6)]
    for url in urls:
        make_asset(url, alt="Counted")
    make_project("Counted One", gallery=urls[:3])
    make_project("Counted Two", gallery=urls[3:])

    statements = []
    from sqlalchemy import event

    from app.core.database import engine

    def record(conn, cursor, statement, parameters, context, executemany):
        if "media_assets" in statement:
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        client.get("/api/v1/projects/")
    finally:
        event.remove(engine, "before_cursor_execute", record)

    assert len(statements) == 1, f"expected one media lookup, got {len(statements)}"
