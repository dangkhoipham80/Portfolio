"""Content endpoints: publish state, slugs, and the reshaped fields.

The point of this file is the draft/published split. Everything under
``/projects``, ``/certificates`` and ``/career`` is world-readable, so the only
thing standing between an unfinished draft and the public internet is the
``published`` filter in PortfolioService — and a filter that is only ever
exercised by the code that sets it is not tested at all. Each case here asks
the question from outside: can an anonymous caller see this row?

Runs against whatever ``DATABASE_URL`` points at and inserts rows; each test
cleans up what it made.
"""

from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.slugs import slugify, unique_slug
from app.main import app
from app.models.portfolio import CareerEntry, Certificate, Project, ProjectStatus, Skill, SkillLevel
from app.models.role import Role, UserRole
from app.models.token import TokenType
from app.services.user_service import UserService

client = TestClient(app)


@pytest.fixture
def make_project(db):
    """Insert projects and remove them afterwards, published or not."""
    made = []

    def _make(title, *, published: bool, featured: bool = False):
        record = Project(
            slug=unique_slug(db, Project, title),
            title=title,
            description="Seeded by the test suite.",
            status=ProjectStatus.COMPLETED,
            published=published,
            featured=featured,
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
def admin_token(db, make_user):
    """A bearer token for a real admin user.

    Goes through UserService.create_token rather than signing a JWT by hand,
    because get_current_user_dependency also checks the token has a live row —
    a hand-signed token is rejected before the admin check is ever reached.
    """
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    if admin_role is None:
        pytest.skip("no admin role in this database; run scripts/init_auth_tables.py")

    user = make_user("content-admin@example.invalid")
    db.add(UserRole(user_id=user.id, role_id=admin_role.id))
    db.commit()

    return UserService(db).create_token(user.id, TokenType.ACCESS, expires_in_minutes=10)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# --- draft visibility ------------------------------------------------------

def test_a_draft_project_is_not_in_the_public_list(make_project):
    draft = make_project("Half Written Thing", published=False)

    slugs = [p["slug"] for p in client.get("/api/v1/projects/").json()]

    assert draft.slug not in slugs


def test_a_published_project_is_in_the_public_list(make_project):
    """Baseline: without this the test above could pass on an empty list."""
    live = make_project("Perfectly Finished Thing", published=True)

    slugs = [p["slug"] for p in client.get("/api/v1/projects/").json()]

    assert live.slug in slugs


def test_fetching_a_draft_by_id_is_a_404_not_a_403(make_project):
    """403 would confirm the row exists. Whether a draft exists is not public."""
    draft = make_project("Secret Draft", published=False)

    assert client.get(f"/api/v1/projects/{draft.id}").status_code == 404


def test_fetching_a_draft_by_slug_is_a_404(make_project):
    draft = make_project("Secret Draft By Slug", published=False)

    assert client.get(f"/api/v1/projects/slug/{draft.slug}").status_code == 404


def test_an_admin_sees_drafts(make_project, admin_token):
    draft = make_project("Visible To Admin", published=False)

    response = client.get("/api/v1/projects/", headers=_auth(admin_token))

    assert draft.slug in [p["slug"] for p in response.json()]


def test_an_expired_or_bogus_token_still_gets_the_public_list(make_project):
    """The content routes are public: a bad token means anonymous, not 401.

    get_optional_admin swallows the auth failure. If it ever stops doing so,
    one stale token in a visitor's browser breaks the whole portfolio page.
    """
    live = make_project("Readable Without Credentials", published=True)

    response = client.get("/api/v1/projects/", headers=_auth("not-a-real-token"))

    assert response.status_code == 200
    assert live.slug in [p["slug"] for p in response.json()]


def test_featured_filter_still_excludes_drafts(make_project):
    """Two filters compose here, and `featured` is the one that came first."""
    draft = make_project("Featured But Unpublished", published=False, featured=True)

    slugs = [p["slug"] for p in client.get("/api/v1/projects/?featured_only=true").json()]

    assert draft.slug not in slugs


# --- slugs -----------------------------------------------------------------

def test_a_project_is_reachable_by_slug(make_project):
    live = make_project("Reachable By Slug", published=True)

    body = client.get(f"/api/v1/projects/slug/{live.slug}").json()

    assert body["id"] == live.id
    assert body["slug"] == "reachable-by-slug"


def test_slug_route_does_not_shadow_the_id_route(make_project):
    """`/projects/slug/x` and `/projects/{id}` are both live; check both resolve."""
    live = make_project("Both Routes Work", published=True)

    assert client.get(f"/api/v1/projects/{live.id}").json()["slug"] == live.slug
    assert client.get(f"/api/v1/projects/slug/{live.slug}").json()["id"] == live.id


def test_slugify_folds_accents_rather_than_dropping_them():
    """"Đ" has no combining form, so NFKD alone silently deletes it."""
    assert slugify("Phạm Đăng Khôi") == "pham-dang-khoi"


def test_slugify_collapses_punctuation_and_trims_the_ends():
    assert slugify("  Hello, World!! ") == "hello-world"


def test_unique_slug_suffixes_a_collision(db, make_project):
    make_project("Duplicate Title", published=True)

    assert unique_slug(db, Project, "Duplicate Title") == "duplicate-title-2"


def test_two_projects_with_the_same_title_get_different_slugs(make_project):
    first = make_project("Same Name", published=True)
    second = make_project("Same Name", published=True)

    assert first.slug != second.slug


# --- reshaped fields -------------------------------------------------------

def test_a_project_with_no_lists_serialises_them_as_empty_not_null(make_project):
    """The JSON columns are nullable; rows predating this change hold NULL.

    Without the BeforeValidator that becomes a 500 during response
    serialisation, on a public GET.
    """
    live = make_project("No Lists At All", published=True)

    body = client.get(f"/api/v1/projects/{live.id}").json()

    assert body["technologies"] == []
    assert body["features"] == []
    assert body["challenges"] == []


def test_project_status_serialises_as_its_name(make_project):
    live = make_project("Status Shape", published=True)

    assert client.get(f"/api/v1/projects/{live.id}").json()["status"] == "completed"


def test_skill_level_is_a_name_not_a_number(db):
    """The old column was an unlabelled 1-5 int the frontend had to map itself."""
    skill = Skill(name="Test Skill For Levels", category="Testing", level=SkillLevel.ADVANCED)
    db.add(skill)
    db.commit()

    try:
        body = client.get("/api/v1/skills/").json()
        entry = next(s for s in body if s["name"] == "Test Skill For Levels")
        assert entry["level"] == "advanced"
    finally:
        db.query(Skill).filter(Skill.id == skill.id).delete()
        db.commit()


def test_creating_a_skill_rejects_the_old_integer_level(admin_token):
    """A client still sending `"level": 4` should be told, not silently accepted."""
    response = client.post(
        "/api/v1/skills/",
        json={"name": "Rejected Skill", "category": "Testing", "level": 4},
        headers=_auth(admin_token),
    )

    assert response.status_code == 422


# --- career ----------------------------------------------------------------

@pytest.fixture
def make_career_entry(db):
    made = []

    def _make(title, company, *, published: bool, ended_on=None):
        record = CareerEntry(
            slug=unique_slug(db, CareerEntry, f"{title} {company}"),
            title=title,
            company=company,
            started_on=date(2024, 1, 1),
            ended_on=ended_on,
            published=published,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        made.append(record.id)
        return record

    yield _make

    for entry_id in made:
        db.query(CareerEntry).filter(CareerEntry.id == entry_id).delete()
    db.commit()


def test_career_entries_are_publicly_readable(make_career_entry):
    entry = make_career_entry("Test Role", "Test Company", published=True)

    response = client.get("/api/v1/career/")

    assert response.status_code == 200
    assert entry.slug in [e["slug"] for e in response.json()]


def test_a_draft_career_entry_is_hidden(make_career_entry):
    entry = make_career_entry("Unannounced Role", "Stealth Co", published=False)

    slugs = [e["slug"] for e in client.get("/api/v1/career/").json()]

    assert entry.slug not in slugs


def test_an_ongoing_role_has_a_null_end_date(make_career_entry):
    """Null end date is how "Present" is represented; it must survive the API."""
    entry = make_career_entry("Current Role", "Current Co", published=True, ended_on=None)

    body = client.get(f"/api/v1/career/{entry.id}").json()

    assert body["ended_on"] is None


def test_writing_career_entries_needs_admin():
    payload = {"title": "x", "company": "y", "started_on": "2024-01-01"}

    assert client.post("/api/v1/career/", json=payload).status_code in (401, 403)


# --- certificates ----------------------------------------------------------

def test_a_draft_certificate_is_hidden(db):
    cert = Certificate(
        slug=unique_slug(db, Certificate, "Unlisted Certificate"),
        title="Unlisted Certificate",
        issuer="Nobody",
        issue_date=datetime(2024, 1, 1),
        published=False,
    )
    db.add(cert)
    db.commit()

    try:
        slugs = [c["slug"] for c in client.get("/api/v1/certificates/").json()]
        assert cert.slug not in slugs
    finally:
        db.query(Certificate).filter(Certificate.id == cert.id).delete()
        db.commit()
