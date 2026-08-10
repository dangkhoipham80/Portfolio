"""HTTP-level tests for the login surface.

``/login`` had no test of its own — the suite covered token lifecycle and the
reset/verify flows at the service layer, and access control at the HTTP layer,
but nothing drove the one route a person actually uses. These cover what the
route now promises:

* it is rate limited, so the single admin account cannot be guessed at leisure;
* every failure is the same 401, including a password too short to be legal; and
* the token it hands back actually authenticates.

Addresses here are ``@example.com``, not ``@example.invalid``: ``UserLogin.email``
is an ``EmailStr``, and ``.invalid`` is a reserved special-use TLD that
email-validator rejects — the request would 422 before reaching the code under
test and the assertions would pass vacuously. test_security.py hit exactly that.

Runs against whatever ``DATABASE_URL`` points at; fixtures live in conftest.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.constants import MIN_PASSWORD_LENGTH
from app.core.security import get_password_hash
from app.main import app
from app.models.token import TokenType
from app.services.user_service import UserService

client = TestClient(app)

PASSWORD = "correct-horse-battery-staple"
LOGIN_LIMIT = 10


def _login(email, password):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_returns_a_token_pair_that_authenticates(db, make_user):
    """The happy path, end to end: credentials in, usable session out."""
    user = make_user("login-works@example.com", hashed_password=get_password_hash(PASSWORD))

    response = _login(user.email, PASSWORD)
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["token_type"] == "bearer"
    assert body["email"] == user.email

    # The token is only worth anything if a protected route accepts it, and
    # get_current_user_dependency checks the database as well as the signature —
    # so this also proves login stored the token rather than only signing it.
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200, me.text
    assert me.json()["email"] == user.email


def test_login_is_rate_limited(make_user):
    """Ten guesses per quarter hour, then the door closes.

    Without this the only account on the API could be guessed at line speed.
    """
    make_user("login-limit@example.com", hashed_password=get_password_hash(PASSWORD))

    codes = [
        _login("login-limit@example.com", "wrong-password-entirely").status_code
        for _ in range(LOGIN_LIMIT)
    ]
    assert codes == [401] * LOGIN_LIMIT, codes

    blocked = _login("login-limit@example.com", "wrong-password-entirely")
    assert blocked.status_code == 429, blocked.text
    assert int(blocked.headers["retry-after"]) > 0


def test_the_limit_applies_to_correct_credentials_too(make_user):
    """The cap counts requests, not failures.

    Counting only failures would leave a working credential-stuffing oracle: an
    attacker who lands a hit is exactly the case the limit exists for, and a
    limiter that steps aside on success stops applying at the moment it matters.
    """
    user = make_user("login-limit-ok@example.com", hashed_password=get_password_hash(PASSWORD))

    codes = [_login(user.email, PASSWORD).status_code for _ in range(LOGIN_LIMIT)]
    assert codes == [200] * LOGIN_LIMIT, codes

    assert _login(user.email, PASSWORD).status_code == 429


def test_a_too_short_password_is_rejected_as_401_not_422(make_user):
    """Guards a deliberate omission in UserLogin.

    Every other password field on this API carries min_length. Adding one here
    would look like an oversight being fixed, and would answer a short guess
    with 422 while a long guess gets 401 — telling an attacker where the floor
    is, and locking out any password that predates the rule.
    """
    user = make_user("login-short@example.com", hashed_password=get_password_hash(PASSWORD))

    response = _login(user.email, "x")

    assert response.status_code == 401, response.text
    # Identical to what a long wrong password returns: the two are
    # indistinguishable from outside, which is the whole point.
    assert response.json() == _login(user.email, "x" * 40).json()


@pytest.mark.parametrize(
    "password,expected",
    [
        ("a" * (MIN_PASSWORD_LENGTH - 1), 422),
        ("a" * MIN_PASSWORD_LENGTH, 200),
    ],
)
def test_password_reset_confirm_enforces_the_length_floor(db, make_user, password, expected):
    """The reset flow was the way around the seed script's 12-character rule.

    init_auth_tables.py has refused a short ADMIN_PASSWORD for a while, but
    PasswordResetConfirm took a bare ``str`` — so the admin password it insisted
    on could be replaced with a single character straight afterwards.
    """
    user = make_user(
        f"reset-floor-{expected}@example.com",
        hashed_password=get_password_hash(PASSWORD),
    )
    token = UserService(db).create_token(
        user.id, TokenType.RESET_PASSWORD, expires_in_minutes=60
    )

    response = client.post(
        "/api/v1/auth/password-reset-confirm",
        json={"token": token, "new_password": password},
    )
    assert response.status_code == expected, response.text


def test_password_reset_request_is_rate_limited(make_user):
    """This route sends mail, so an uncapped one is a free email cannon aimed at
    whichever address the caller names — and an SMTP bill."""
    user = make_user("reset-limit@example.com", hashed_password=get_password_hash(PASSWORD))

    codes = [
        client.post(
            "/api/v1/auth/password-reset-request", json={"email": user.email}
        ).status_code
        for _ in range(5)
    ]
    assert codes == [200] * 5, codes

    blocked = client.post(
        "/api/v1/auth/password-reset-request", json={"email": user.email}
    )
    assert blocked.status_code == 429, blocked.text
