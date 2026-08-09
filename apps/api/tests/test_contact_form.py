"""Input validation on the public contact form.

``ContactCreate`` was four bare ``str`` fields. Anything at all posted to
``POST /api/v1/contacts/`` was stored: an empty name, a message of unlimited
size, and "not an email" in the address field of the only route a stranger can
write to. An over-long name reached Postgres and came back as a DataError 500.

Every case here asserts a 422. That is not for want of a success case — it is
because the route is rate limited to 5/hour on a module-level, in-memory bucket
that is shared across the whole pytest session, and this file sorts before
``test_security.py``, whose rate-limit test asserts that *its* first POST is a
201. A successful submission here would spend part of that budget and fail a
test in another file, which is a miserable thing to debug.

Nothing is spent by these: FastAPI validates the request body before it calls
the endpoint function, and the limiter decorator is on the endpoint function —
so a 422 never reaches the bucket. The accepted-payload case is covered by the
201 assertion in ``test_security.py``.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.portfolio import ContactCreate

client = TestClient(app)

VALID = {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "subject": "Analytical engine",
    "message": "Interested in your notes.",
}


def _post(**overrides):
    return client.post("/api/v1/contacts/", json={**VALID, **overrides})


@pytest.mark.parametrize("field", ["name", "email", "subject", "message"])
def test_blank_field_is_rejected(field):
    assert _post(**{field: ""}).status_code == 422


@pytest.mark.parametrize("field", ["name", "subject", "message"])
def test_whitespace_only_field_is_rejected(field):
    """`str_strip_whitespace` runs before min_length, so spaces are not content."""
    assert _post(**{field: "   \n\t "}).status_code == 422


@pytest.mark.parametrize(
    "address",
    [
        "not-an-email",
        "missing-domain@",
        "@missing-local.com",
        "spaces in@example.com",
    ],
)
def test_malformed_email_is_rejected(address):
    assert _post(email=address).status_code == 422


@pytest.mark.parametrize(
    "field,limit",
    [("name", 100), ("subject", 255), ("message", 5000)],
)
def test_over_length_field_is_rejected(field, limit):
    """The limits are the column widths; past them Postgres raised, not Pydantic."""
    assert _post(**{field: "x" * (limit + 1)}).status_code == 422


@pytest.mark.parametrize("field,limit", [("name", 100), ("subject", 255), ("message", 5000)])
def test_field_at_its_limit_is_accepted(field, limit):
    """Guards the off-by-one that would reject a legal maximum.

    Exercises the schema directly rather than the route: a payload that passes
    validation reaches the endpoint, and the endpoint spends a slot of the
    shared rate-limit bucket described above. The boundary is a property of the
    schema, so test it there and leave the bucket alone.
    """
    ContactCreate(**{**VALID, field: "x" * limit})


def test_surrounding_whitespace_is_stripped_before_storing():
    """What gets stored is what the length check measured."""
    contact = ContactCreate(**{**VALID, "name": "  Ada Lovelace  ", "message": "\n hello \n"})

    assert contact.name == "Ada Lovelace"
    assert contact.message == "hello"
