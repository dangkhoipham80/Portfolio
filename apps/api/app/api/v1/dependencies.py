
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


# The previous get_optional_user() took `Depends(security)` from the shared
# HTTPBearer(), which defaults to auto_error=True and so raises 403 before the
# body runs — its `if not credentials: return None` branch was unreachable, and
# attaching it to a public route would have rejected every anonymous caller. It
# was deleted. What follows is the working shape: its own HTTPBearer with
# auto_error off, so a missing header reaches the body as None.
optional_security = HTTPBearer(auto_error=False)


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