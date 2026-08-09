from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user_dependency
from app.core.database import get_db
from app.schemas.user import (
    EmailVerificationRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenResponse,
    UserLogin,
)
from app.services.auth_service import AuthService

router = APIRouter()

# There is deliberately no POST /register and no POST /google here.
#
# This API backs a single-owner portfolio: the only account is the admin, and it
# is created by the seed script. Public registration was pure attack surface —
# anyone could create accounts and make the server send verification mail on
# demand. Google OAuth verified ID tokens by calling Google's userinfo endpoint
# from an unauthenticated route, which is more surface and more dependencies
# than one admin login justifies.

@router.post("/login", response_model=TokenResponse)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Login with email and password"""
    auth_service = AuthService(db)
    return auth_service.login(user_credentials)

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(refresh_token: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """Refresh access token"""
    auth_service = AuthService(db)
    return auth_service.refresh_token(refresh_token)

@router.post("/logout")
def logout(
    access_token: str = Body(..., embed=True),
    refresh_token: str = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """Logout user"""
    auth_service = AuthService(db)
    auth_service.logout(access_token, refresh_token)
    return {"message": "Logged out successfully"}

@router.post("/password-reset-request")
def request_password_reset(request: PasswordResetRequest, db: Session = Depends(get_db)):
    """Request password reset"""
    auth_service = AuthService(db)
    auth_service.request_password_reset(request)
    return {"message": "Password reset email sent"}

@router.post("/password-reset-confirm")
def confirm_password_reset(request: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Confirm password reset"""
    auth_service = AuthService(db)
    auth_service.reset_password(request)
    return {"message": "Password reset successfully"}

@router.post("/verify-email")
def verify_email(token: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """Verify email address"""
    auth_service = AuthService(db)
    auth_service.verify_email(token)
    return {"message": "Email verified successfully"}

@router.post("/resend-verification")
def resend_verification_email(request: EmailVerificationRequest, db: Session = Depends(get_db)):
    """Resend email verification"""
    auth_service = AuthService(db)
    auth_service.resend_verification_email(request.email)
    return {"message": "Verification email sent"}

@router.get("/me", response_model=dict)
def get_current_user_info(current_user = Depends(get_current_user_dependency)):
    """Get current user information"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "is_active": current_user.is_active,
        "is_verified": current_user.is_verified,
        "status": current_user.status.value,
        "roles": current_user.roles,
        "created_at": current_user.created_at,
        "last_login_at": current_user.last_login_at
    }
