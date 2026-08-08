"""Shared rate limiter.

Lives here rather than in app.main so endpoint modules can import it without a
circular import (main -> api_router -> endpoints -> main).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
