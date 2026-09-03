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
from html import escape
from urllib.parse import quote

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(
    to_email: str,
    subject: str,
    body: str,
    *,
    reply_to: str | None = None,
    html: str | None = None,
) -> None:
    """Send one message. Raises on any SMTP failure.

    ``body`` is the plain-text part and is never optional. Passing ``html`` adds
    it as an alternative rather than a replacement: the result is
    multipart/alternative, and a client that cannot or will not render HTML —
    a terminal reader, a screen reader set to prefer text, Gmail's "plain text
    only" — still gets the whole message rather than a blank one.
    """
    message = EmailMessage()
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.emails_from_address}>"
    message["To"] = to_email
    message["Subject"] = subject
    if reply_to:
        message["Reply-To"] = reply_to

    message.set_content(body)
    if html:
        message.add_alternative(html, subtype="html")

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


# Lifted from apps/web/app/globals.css so the mail and the site are visibly the
# same thing. Resolved to hex here because no mail client evaluates a CSS custom
# property, and several still drop a `<style>` block entirely — every rule below
# is inline for the same reason.
_BACKGROUND = "#ebfaeb"  # --background   120 60% 95%
_CARD = "#ffffff"  # --card         0 0% 100%
_INK = "#0f1729"  # --foreground   222 47% 11%
_PRIMARY = "#1c721c"  # --primary      120 60% 28%
_BORDER = "#c2d6c2"  # --border       120 20% 80%
_MUTED = "#586a84"  # --muted-foreground 215.4 20% 43%

# Space Grotesk and IBM Plex are webfonts, and a webfont in an email is a
# request most clients refuse. The stacks fall back to what the reading device
# already has; the *roles* survive even when the exact faces do not.
_SANS = "'Space Grotesk','Segoe UI',Roboto,Helvetica,Arial,sans-serif"
_MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"


def _notification_text(*, name: str, email: str, subject: str, message: str) -> str:
    """The plain-text part. Also the whole message for anyone who prefers text."""
    return (
        f"New message from the portfolio contact form.\n\n"
        f"From:    {name} <{email}>\n"
        f"Subject: {subject}\n\n"
        f"{message}\n"
    )


def _notification_html(*, name: str, email: str, subject: str, message: str) -> str:
    """The HTML part.

    Every interpolated value goes through ``escape`` first, and that is not a
    formality: all four come from a public form that anyone on the internet can
    submit. Without it a name of ``<img src=x onerror=...>`` is markup in a mail
    the owner opens, and the closing ``</td>`` in a message body would be enough
    to take the layout apart by accident.

    Tables and inline styles rather than flexbox and a stylesheet, because
    Outlook renders mail through Word's HTML engine, which supports neither.
    """
    safe_name = escape(name)
    safe_email = escape(email)
    safe_subject = escape(subject)
    # Escape first, then add the breaks — the other order would turn a literal
    # "<br>" typed by a visitor into a real line break.
    safe_message = escape(message).replace("\n", "<br>")

    # Shown by the inbox list next to the subject, and hidden in the message
    # itself. Without one, clients fill that space with whatever text comes
    # first, which here would be the words "New message from the portfolio
    # contact form" on every single mail.
    preheader = escape(message[:120].replace("\n", " "))

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>{safe_subject}</title>
</head>
<body style="margin:0;padding:0;background:{_BACKGROUND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:{_BACKGROUND};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;background:{_CARD};border:1px solid {_BORDER};
                    border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:28px 28px 0 28px;">
            <p style="margin:0 0 6px 0;font-family:{_MONO};font-size:11px;
                      letter-spacing:0.12em;text-transform:uppercase;color:{_PRIMARY};">
              New contact message
            </p>
            <h1 style="margin:0;font-family:{_SANS};font-size:20px;line-height:1.35;
                       font-weight:600;color:{_INK};">
              {safe_subject}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 0 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="font-family:{_MONO};font-size:13px;color:{_MUTED};">
              <tr>
                <td style="padding:0 12px 6px 0;white-space:nowrap;">from</td>
                <td style="padding:0 0 6px 0;color:{_INK};">{safe_name}</td>
              </tr>
              <tr>
                <td style="padding:0 12px 0 0;white-space:nowrap;">email</td>
                <td style="padding:0;">
                  <a href="mailto:{safe_email}"
                     style="color:{_PRIMARY};text-decoration:underline;">{safe_email}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 4px 28px;">
            <div style="border-top:1px solid {_BORDER};padding-top:20px;
                        font-family:{_SANS};font-size:15px;line-height:1.6;color:{_INK};">
              {safe_message}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px 28px;">
            <a href="mailto:{safe_email}?subject=Re:%20{quote(subject)}"
               style="display:inline-block;background:{_PRIMARY};color:#ffffff;
                      font-family:{_SANS};font-size:14px;font-weight:600;
                      text-decoration:none;padding:10px 18px;border-radius:8px;">
              Reply to {safe_name}
            </a>
          </td>
        </tr>
      </table>
      <p style="max-width:560px;margin:16px auto 0 auto;font-family:{_MONO};
                font-size:11px;line-height:1.6;color:{_MUTED};text-align:center;">
        Sent by the contact form on khoipham.vercel.app.<br>
        Replying to this mail answers {safe_name} directly.
      </p>
    </td>
  </tr>
