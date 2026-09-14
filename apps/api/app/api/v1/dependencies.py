
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.constants import ErrorMessages
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.token import TokenType
from app.services.user_service import UserService

# Security scheme
security = HTTPBearer()

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=ErrorMessages.UNAUTHORIZED,
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user_dependency(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Resolve the caller from a bearer access token."""
    token = credentials.credentials

    # Raises 401 on a bad signature, a wrong/missing type claim, or expiry.
    user_id = get_current_user(token)

    try:
        user_pk = int(user_id)
    except (TypeError, ValueError):
        # A forged token could carry a non-numeric `sub`; that is a rejected
        # credential, not a 500.
        raise _UNAUTHORIZED from None

    user_service = UserService(db)

    # Logout marks the row revoked. Checking only the JWT meant a stolen token
    # kept working for its full lifetime after the user logged out, which made
    # logout purely cosmetic.
    if not user_service.get_valid_token(token, TokenType.ACCESS):
        raise _UNAUTHORIZED

    user = user_service.get_user_by_id(user_pk)
    if not user:
        raise _UNAUTHORIZED

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# A second HTTPBearer, with auto_error off.
#
# The shared `security` above defaults to auto_error=True and raises before the
# handler body runs, which is right for a route that requires a token and wrong
# for every dependency below: a missing header has to *reach* the body as None
# so it can be answered with an anonymous view, or with a sentence of our own
# rather than FastAPI's bare "Not authenticated".
optional_security = HTTPBearer(auto_error=False)


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(optional_security),
    db: Session = Depends(get_db),
):
    """Resolve any signed-in caller if there is one, otherwise None.

    The public content routes use this to decide how much of a long post to
    send. A missing *or bad* token means anonymous rather than 401, for the same
    reason get_optional_admin gives: these routes are public, and an expired
    token should still render the readable portion of the site.

    Distinct from get_optional_admin below, which narrows the same lookup to
    admins for the draft-visibility decision. Two questions, two dependencies —
    folding them into one that returns a user and leaves each route to ask
    ``user.is_admin`` is how a route eventually forgets to.
    """
    if credentials is None:
        return None

    try:
        return get_current_user_dependency(credentials=credentials, db=db)
    except HTTPException:
        return None


def require_verified_user(
    credentials: HTTPAuthorizationCredentials = Depends(optional_security),
    db: Session = Depends(get_db),
):
    """A signed-in caller whose address has actually been confirmed.

    Used by the one route a reader writes prose through. The two refusals are
    different things and are answered differently, because the reader can only
    act on one of them:

    * **No token, or one the API will not take — 401.** Sign in.
    * **A good token on an unconfirmed address — 403.** Signing in again will
      not help; the token is fine and the address is not, so the message says
      to confirm it and the web app turns that into a "resend the link" button.

    Built on ``optional_security`` rather than ``Depends(security)`` so the
    first case reaches this body at all. With auto_error on, FastAPI answers a
    missing header with 403 "Not authenticated" before any of this runs — the
    wrong code, and a sentence written for whoever is holding the curl command
    rather than for a reader who has just typed a paragraph.

    Verification is checked even though signing in already implies it —
    AuthService.login refuses an account still in PENDING_VERIFICATION. This is
    for the case that is not ordinary: an address reset to unverified by an
    admin, on a session whose access token is still within its hour.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to post a comment.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Raises its own 401 for a token that is expired, revoked or forged.
    current_user = get_current_user_dependency(credentials=credentials, db=db)

    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirm your email address before posting a comment.",
        )

    return current_user


def get_optional_admin(
    credentials: HTTPAuthorizationCredentials = Depends(optional_security),
    db: Session = Depends(get_db),
):
    """Resolve an admin caller if there is one, otherwise None.

    Used by the public content routes to decide whether drafts are visible. A
    missing *or bad* token means anonymous here, not 401 — these routes are
    public, and an expired token should still render the published portfolio
    rather than break the page.
    """
    if credentials is None:
        return None

    try:
        user = get_current_user_dependency(credentials=credentials, db=db)
    except HTTPException:
        return None

    return user if user.is_admin else None


def require_admin(current_user = Depends(get_current_user_dependency)):
    """Dependency to require admin role"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorMessages.FORBIDDEN
        )
    return current_user

def require_role(role_name: str):
    """Dependency factory to require specific role"""
    def _require_role(current_user = Depends(get_current_user_dependency)):
        if not current_user.has_role(role_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role_name}' required"
            )
        return current_user
    return _require_role

def require_permission(permission_name: str):
    """Dependency factory to require specific permission"""
    def _require_permission(current_user = Depends(get_current_user_dependency)):
        if not current_user.has_permission(permission_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_name}' required"
            )
        return current_user
    return _require_permission

def verify_token_dependency(token: str, token_type: TokenType, db: Session = Depends(get_db)):
    """Dependency to verify specific token type"""
    user_service = UserService(db)
    token_obj = user_service.get_valid_token(token, token_type)
    if not token_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )
    return token_obj 