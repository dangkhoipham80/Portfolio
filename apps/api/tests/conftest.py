"""Shared fixtures for the service-level tests.

These run against whatever ``DATABASE_URL`` points at and insert rows, so point
it at a scratch database.
"""

import pytest

from app.core.database import SessionLocal
from app.models.user import User, UserStatus


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
