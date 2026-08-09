"""Token issue/revoke behaviour, exercised against the database.

test_security.py drives HTTP and can only assert "rejected". These cases go
through the service layer with a real session, because the interesting part of
revocation is what happens to a token that *is* correctly signed — a request
test cannot tell "rejected because revoked" apart from "rejected because the
signature was bad".

Needs whatever ``DATABASE_URL`` points at; each test cleans up the row it made.
"""

import pytest

from app.core.database import SessionLocal
from app.core.exceptions import UnauthorizedError
from app.core.security import verify_token
from app.models.token import Token, TokenType
from app.models.user import User, UserStatus
from app.services.auth_service import AuthService
from app.services.user_service import UserService


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


TEST_EMAIL = "token-lifecycle@example.invalid"


def _drop_test_user(db):
    """Remove the row if it is there. Tokens cascade with it.

    Called before as well as after: the email is unique, so a run that dies
    mid-test (a dropped connection is enough) would otherwise poison every
    later run with a UniqueViolation in the fixture.
    """
    existing = db.query(User).filter(User.email == TEST_EMAIL).first()
    if existing:
        db.delete(existing)
        db.commit()


@pytest.fixture
def user(db):
    """A throwaway active user. Tokens cascade-delete with the row."""
    _drop_test_user(db)

    record = User(
        email=TEST_EMAIL,
        username="token-lifecycle",
        full_name="Token Lifecycle",
        hashed_password="x",
        is_active=True,
        is_verified=True,
        status=UserStatus.ACTIVE,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    yield record

    _drop_test_user(db)


def test_a_live_refresh_token_mints_a_new_pair(db, user):
    """Baseline, so the revocation test below cannot pass vacuously."""
    refresh = UserService(db).create_token(user.id, TokenType.REFRESH, expires_in_minutes=60)

    pair = AuthService(db).refresh_token(refresh)

    assert pair.access_token
    assert pair.user_id == user.id


def test_a_revoked_refresh_token_cannot_mint_new_tokens(db, user):
    """This is the other half of the logout hole.

    Revoking on logout only means something if refresh consults the row.
    Verifying the signature alone let a stolen refresh token keep minting fresh
    access tokens for its full 30-day life after the user had logged out.
    """
    service = UserService(db)
    refresh = service.create_token(user.id, TokenType.REFRESH, expires_in_minutes=60)

    AuthService(db).logout(access_token="unused", refresh_token=refresh)

    with pytest.raises(UnauthorizedError):
        AuthService(db).refresh_token(refresh)


def test_refresh_rotates_the_token_it_consumed(db, user):
    """The consumed token must not be replayable after rotation."""
    refresh = UserService(db).create_token(user.id, TokenType.REFRESH, expires_in_minutes=60)

    AuthService(db).refresh_token(refresh)

    with pytest.raises(UnauthorizedError):
        AuthService(db).refresh_token(refresh)


def test_password_reset_kills_outstanding_sessions(db, user):
    """revoke_all_user_tokens() is what makes "reset the password" a remedy."""
    service = UserService(db)
    refresh = service.create_token(user.id, TokenType.REFRESH, expires_in_minutes=60)

    service.revoke_all_user_tokens(user.id)

    with pytest.raises(UnauthorizedError):
        AuthService(db).refresh_token(refresh)


def test_every_token_carries_a_unique_id(db, user):
    """`jti` is load-bearing, not decoration.

    The rest of the payload — sub, type, exp, iat — is identical for two tokens
    minted for the same user in the same second, and exp/iat only have
    second resolution. Without `jti` the two JWTs came out byte-identical and
    stored the same hash on two rows; revoke_token() updates .first() of those,
    so logout flipped one row while get_valid_token() went on matching the
    other and the "revoked" token kept working.

    Asserted on the claim rather than by minting two tokens and comparing them:
    whether two calls land in the same second depends on how slow the commit
    between them happens to be, so that version of this test passes against the
    bug about as often as it catches it.
    """
    service = UserService(db)
    tokens = [
        service.create_token(user.id, TokenType.ACCESS, expires_in_minutes=60)
        for _ in range(5)
    ]

    ids = [verify_token(t, expected_type="access")["jti"] for t in tokens]

    assert len(set(ids)) == len(ids)
    assert len(set(tokens)) == len(tokens)


def test_revoking_one_token_leaves_the_others_alone(db, user):
    """A user with two live sessions logs out of one; the other survives."""
    service = UserService(db)
    first = service.create_token(user.id, TokenType.ACCESS, expires_in_minutes=60)
    second = service.create_token(user.id, TokenType.ACCESS, expires_in_minutes=60)

    service.revoke_token(first)

    assert service.get_valid_token(first, TokenType.ACCESS) is None
    assert service.get_valid_token(second, TokenType.ACCESS) is not None


def test_the_raw_token_is_never_written_to_the_database(db, user):
    """The column is called token_hash; it used to hold the JWT itself, so read
    access to the table handed over every live token ready to use."""
    token = UserService(db).create_token(user.id, TokenType.ACCESS, expires_in_minutes=60)

    stored = db.query(Token).filter(Token.user_id == user.id).all()

    assert stored
    assert all(row.token_hash != token for row in stored)
    assert all(len(row.token_hash) == 64 for row in stored)
