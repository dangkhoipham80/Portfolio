"""Access-control tests.

These lock in the fixes for two things that were wide open:

* every write route (projects, skills, certificates, contacts) was
  unauthenticated, so anyone who knew the URL could create or delete content;
* ``GET /api/v1/contacts`` returned the name, email address and message body of
  everyone who had ever used the contact form, to anyone who asked.

They run against whatever ``DATABASE_URL`` points at, so point it at a scratch
database — the contact-form cases insert rows.
"""

import base64
import json

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.main import app

client = TestClient(app)

WRITE_ROUTES = [
    ("post", "/api/v1/projects/"),
    ("put", "/api/v1/projects/1"),
    ("delete", "/api/v1/projects/1"),
    ("post", "/api/v1/skills/"),
    ("put", "/api/v1/skills/1"),
    ("delete", "/api/v1/skills/1"),
    ("post", "/api/v1/certificates/"),
    ("put", "/api/v1/certificates/1"),
    ("delete", "/api/v1/certificates/1"),
]

CONTACT_PRIVATE_ROUTES = [
    ("get", "/api/v1/contacts/"),
    ("get", "/api/v1/contacts/1"),
    ("put", "/api/v1/contacts/1/read"),
    ("delete", "/api/v1/contacts/1"),
]


def _call(method: str, path: str, **kwargs):
    # TestClient only accepts a body on the methods that take one.
    if method in ("post", "put", "patch"):
        kwargs.setdefault("json", {})
    return getattr(client, method)(path, **kwargs)


def test_health_is_public():
    assert client.get("/health").status_code == 200


@pytest.mark.parametrize("path", ["/api/v1/projects/", "/api/v1/skills/", "/api/v1/certificates/"])
def test_content_is_readable_without_a_token(path):
    assert client.get(path).status_code == 200


@pytest.mark.parametrize("method,path", WRITE_ROUTES)
def test_write_routes_reject_anonymous_callers(method, path):
    assert _call(method, path).status_code in (401, 403)


@pytest.mark.parametrize("method,path", CONTACT_PRIVATE_ROUTES)
def test_contact_messages_are_not_public(method, path):
    assert _call(method, path).status_code in (401, 403)


def test_alg_none_token_is_rejected():
    """A JWT claiming ``alg: none`` must not authenticate anyone.

    python-jose 3.3.0 (CVE-2025-61152) accepted these. PyJWT with an explicit
    ``algorithms`` allow-list does not.
    """
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": "1", "exp": 9999999999}).encode()).rstrip(b"=")
    forged = f"{header.decode()}.{payload.decode()}."

    r = _call("post", "/api/v1/projects/", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code in (401, 403)


def test_malformed_token_is_rejected():
    r = _call("post", "/api/v1/projects/", headers={"Authorization": "Bearer garbage.token.here"})
    assert r.status_code in (401, 403)


def test_refresh_token_cannot_be_used_as_an_access_token():
    """A refresh token lives for 30 days; an access token for 60 minutes.

    Without a check on the `type` claim the long-lived one authenticated every
    protected route, which made the short access-token lifetime meaningless.
    """
    refresh = create_access_token({"sub": "1", "type": "refresh"})
    r = _call("post", "/api/v1/projects/", headers={"Authorization": f"Bearer {refresh}"})
    assert r.status_code in (401, 403)


@pytest.mark.parametrize("path", ["/api/v1/auth/register", "/api/v1/auth/google"])
def test_public_signup_surface_is_gone(path):
    """Single-owner API: the admin comes from the seed script, not signup."""
    assert client.post(path, json={}).status_code == 404


def test_contact_form_is_public_but_rate_limited():
    codes = [
        client.post(
            "/api/v1/contacts/",
            json={
                "name": "Rate Test",
                "email": f"ratelimit{i}@example.invalid",
                "subject": "Hi",
                "message": "hello",
            },
        ).status_code
        for i in range(7)
    ]
    assert codes[0] == 201, codes
    assert 429 in codes, codes
