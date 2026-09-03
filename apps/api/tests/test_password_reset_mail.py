"""The reset mail itself: both parts, and what must not be in either.

Nothing here touches the network — every case calls the two builders directly,
which is also why they are not private-by-convention only. The transport is
covered by test_contact_notification.py.
"""

from app.services.email_service import _reset_html, _reset_text, send_password_reset

URL = "https://example.test/reset-password?token=header.payload.signature"


def _both_parts(**overrides):
    kwargs = {"greeting": "Hello Ada,", "reset_url": URL, "expires_minutes": 60}
    kwargs.update(overrides)
    return _reset_text(**kwargs), _reset_html(**kwargs)


def test_the_link_is_readable_in_both_parts():
    """A password-reset mail asks someone to type a password on the other side
    of a link, which is the shape of every phishing mail there is. A button
    whose destination cannot be read gives a careful reader nothing to check —
    so the URL is printed as text as well as wired into the anchor."""
    text, html = _both_parts()

    assert URL in text
    assert f'href="{URL}"' in html
    # Printed, not only linked.
    assert html.count(URL) >= 2


def test_the_deadline_is_stated_in_words():
    """"60" is not what a person reading a deadline wants to be handed."""
    text, html = _both_parts()

    assert "1 hour" in text
    assert "1 hour" in html
    assert "60 minutes" not in text


def test_an_odd_window_is_still_readable():
    text, _ = _both_parts(expires_minutes=90)

    assert "90 minutes" in text


def test_the_greeting_is_escaped():
    """full_name is admin-set rather than public, so this is defence in depth —
    but the greeting is the one interpolated value that is free text, and an
    unescaped apostrophe-and-angle-bracket name is markup in the owner's inbox."""
    html = _reset_html(
        greeting="Hello <script>alert(1)</script>,", reset_url=URL, expires_minutes=60
    )

    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_the_url_is_escaped_into_the_attribute():
    """A JWT is base64url and dots, so nothing needs escaping today. "Nothing
    needs escaping today" is how an attribute eventually breaks out of its
    quotes, and this attribute is the destination of the button."""
    hostile = 'https://example.test/x?token=a"onmouseover="alert(1)'
    html = _reset_html(greeting="Hello,", reset_url=hostile, expires_minutes=60)

    # The quotes that would close the href are gone; the value is still there,
    # entity-encoded, which is the difference between escaping and stripping.
    assert hostile not in html
    assert 'onmouseover="' not in html
    assert "a&quot;onmouseover=&quot;alert(1)" in html


def test_the_html_carries_a_preheader():
    """Without one, the inbox list fills that space with whatever text comes
    first — here, the words "Password reset" on every single mail."""
    _, html = _both_parts()

    preheader = html.split('<div style="display:none', 1)[1].split("</div>", 1)[0]
    assert "The link expires in 1 hour." in preheader


def test_both_parts_are_attached(monkeypatch):
    """A client set to plain text only must not receive a blank message."""
    captured = {}

    def _capture(to_email, subject, body, **kwargs):
        captured.update({"to": to_email, "subject": subject, "body": body, **kwargs})

    monkeypatch.setattr("app.services.email_service.send_email", _capture)

    send_password_reset(
        "ada@example.invalid", greeting="Hello Ada,", reset_url=URL, expires_minutes=60
    )

    assert captured["to"] == "ada@example.invalid"
    assert captured["subject"] == "Reset your password"
    assert URL in captured["body"]
    assert URL in captured["html"]
