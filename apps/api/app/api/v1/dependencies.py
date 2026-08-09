from typing import Optional

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


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    """Dependency to get optional authenticated user (for public endpoints)"""
    if not credentials:
        return None
    
    try:
        user_id = get_current_user(credentials.credentials)
        user_service = UserService(db)
        user = user_service.get_user_by_id(int(user_id))
        return user if user and user.is_active else None
    except Exception:
        return None

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