"""Password hashing and JWT issuing/verification.

Two libraries were replaced here rather than upgraded:

- ``python-jose`` -> ``PyJWT``. python-jose has had no release since 2022 and
  CVE-2025-61152 (an ``alg=none`` signature bypass) has no upstream fix, so
  there was no version to move to.
- ``passlib`` -> ``bcrypt`` directly. passlib last shipped in 2020 and reads
  ``bcrypt.__about__``, which bcrypt removed in 4.1; against bcrypt 5.x its
  ``CryptContext.hash()`` raises for every password, so auth silently stopped
  working. Hashes are unchanged ``$2b$`` bcrypt, so existing ones still verify.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, status

from app.core.config import settings

ALGORITHM = "HS256"

# bcrypt only consumes the first 72 bytes and raises on anything longer. passlib
# used to truncate silently, so we keep doing that to stay compatible with hashes
# it produced — but on a character boundary, so a multi-byte character at the
# limit cannot be cut in half.
BCRYPT_MAX_BYTES = 72


def _prepare(password: str) -> bytes:
    encoded = password.encode("utf-8")
    if len(encoded) <= BCRYPT_MAX_BYTES:
        return encoded
    return encoded[:BCRYPT_MAX_BYTES].decode("utf-8", "ignore").encode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a password against its stored hash."""
    try:
        return bcrypt.checkpw(_prepare(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed or non-bcrypt hash in the row — treat as a failed login
        # rather than a 500.
        return False


def get_password_hash(password: str) -> str:
    """Hash a password with bcrypt."""
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT, returning its claims or None.

    ``algorithms`` is an allow-list, so a token whose header advertises
    ``none`` — or any algorithm other than HS256 — is rejected outright.
    """
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        return None


def get_current_user(token: str) -> str:
    """Return the subject claim of a valid token, or raise 401."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    return user_id
