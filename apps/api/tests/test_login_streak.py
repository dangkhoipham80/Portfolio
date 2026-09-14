"""The daily login streak.

Almost all of this is about the arithmetic in ``UserService.record_login``,
tested directly rather than through ``POST /auth/login``, because the interesting
cases are about *yesterday* and there is no way to log in yesterday. The one case
that does go through the route is the one the unit tests cannot make: that a real
successful sign-in reaches the counter at all, and that a refused one does not.

The day boundary is UTC, which is where every other instant in this application
lives. That is asserted here as well as documented, because it is the kind of
decision a later change makes quietly — ``date.today()`` in place of
``datetime.now(timezone.utc).date()`` looks like a simplification and moves the
boundary to wherever the server happens to be.

Runs against whatever ``DATABASE_URL`` points at; see tests/conftest.py.
"""

import secrets
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.main import app
from app.models.user import UserStatus
from app.services.user_service import UserService

client = TestClient(app)

TODAY = datetime.now(timezone.utc).date()
YESTERDAY = TODAY - timedelta(days=1)

# Minted, not written down.
#
# It is a throwaway for an account that exists for the length of one test in a
# scratch database, so the value is irrelevant — but a literal shaped like a
# password is what a secret scanner reports, and this repo has a note about that
# in .github/workflows/ci.yml: it has leaked a live credential once already, and
# scanner findings on test fixtures are the noise that trains people to ignore
# the real ones. The workflow mints its SECRET_KEY for exactly this reason; so
# does this.
PASSWORD = f"streak-{secrets.token_urlsafe(16)}"


@pytest.fixture
def streaker(db, make_user):
    """A verified account with no login history yet.

    ``@example.com`` rather than the ``.invalid`` the other fixtures use:
    ``UserLogin.email`` is an EmailStr and email-validator refuses reserved
    names, so a ``.invalid`` address 422s at the login route before any of this
    is reached.
    """
    return make_user("streak@example.com", hashed_password=get_password_hash(PASSWORD))


def _history(db, user, *, last_login_day, streak):
    """Put the account in the state a past run of logins would have left it in.

    There is no way to log in yesterday, and the arithmetic only ever compares
    ``last_login_day`` with *today* — so "the reader signed in on the 10th and
    the 11th" is not a sequence of calls, it is two column values. Writing them
    directly is both the only way to build a history and the honest description
    of what the function actually reads.
    """
    user.last_login_day = last_login_day
    user.login_streak = streak
    db.commit()
    db.refresh(user)


def test_a_first_login_starts_the_streak_at_one(db, streaker):
    UserService(db).record_login(streaker)

    assert streaker.login_streak == 1
    assert streaker.last_login_day == TODAY


def test_a_second_login_the_same_day_changes_nothing(db, streaker):
    """Sep 11 twice is still day 2, not day 3."""
    service = UserService(db)
    service.record_login(streaker)
    service.record_login(streaker)
    service.record_login(streaker)

    assert streaker.login_streak == 1


def test_a_login_the_next_day_increments(db, streaker):
    _history(db, streaker, last_login_day=YESTERDAY, streak=1)

    UserService(db).record_login(streaker)

    assert streaker.login_streak == 2
    assert streaker.last_login_day == TODAY


def test_a_missed_day_resets_the_streak_to_one(db, streaker):
    """Sep 12 at 7, then nothing on the 13th: the 14th is day 1 again."""
    _history(db, streaker, last_login_day=TODAY - timedelta(days=2), streak=7)

    UserService(db).record_login(streaker)

    assert streaker.login_streak == 1


def test_a_run_of_consecutive_days_counts_up(db, streaker):
    """The worked example from the brief, walked one day at a time.

    Each step sets the state the previous day left behind and then signs in, so
    "the next day" is always today and the assertion is about what the function
    does with the day before it.
    """
    service = UserService(db)

    # Sep 10 -> 1. Nothing before it.
    service.record_login(streaker)
    assert streaker.login_streak == 1

    # Sep 11 -> 2.
    _history(db, streaker, last_login_day=YESTERDAY, streak=1)
    service.record_login(streaker)
    assert streaker.login_streak == 2

    # Sep 11 again -> still 2.
    service.record_login(streaker)
    assert streaker.login_streak == 2

    # Sep 12 -> 3.
    _history(db, streaker, last_login_day=YESTERDAY, streak=2)
    service.record_login(streaker)
    assert streaker.login_streak == 3

    # Nothing on Sep 13; Sep 14 -> back to 1.
    _history(db, streaker, last_login_day=TODAY - timedelta(days=2), streak=3)
    service.record_login(streaker)
    assert streaker.login_streak == 1


def test_a_clock_that_went_backwards_resets_rather_than_counting_down(db, streaker):
    """A stored day in the future is not "minus one day"; it is a reset."""
    _history(db, streaker, last_login_day=TODAY + timedelta(days=3), streak=5)

    UserService(db).record_login(streaker)

    assert streaker.login_streak == 1


def test_the_day_boundary_is_utc(db, streaker):
    """Not the server's local day. See record_login for why it is stated."""
    UserService(db).record_login(streaker)

    assert streaker.last_login_day == datetime.now(timezone.utc).date()


# --- through the route ------------------------------------------------------

def test_signing_in_advances_the_streak_and_me_reports_it(db, streaker):
    response = client.post(
        "/api/v1/auth/login", json={"email": streaker.email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    ).json()

    assert me["login_streak"] == 1
    assert me["last_login_day"] == TODAY.isoformat()


def test_a_refused_login_does_not_touch_the_streak(db, make_user):
    """A streak counts the days you got in, not the days you tried.

    An unverified account is refused after the password has been checked, which
    is exactly the path that would advance the counter if it lived in
    authenticate_user().
    """
    pending = make_user(
        "pending-streak@example.com",
        hashed_password=get_password_hash(PASSWORD),
        is_verified=False,
        status=UserStatus.PENDING_VERIFICATION,
    )

    refused = client.post(
        "/api/v1/auth/login", json={"email": pending.email, "password": PASSWORD}
    )
    assert refused.status_code == 401

    db.refresh(pending)
    assert pending.login_streak == 0
    assert pending.last_login_day is None


def test_a_wrong_password_does_not_touch_the_streak(db, streaker):
    client.post(
        "/api/v1/auth/login",
        json={"email": streaker.email, "password": f"not-{PASSWORD}"},
    )

    db.refresh(streaker)
    assert streaker.login_streak == 0
