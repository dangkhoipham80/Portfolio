from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, verify_token
from app.core.constants import ErrorMessages
from app.services.user_service import UserService
from app.models.token import TokenType

# Security scheme
security = HTTPBearer()

def get_current_user_dependency(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Dependency to get current authenticated user"""
    try:
        user_id = get_current_user(credentials.credentials)
        user_service = UserService(db)
        user = user_service.get_user_by_id(int(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ErrorMessages.UNAUTHORIZED
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is deactivated"
            )
        
        return user
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorMessages.UNAUTHORIZED
        )

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
    except:
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