"""Email notification for the contact form.

Nothing here touches the network: ``smtplib.SMTP`` is patched out in every case
that would reach it, and the two cases that must not reach it at all assert
exactly that. The suite passes on a machine with no mail server and in CI with
no SMTP secret, which is the point — see ``test_notification_is_off_without_credentials``.

Two details of the setup are load-bearing:

* The limiter is switched off for this module. ``POST /contacts/`` is capped at
  5/hour on a process-wide in-memory bucket shared by the whole pytest session,
  and unlike ``test_contact_form.py`` these cases need real 201s. Spending four
  slots here would break the ``codes[0] == 201`` assertion in
  ``test_security.py``, which sorts after this file. Disabling is cleaner than
  resetting: the bucket is left exactly as it was found.

* Settings are patched per-test rather than read from ``.env``. A developer with
  working credentials and a developer without one must get the same result out
  of this file.
"""

import smtplib
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.rate_limit import limiter
from app.main import app
from app.models.portfolio import Contact

client = TestClient(app)

SENDER_ADDRESS = "notify-case@example.com"
PAYLOAD = {
    "name": "Ada Lovelace",
    "email": SENDER_ADDRESS,
    "subject": "Analytical engine",
    "message": "Interested in your notes.",
}


@pytest.fixture(autouse=True)
def unlimited():
    """Take this module out of the shared 5/hour bucket. See the docstring."""
    limiter.enabled = False
    yield
    limiter.enabled = True


@pytest.fixture(autouse=True)
def clean_contact_rows(db):
    """Drop the rows these cases insert.

    Before as well as after: every case here asserts on exactly one row for
    this address, so a run that dies part-way would otherwise make the next one
    fail on a leftover rather than on anything real.
    """
    def _drop():
        db.query(Contact).filter(Contact.email == SENDER_ADDRESS).delete(
            synchronize_session=False
        )
        db.commit()

    _drop()
    yield
    _drop()


@pytest.fixture
def smtp_configured(monkeypatch):
    """Credentials good enough for `contact_notifications_enabled` to be True."""
    monkeypatch.setattr(settings, "CONTACT_NOTIFY_ENABLED", True)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_USER", "owner@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "app-password")
    monkeypatch.setattr(settings, "EMAILS_FROM_EMAIL", "")
    monkeypatch.setattr(settings, "CONTACT_NOTIFY_TO", "")


@pytest.fixture
def smtp():
    """Patch the transport. Yields the server object the code sends through.

    ``send_email`` uses ``with smtplib.SMTP(...)``, so the object under test is
    the one the context manager returns, not the constructor's return value.
    """
    with patch("app.services.email_service.smtplib.SMTP") as constructor:
        server = MagicMock()
        constructor.return_value.__enter__.return_value = server
        yield constructor, server


def _stored(db):
    return db.query(Contact).filter(Contact.email == SENDER_ADDRESS).one()


def test_notification_is_sent_for_a_new_message(db, smtp_configured, smtp):
    constructor, server = smtp
    response = client.post("/api/v1/contacts/", json=PAYLOAD)

    assert response.status_code == 201
    assert _stored(db).subject == PAYLOAD["subject"]

    constructor.assert_called_once_with(
        "smtp.example.com", settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT
    )
    server.starttls.assert_called_once()
    server.login.assert_called_once_with("owner@example.com", "app-password")

    sent = server.send_message.call_args.args[0]
    # Sent to the owner, not to whoever filled in the form.
    assert sent["To"] == "owner@example.com"
    # Replying answers the visitor. Without this the owner replies to themselves.
    assert sent["Reply-To"] == SENDER_ADDRESS
    assert PAYLOAD["subject"] in sent["Subject"]
    assert PAYLOAD["message"] in sent.get_content()
    assert PAYLOAD["name"] in sent.get_content()


def test_message_is_saved_when_smtp_fails(db, caplog, smtp_configured, smtp):
    """The write must not depend on the notification. This is the whole design.

    A mail outage that lost contact messages would be worse than no notification
    at all, because it would be invisible from both ends: the visitor sees a
    success, the owner sees nothing, and there is no row to reconcile from.
    """
    constructor, _ = smtp
    constructor.side_effect = smtplib.SMTPAuthenticationError(535, b"nope")

    with caplog.at_level("ERROR"):
        response = client.post("/api/v1/contacts/", json=PAYLOAD)

    assert response.status_code == 201
    stored = _stored(db)
    assert stored.message == PAYLOAD["message"]

    # Failing quietly is the actual risk here — a swallowed exception looks
    # exactly like a working mailer nobody has emailed yet.
    assert f"contact id={stored.id}" in caplog.text
    assert "SMTPAuthenticationError" in caplog.text


def test_notification_is_off_without_credentials(db, monkeypatch, smtp):
    """CI has no SMTP server and sets no secret. It must still be green."""
    constructor, _ = smtp
    monkeypatch.setattr(settings, "SMTP_USER", "")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")

    response = client.post("/api/v1/contacts/", json=PAYLOAD)

    assert response.status_code == 201
    assert _stored(db)
    constructor.assert_not_called()


def test_notification_can_be_switched_off_with_credentials(
    db, smtp_configured, smtp, monkeypatch
):
    """The kill switch works without having to remove working credentials."""
    constructor, _ = smtp
    monkeypatch.setattr(settings, "CONTACT_NOTIFY_ENABLED", False)

    response = client.post("/api/v1/contacts/", json=PAYLOAD)

    assert response.status_code == 201
    assert _stored(db)
    constructor.assert_not_called()


def test_notification_goes_to_the_configured_recipient(smtp_configured, smtp, monkeypatch):
    """CONTACT_NOTIFY_TO wins over the from-address fallback."""
    _, server = smtp
    monkeypatch.setattr(settings, "CONTACT_NOTIFY_TO", "inbox@example.com")

    assert client.post("/api/v1/contacts/", json=PAYLOAD).status_code == 201

    assert server.send_message.call_args.args[0]["To"] == "inbox@example.com"


def test_from_header_falls_back_to_the_smtp_account(smtp_configured, smtp):
    """EMAILS_FROM_EMAIL is empty in the real .env, and `Name <>` is rejected."""
    _, server = smtp

    assert client.post("/api/v1/contacts/", json=PAYLOAD).status_code == 201

    assert server.send_message.call_args.args[0]["From"] == (
        f"{settings.EMAILS_FROM_NAME} <owner@example.com>"
    )
