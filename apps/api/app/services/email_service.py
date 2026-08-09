"""Outbound mail.

One place that knows how to talk to SMTP. ``auth_service`` had its own copy of
this block; a second copy for the contact form would have made three, each with
its own answer to whether a failure should raise.

The split here is deliberate:

* ``send_email`` **raises**. It is a transport, and a transport that swallows
  its errors cannot be used by a caller that needs to know.
* ``send_contact_notification`` **never raises**. It runs as a background task,
  after ``POST /contacts/`` has already answered 201 and committed the row, so
  there is no longer a request to fail — but it logs, at ``exception`` level
  with the contact id, so a silent SMTP outage is visible in the logs rather
  than only in an inbox that never fills up.

That is the mirror image of ``apps/web/lib/api.ts``: a read hides its failure
behind a fallback because a visitor cannot act on it, a write must not hide one
because the operator can.
"""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str, *, reply_to: str | None = None) -> None:
    """Send one plain-text message. Raises on any SMTP failure."""
    message = EmailMessage()
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.emails_from_address}>"
    message["To"] = to_email
    message["Subject"] = subject
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(body)

    # `with` rather than an explicit quit(): the old version leaked the
    # connection whenever login() or send_message() raised, because quit() was
    # the line after the one that threw.
    with smtplib.SMTP(
        settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT
    ) as server:
        if settings.SMTP_TLS:
            server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)


def send_contact_notification(
    *,
    contact_id: int,
    name: str,
    email: str,
    subject: str,
    message: str,
) -> None:
    """Tell the site owner someone used the contact form.

    Takes plain values, not the ``Contact`` row: ``get_db`` closes the session
    once the response is sent, and background tasks run after that, so reading
    an attribute off the ORM object here would raise ``DetachedInstanceError``
    for a message that was in fact saved perfectly well.
    """
    if not settings.contact_notifications_enabled:
        # The normal state in CI and on a fresh clone. Debug, not warning —
        # an unconfigured mailer is a choice, not a fault.
        logger.debug("Contact notification skipped (disabled or no SMTP credentials)")
        return

    body = (
        f"New message from the portfolio contact form.\n\n"
        f"From:    {name} <{email}>\n"
        f"Subject: {subject}\n\n"
        f"{message}\n"
    )

    try:
        send_email(
            settings.contact_notify_recipient,
            f"[Portfolio] {subject}",
            body,
            # So replying in the mail client answers the visitor, not yourself.
            # Safe to interpolate: EmailStr has already rejected the newlines a
            # header-injection attempt would need.
            reply_to=email,
        )
    except Exception:
        logger.exception(
            "Contact notification failed for contact id=%s; the message is saved", contact_id
        )
    else:
        logger.info("Contact notification sent for contact id=%s", contact_id)
