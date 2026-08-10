"""End-to-end auth service flows: password reset, email verification, resend.

These cover the paths that went in without tests, because reaching them needs a
seeded user and a token in the database rather than just an HTTP request. Two of
them were outright crashes on code paths an unauthenticated caller can reach, so
"asserted by reading" was not good enough.

Runs against whatever ``DATABASE_URL`` points at; fixtures live in conftest.py.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.exceptions import ValidationError
from app.core.security import get_password_hash, verify_password
from app.models.token import Token, TokenType
from app.models.user import UserStatus
from app.schemas.user import PasswordResetConfirm
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from scripts.init_auth_tables import admin_credentials_from_env

OLD_PASSWORD = "old-password-that-is-long"
NEW_PASSWORD = "new-password-that-is-long"


def _undecodable_token_row(db, user_id, token_type):
    """Register a token row whose value is not a JWT at all.

    Contrived on purpose. It is the only way to reach the decode step with a
    token the database still considers live, which is exactly the combination
    the null-guard exists for.
    """
    value = f"not-a-jwt-{token_type.value}"
    db.add(
        Token(
            user_id=user_id,
            token_type=token_type,
            token_hash=UserService.hash_token(value),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    db.commit()
    return value


# --- password reset ----------------------------------------------------------


def test_password_reset_sets_the_new_password(db, make_user):
    """The whole point of the flow, and it never worked.

    reset_password() called self.user_service.get_password_hash(), which is not
    a method on UserService — every caller who got as far as a valid token got
    an AttributeError instead of a new password.
    """
    user = make_user(
        "reset-flow@example.invalid",
        hashed_password=get_password_hash(OLD_PASSWORD),
    )
    token = UserService(db).create_token(
        user.id, TokenType.RESET_PASSWORD, expires_in_minutes=60
    )

    AuthService(db).reset_password(
        PasswordResetConfirm(token=token, new_password=NEW_PASSWORD)
    )

    db.refresh(user)
    assert verify_password(NEW_PASSWORD, user.hashed_password)
    assert not verify_password(OLD_PASSWORD, user.hashed_password)


def test_password_reset_revokes_sessions_opened_before_it(db, make_user):
    """Resetting the password is the remedy for a stolen token, so it has to
    invalidate what the thief already holds."""
    user = make_user(
        "reset-revokes@example.invalid",
        hashed_password=get_password_hash(OLD_PASSWORD),
    )
    service = UserService(db)
    access = service.create_token(user.id, TokenType.ACCESS, expires_in_minutes=60)
    reset = service.create_token(user.id, TokenType.RESET_PASSWORD, expires_in_minutes=60)

    AuthService(db).reset_password(
        PasswordResetConfirm(token=reset, new_password=NEW_PASSWORD)
    )

    assert service.get_valid_token(access, TokenType.ACCESS) is None


def test_password_reset_with_an_undecodable_token_is_rejected_not_a_crash(db, make_user):
    """`int(verify_token(t).get("sub"))` raised AttributeError when the decode
    returned None, turning a bad token into a 500."""
    user = make_user("reset-garbage@example.invalid")
    value = _undecodable_token_row(db, user.id, TokenType.RESET_PASSWORD)

    with pytest.raises(ValidationError):
        AuthService(db).reset_password(
            PasswordResetConfirm(token=value, new_password=NEW_PASSWORD)
        )


def test_password_reset_rejects_a_token_of_the_wrong_type(db, make_user):
    """An access token must not be usable to change a password."""
    user = make_user("reset-wrong-type@example.invalid")
    access = UserService(db).create_token(
        user.id, TokenType.ACCESS, expires_in_minutes=60
    )

    with pytest.raises(ValidationError):
        AuthService(db).reset_password(
            PasswordResetConfirm(token=access, new_password=NEW_PASSWORD)
        )


# --- email verification ------------------------------------------------------


def test_verify_email_marks_the_account_verified(db, make_user):
    user = make_user(
        "verify-flow@example.invalid",
        is_verified=False,
        status=UserStatus.PENDING_VERIFICATION,
    )
    token = UserService(db).create_token(
        user.id, TokenType.EMAIL_VERIFICATION, expires_in_minutes=60
    )

    AuthService(db).verify_email(token)

    db.refresh(user)
    assert user.is_verified
    assert user.status == UserStatus.ACTIVE


def test_verify_email_consumes_its_token(db, make_user):
    """A verification link must not stay live after it is followed."""
    user = make_user(
        "verify-once@example.invalid",
        is_verified=False,
        status=UserStatus.PENDING_VERIFICATION,
    )
    service = UserService(db)
    token = service.create_token(
        user.id, TokenType.EMAIL_VERIFICATION, expires_in_minutes=60
    )

    AuthService(db).verify_email(token)

    assert service.get_valid_token(token, TokenType.EMAIL_VERIFICATION) is None


def test_verify_email_with_an_undecodable_token_is_rejected_not_a_crash(db, make_user):
    user = make_user("verify-garbage@example.invalid")
    value = _undecodable_token_row(db, user.id, TokenType.EMAIL_VERIFICATION)

    with pytest.raises(ValidationError):
        AuthService(db).verify_email(value)


# --- email enumeration -------------------------------------------------------


def test_resend_verification_says_nothing_about_unknown_addresses(db):
    """It used to raise "User not found", so an unauthenticated caller could
    walk a list of addresses and learn which ones were registered."""
    assert AuthService(db).resend_verification_email("nobody@example.invalid") is True


def test_resend_verification_says_nothing_about_verified_addresses(db, make_user):
    """"Email is already verified" leaked the same fact from the other side —
    it confirmed the address exists."""
    user = make_user("resend-verified@example.invalid", is_verified=True)

    assert AuthService(db).resend_verification_email(user.email) is True


def test_resend_verification_is_indistinguishable_either_way(db, make_user):
    """The two answers above have to match, or the difference is the leak."""
    known = make_user("resend-compare@example.invalid", is_verified=True)
    service = AuthService(db)

    assert service.resend_verification_email(known.email) == service.resend_verification_email(
        "absent@example.invalid"
    )


# --- seed script credentials -------------------------------------------------


@pytest.fixture
def no_env_file(tmp_path):
    """A path with no .env at it.

    admin_credentials_from_env falls back to apps/api/.env, so without this the
    cases below would read whatever the person running the suite happens to
    have in their own untracked file — and "refuses to run without credentials"
    would pass or fail depending on the machine.
    """
    return tmp_path / "absent.env"


def test_seed_refuses_to_run_without_credentials(monkeypatch, no_env_file):
    """The script used to create admin@example.com / admin123, both written in
    the file."""
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

    with pytest.raises(SystemExit):
        admin_credentials_from_env(env_file=no_env_file)


def test_seed_reads_credentials_from_the_env_file(monkeypatch, tmp_path):
    """.env is where the DATABASE_URL being written to already lives, so it is
    where the matching admin credentials get put.

    Reading only os.environ missed them silently — pydantic-settings loads .env
    into `settings`, never into the process environment.
    """
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "DATABASE_URL=postgresql://ignored/db",
                "ADMIN_EMAIL=from-file@example.invalid",
                "ADMIN_PASSWORD=twelvechars1",
            ]
        ),
        encoding="utf-8",
    )

    assert admin_credentials_from_env(env_file=env_file) == (
        "from-file@example.invalid",
        "twelvechars1",
    )


def test_the_shell_wins_over_the_env_file(monkeypatch, tmp_path):
    """A one-off export has to beat a stale line in the file, not the reverse."""
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "ADMIN_EMAIL=stale@example.invalid",
                "ADMIN_PASSWORD=stalepassword1",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("ADMIN_EMAIL", "shell@example.invalid")
    monkeypatch.setenv("ADMIN_PASSWORD", "shellpassword1")

    assert admin_credentials_from_env(env_file=env_file) == (
        "shell@example.invalid",
        "shellpassword1",
    )


@pytest.mark.parametrize("password", ["short", "admin123", "elevenchars"])
def test_seed_refuses_a_weak_password(monkeypatch, no_env_file, password):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.invalid")
    monkeypatch.setenv("ADMIN_PASSWORD", password)

    with pytest.raises(SystemExit):
        admin_credentials_from_env(env_file=no_env_file)


def test_seed_accepts_a_long_enough_password(monkeypatch, no_env_file):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.invalid")
    monkeypatch.setenv("ADMIN_PASSWORD", "twelvechars1")

    assert admin_credentials_from_env(env_file=no_env_file) == (
        "admin@example.invalid",
        "twelvechars1",
    )
