from fastapi import APIRouter, Body, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user_dependency
from app.core.database import get_db
from app.core.rate_limit import limiter
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
#
# Three routes below are rate limited per IP. They are the unauthenticated ones
# that cost something to call: /login guesses a password, and the two email
# routes make the server send mail. The rest are either authenticated, or take a
# token that has to be valid before any work happens.
#
# Every limited handler needs both `request` and `response` parameters. slowapi
# finds the caller's address by looking for a parameter literally named
# `request`, and because the limiter is built with headers_enabled=True it
# writes the X-RateLimit-* headers into `response` whenever the handler returns
# something that is not already a Response — which these all do. Omit either and
# it raises on the success path, not just on the 429. Same shape as
# contacts.create_contact.

# Ten attempts per quarter hour. The account this protects is a single admin
# with a 12-character minimum password, so the ceiling is about making an online
# guessing attack pointless rather than about surviving a real one — and it has
# to stay clear of a person mistyping their own password a few times.
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/15minutes")
def login(
    request: Request,
    response: Response,
    user_credentials: UserLogin,
    db: Session = Depends(get_db),
):
    """Login with email and password. Rate limited per IP."""
    auth_service = AuthService(db)
    return auth_service.login(user_credentials)

# Deliberately not rate limited. The web console calls this on its own schedule
# whenever an access token ages out, so a cap here would sign the admin out
# rather than stop anyone: the token is single-use and rotated, and a caller
# without a valid one gets a 401 before any work is done.
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

# The body parameter is `payload`, not `request`: slowapi claims that name for
# the starlette Request it needs to read the caller's address from.
@router.post("/password-reset-request")
@limiter.limit("5/hour")
def request_password_reset(
    request: Request,
    response: Response,
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """Request password reset. Rate limited per IP — this one sends mail."""
    auth_service = AuthService(db)
    auth_service.request_password_reset(payload)
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
@limiter.limit("5/hour")
def resend_verification_email(
    request: Request,
    response: Response,
    payload: EmailVerificationRequest,
    db: Session = Depends(get_db),
):
    """Resend email verification. Rate limited per IP — this one sends mail."""
    auth_service = AuthService(db)
    auth_service.resend_verification_email(payload.email)
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