</table>
</body>
</html>
"""


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

    body = _notification_text(name=name, email=email, subject=subject, message=message)
    html = _notification_html(name=name, email=email, subject=subject, message=message)

    try:
        send_email(
            settings.contact_notify_recipient,
            f"[Portfolio] {subject}",
            body,
            # So replying in the mail client answers the visitor, not yourself.
            # Safe to interpolate: EmailStr has already rejected the newlines a
            # header-injection attempt would need.
            reply_to=email,
            html=html,
        )
    except Exception:
        logger.exception(
            "Contact notification failed for contact id=%s; the message is saved", contact_id
        )
    else:
        logger.info("Contact notification sent for contact id=%s", contact_id)


def _reset_text(*, greeting: str, reset_url: str, expires_minutes: int) -> str:
    """The plain-text part of the reset mail.

    Carries the full URL on its own line rather than hiding it behind a phrase.
    A password-reset link is exactly the kind of mail a careful person wants to
    read before clicking, and a text part that says "click the button above"
    gives them nothing to read.
    """
    return (
        f"{greeting}\n\n"
        f"Someone asked to reset the password on your {settings.PROJECT_NAME} account.\n"
        f"Open this link to choose a new one:\n\n"
        f"{reset_url}\n\n"
        f"The link works once and expires in {_minutes_in_words(expires_minutes)}.\n\n"
        f"If this wasn't you, ignore this mail — nothing has changed, and the\n"
        f"link stops working on its own.\n"
    )


def _minutes_in_words(minutes: int) -> str:
    """"60" is not what a person reading a deadline wants to be handed."""
    if minutes % 60 == 0:
        hours = minutes // 60
        return f"{hours} hour" if hours == 1 else f"{hours} hours"
    return f"{minutes} minutes"


def _reset_html(*, greeting: str, reset_url: str, expires_minutes: int) -> str:
    """The HTML part.

    Same construction as the contact notification above and for the same
    reasons: tables and inline styles because Outlook renders through Word's
    HTML engine, every interpolated value escaped, and a preheader so the inbox
    list shows the point of the mail rather than the first words of the body.

    The link is printed underneath the button as well as wired into it. A button
    whose destination cannot be read is the shape of every phishing mail there
    is, and this one is asking someone to type a password on the other side of
    it.
    """
    safe_greeting = escape(greeting)
    safe_url = escape(reset_url, quote=True)
    window = escape(_minutes_in_words(expires_minutes))

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:{_BACKGROUND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  Choose a new password. The link expires in {window}.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:{_BACKGROUND};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;background:{_CARD};border:1px solid {_BORDER};
                    border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:28px 28px 0 28px;">
            <p style="margin:0 0 6px 0;font-family:{_MONO};font-size:11px;
                      letter-spacing:0.12em;text-transform:uppercase;color:{_PRIMARY};">
              Password reset
            </p>
            <h1 style="margin:0;font-family:{_SANS};font-size:20px;line-height:1.35;
                       font-weight:600;color:{_INK};">
              Choose a new password
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 0 28px;font-family:{_SANS};font-size:15px;
                     line-height:1.6;color:{_INK};">
            <p style="margin:0 0 12px 0;">{safe_greeting}</p>
            <p style="margin:0;">
              Someone asked to reset the password on your
              {escape(settings.PROJECT_NAME)} account. Use the button below to set
              a new one. The link works once and expires in {window}.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 0 28px;">
            <a href="{safe_url}"
               style="display:inline-block;background:{_PRIMARY};color:#ffffff;
                      font-family:{_SANS};font-size:14px;font-weight:600;
                      text-decoration:none;padding:10px 18px;border-radius:8px;">
              Set a new password
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 0 28px;">
            <p style="margin:0;font-family:{_MONO};font-size:11px;line-height:1.7;
                      color:{_MUTED};word-break:break-all;">
              {safe_url}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px 28px;">
            <p style="margin:0;border-top:1px solid {_BORDER};padding-top:20px;
                      font-family:{_SANS};font-size:14px;line-height:1.6;color:{_MUTED};">
              If you didn&rsquo;t ask for this, ignore this mail. Nothing has
              changed, and the link stops working on its own.
            </p>
          </td>
        </tr>
      </table>
      <p style="max-width:560px;margin:16px auto 0 auto;font-family:{_MONO};
                font-size:11px;line-height:1.6;color:{_MUTED};text-align:center;">
        Sent because a password reset was requested for this address.
      </p>
    </td>
  </tr>
</table>
</body>
</html>
"""


def send_password_reset(
    to_email: str,
    *,
    greeting: str,
    reset_url: str,
    expires_minutes: int,
) -> None:
    """Send the reset link. Raises, like ``send_email`` — the caller decides.

    ``auth_service`` swallows the failure, because a request that answers 500
    tells whoever is on the login screen that the address exists. That is the
    caller's decision to make, not this module's.
    """
    send_email(
        to_email,
        "Reset your password",
        _reset_text(greeting=greeting, reset_url=reset_url, expires_minutes=expires_minutes),
        html=_reset_html(greeting=greeting, reset_url=reset_url, expires_minutes=expires_minutes),
    )
