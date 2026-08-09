"""Shared rate limiter.

Lives here rather than in app.main so endpoint modules can import it without a
circular import (main -> api_router -> endpoints -> main).
"""

from fastapi import Request
from slowapi import Limiter

from app.core.config import settings


def client_ip(request: Request) -> str:
    """Best-effort real client IP.

    slowapi's ``get_remote_address`` reads ``request.client.host``, which behind
    Vercel or Railway is the proxy — so every visitor shares a single bucket and
    five contact-form submissions in total lock the form for everyone.

    ``X-Forwarded-For`` is only trusted in production, where a proxy is actually
    terminating the connection and appending the real address. Trusting it
    locally (or on a directly-exposed port) would let a caller pick their own
    rate-limit key by sending the header themselves.
    """
    fallback = request.client.host if request.client else "unknown"

    if not settings.is_production:
        return fallback

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Left-most entry is the original client; the rest are proxy hops.
        return forwarded.split(",")[0].strip() or fallback

    return fallback


# ``headers_enabled`` makes slowapi attach ``Retry-After`` (and the
# ``X-RateLimit-*`` trio) to the 429. It defaults to False, and without it the
# contact form can only tell someone they have been rate limited, not when they
# may try again — leaving them to refresh and find out. The window is an hour,
# so "try again later" is not usable guidance.
limiter = Limiter(key_func=client_ip, headers_enabled=True)
