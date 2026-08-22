"""A stable, non-reversible handle for an anonymous visitor.

Ratings and comments both need to recognise the same person twice — one vote per
post, and a run of comments from one source showing as such in the moderation
queue — without asking anyone to sign in and without keeping a log of who read
what.

The handle is an HMAC of the caller's address and user agent, keyed with the
application secret. Three properties follow, and all three are the reason it is
built this way rather than stored raw:

* It cannot be turned back into an address. The table is a list of opaque
  strings, so it is not a record of anyone's reading habits even to whoever
  holds the database.
* It cannot be *guessed* into. Without a keyed digest, checking whether a given
  IP had rated a post would be a plain SHA-256 away, which is a lookup table
  over the whole IPv4 space.
* It changes if the secret is rotated, which resets every vote. That is a real
  cost and an accepted one: the alternative is a second long-lived secret to
  manage for the sake of star ratings on a blog.

It is a weak identity and nothing here pretends otherwise — a different browser
or a different network is a different visitor. What it stops is the only abuse
this actually sees, which is one person clicking five stars twenty times.
"""

import hashlib
import hmac

from fastapi import Request

from app.core.config import settings
from app.core.rate_limit import client_ip


def visitor_hash(request: Request, *, scope: str = "") -> str:
    """A 64-character hex handle for whoever sent this request.

    ``scope`` separates uses that must not be linkable to each other — a
    rating's handle and a comment's handle for the same person differ, so
    neither table can be joined against the other to work out that the person
    who left a comment also gave the post two stars.
    """
    agent = request.headers.get("user-agent", "")
    material = f"{scope}\x00{client_ip(request)}\x00{agent}".encode()

    return hmac.new(
        settings.SECRET_KEY.encode(), material, hashlib.sha256
    ).hexdigest()
