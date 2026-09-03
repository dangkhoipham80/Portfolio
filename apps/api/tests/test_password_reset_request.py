"""What POST /auth/password-reset-request does, and what it refuses to say.

Split out from test_auth_flows.py, which covers the *confirm* half — the token
being spent, the password actually changing, the sessions it revokes. This file
is about the request half, where almost every requirement is a negative one: the
same answer for a registered address and an unregistered one, no mail to an
account that cannot use it, and no reset link left behind by an earlier attempt.

Nothing here opens a socket. ``send_password_reset`` is replaced in the module
under test, so the assertions are about what would have been sent rather than
about SMTP, and a run with real credentials in .env does not mail anybody.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.core.constants import PASSWORD_RESET_EXPIRE_MINUTES
from app.models.token import Token, TokenType
from app.schemas.user import PasswordResetRequest
from app.services import auth_service as auth_service_module
from app.services.auth_service import AuthService
from app.services.user_service import UserService


# example.com, not the example.invalid the rest of the suite uses. These
# addresses go through PasswordResetRequest, whose EmailStr calls
# email-validator, and email-validator refuses .invalid as a reserved name. The
# other files build User rows directly and never touch a schema, which is why
# they can use the reserved domain and this one cannot.
@pytest.fixture
def sent(monkeypatch):
    """Capture the reset mails instead of sending them.

    Patches the name inside auth_service rather than email_service.send_password_reset,
    because auth_service imported the function directly — patching the origin
    would leave the already-bound reference in place and the test would pass
    while the real transport ran.
    """
    calls = []

    def _capture(to_email, **kwargs):
        calls.append({"to": to_email, **kwargs})

    monkeypatch.setattr(auth_service_module, "send_password_reset", _capture)
    # The guard in _send_password_reset_email returns early when SMTP is
    # unconfigured, which is the state of every fresh clone and of CI — so
    # without this the whole file would assert on an empty list and pass.
    monkeypatch.setattr(settings.__class__, "emails_enabled", property(lambda self: True))
    return calls


def _reset_rows(db, user_id):
    return (
        db.query(Token)
        .filter(Token.user_id == user_id, Token.token_type == TokenType.RESET_PASSWORD)
        .all()
    )


def test_a_known_address_is_mailed_a_link(db, make_user, sent):
    user = make_user("reset-known@example.com")

    AuthService(db).request_password_reset(PasswordResetRequest(email=user.email))

    assert len(sent) == 1
    assert sent[0]["to"] == user.email
    assert sent[0]["expires_minutes"] == PASSWORD_RESET_EXPIRE_MINUTES


def test_the_link_points_at_the_web_app_not_the_api(db, make_user, sent, monkeypatch):
    """The link used to be built from BACKEND_CORS_ORIGINS[0].

    Which is right locally and wrong the moment that list has two entries — a
    preview origin added to the front of it would start collecting the live
    site's reset links. FRONTEND_URL is the setting that says it outright.
    """
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://example.test/")
    user = make_user("reset-link@example.com")

    AuthService(db).request_password_reset(PasswordResetRequest(email=user.email))

    url = sent[0]["reset_url"]
    # The trailing slash on the setting must not survive into the path.
    assert url.startswith("https://example.test/reset-password?token=")
    assert "//reset-password" not in url


def test_the_token_in_the_link_is_the_one_that_works(db, make_user, sent):
    """The URL is assembled by hand, so this is the join worth asserting: the
    value in the query string has to be the token the database will accept."""
    from urllib.parse import parse_qs, urlparse

    user = make_user("reset-roundtrip@example.com")

    AuthService(db).request_password_reset(PasswordResetRequest(email=user.email))

    token = parse_qs(urlparse(sent[0]["reset_url"]).query)["token"][0]
    assert UserService(db).get_valid_token(token, TokenType.RESET_PASSWORD) is not None


def test_an_unknown_address_is_answered_the_same_way(db, sent):
    """No mail, no exception, no different return value — the form must not be
    usable to find out which addresses are registered."""
    result = AuthService(db).request_password_reset(
        PasswordResetRequest(email="nobody@example.com")
    )

    assert result is None
    assert sent == []


def test_an_account_with_no_password_does_not_raise(db, make_user, sent):
    """This branch used to raise ValidationError, which came back as a 422
    where every other address got a 200. One differing response is all an
    enumerator needs, and this one confirmed the address exists."""
    user = make_user("reset-passwordless@example.com", hashed_password=None)

    assert AuthService(db).request_password_reset(PasswordResetRequest(email=user.email)) is None
    assert sent == []
    assert _reset_rows(db, user.id) == []


def test_a_deactivated_account_is_not_mailed_a_working_link(db, make_user, sent):
    """login() refuses a deactivated account, so a reset link for one is a live
    key to a door that does not open — and mailing it says the address exists."""
    user = make_user("reset-deactivated@example.com")
    user.is_active = False
    db.commit()

    assert AuthService(db).request_password_reset(PasswordResetRequest(email=user.email)) is None
    assert sent == []


def test_asking_twice_leaves_only_the_newest_link_working(db, make_user, sent):
    """Every request used to mint another token and revoke nothing, so each one
    left an extra live key behind for the full hour."""
    from urllib.parse import parse_qs, urlparse

    user = make_user("reset-twice@example.com")
    service = AuthService(db)

    service.request_password_reset(PasswordResetRequest(email=user.email))
    service.request_password_reset(PasswordResetRequest(email=user.email))

    tokens = [parse_qs(urlparse(call["reset_url"]).query)["token"][0] for call in sent]
    assert len(tokens) == 2

    lookup = UserService(db)
    assert lookup.get_valid_token(tokens[0], TokenType.RESET_PASSWORD) is None
    assert lookup.get_valid_token(tokens[1], TokenType.RESET_PASSWORD) is not None


def test_an_smtp_failure_is_not_reported_to_the_caller(db, make_user, monkeypatch):
    """A 500 here would be the enumeration signal the four branches above spend
    their time avoiding: only a registered address reaches the mail step."""
    monkeypatch.setattr(settings.__class__, "emails_enabled", property(lambda self: True))

    def _explode(*args, **kwargs):
        raise OSError("smtp is down")

    monkeypatch.setattr(auth_service_module, "send_password_reset", _explode)
    user = make_user("reset-smtp-down@example.com")

    assert AuthService(db).request_password_reset(PasswordResetRequest(email=user.email)) is None


def test_nothing_is_sent_when_smtp_is_not_configured(db, make_user, monkeypatch):
    """The state of CI and of a fresh clone. It must not open a socket."""
    calls = []
    monkeypatch.setattr(settings.__class__, "emails_enabled", property(lambda self: False))
    monkeypatch.setattr(
        auth_service_module, "send_password_reset", lambda *a, **k: calls.append(a)
    )
    user = make_user("reset-no-smtp@example.com")

    AuthService(db).request_password_reset(PasswordResetRequest(email=user.email))

    assert calls == []
    # The token is still minted. Whether the mail went out is not this method's
    # only job, and a half-written flow that skips the token would be worse.
    assert len(_reset_rows(db, user.id)) == 1


def test_a_link_minted_before_deactivation_stops_working(db, make_user):
    """The other end of the deactivated case: the account was live when the mail
    went out and is not by the time the link is followed."""
    from app.core.exceptions import ValidationError
    from app.schemas.user import PasswordResetConfirm

    user = make_user("reset-then-deactivated@example.com")
    token = UserService(db).create_token(
        user.id, TokenType.RESET_PASSWORD, expires_in_minutes=PASSWORD_RESET_EXPIRE_MINUTES
    )

    user.is_active = False
    db.commit()

    with pytest.raises(ValidationError):
        AuthService(db).reset_password(
            PasswordResetConfirm(token=token, new_password="a-new-long-password")
        )


def test_an_expired_row_is_not_offered_a_second_life(db, make_user):
    """Guards the expiry itself rather than the code around it: get_valid_token
    is the only thing standing between a month-old mail and the account."""
    user = make_user("reset-expired@example.com")
    value = "expired-reset-token"
    db.add(
        Token(
            user_id=user.id,
            token_type=TokenType.RESET_PASSWORD,
            token_hash=UserService.hash_token(value),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
    )
    db.commit()

    assert UserService(db).get_valid_token(value, TokenType.RESET_PASSWORD) is None
