"""Shared fixtures for the service-level tests.

These run against whatever ``DATABASE_URL`` points at and insert rows, so point
it at a scratch database.
"""

import pytest

from app.core.database import SessionLocal
from app.core.rate_limit import limiter
from app.models.portfolio import Post
from app.models.role import Role, UserRole
from app.models.token import TokenType
from app.models.user import User, UserStatus
from app.services.user_service import UserService


@pytest.fixture
def track_post(db):
    """Remove post rows a test created, including ones made through the API.

    Here rather than in one test module, because two of them make posts and
    pytest resolves a fixture from conftest without an import. Importing it
    instead is what the blog-translations file did first, and it is a real
    mistake rather than a lint quibble: the name then exists twice in that
    module — once as a module-level import, once as every test's parameter —
    and ruff's F811 is the thing that says so. The second binding is what
    pytest actually uses; the import only ever served to make the first one
    resolve.
    """
    made = []

    def _track(post_id: int) -> int:
        made.append(post_id)
        return post_id

    yield _track

    for post_id in made:
        record = db.query(Post).filter(Post.id == post_id).first()
        # Through the ORM rather than a bulk delete, so the cascades on
        # comments, ratings and revisions actually run. A `.delete()` on the
        # query emits one DELETE and leaves the children behind, which then
        # fail the foreign key on the next run.
        if record:
            db.delete(record)
    db.commit()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Empty the rate-limit buckets before every test.

    slowapi's default storage is a dict living in the process, shared by every
    test in the run and never cleared between them. Without this, whether a test
    sees a 429 depends on which tests ran before it — the login cases spend ten
    attempts each, so the second one to run would fail on a limit it never
    tripped itself, and only when the whole file is run rather than the test
    alone.

    It also lets the contact-form case assert the actual boundary instead of
    "a 429 turned up somewhere".
    """
    limiter.reset()
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _drop_user(db, email):
    """Remove a test user if present. Tokens cascade with the row."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.delete(existing)
        db.commit()


@pytest.fixture
def make_user(db):
    """Build throwaway users, cleaned up afterwards.

    Each address is dropped before it is created as well as after. Email is
    unique, so a run that dies part-way — a dropped connection is enough, and
    this database has done it — would otherwise leave a row behind and poison
    every later run with a UniqueViolation in the fixture rather than a real
    failure in the test.
    """
    made = []

    def _make(
        email,
        *,
        hashed_password="x",
        is_verified=True,
        status=UserStatus.ACTIVE,
    ):
        _drop_user(db, email)
        record = User(
            email=email,
            username=email.split("@")[0],
            full_name="Test User",
            hashed_password=hashed_password,
            is_active=True,
            is_verified=is_verified,
            status=status,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        made.append(email)
        return record

    yield _make

    for email in made:
        _drop_user(db, email)


@pytest.fixture
def admin_token(db, make_user):
    """A bearer token for a real admin user.

    Goes through UserService.create_token rather than signing a JWT by hand,
    because get_current_user_dependency also checks the token has a live row —
    a hand-signed token is rejected before the admin check is ever reached.

    Lives here rather than beside one test file: both the content tests and the
    blog tests need an admin, and the second copy is where the two drift.
    """
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    if admin_role is None:
        pytest.skip("no admin role in this database; run scripts/init_auth_tables.py")

    user = make_user("content-admin@example.invalid")
    db.add(UserRole(user_id=user.id, role_id=admin_role.id))
    db.commit()

    return UserService(db).create_token(user.id, TokenType.ACCESS, expires_in_minutes=10)
