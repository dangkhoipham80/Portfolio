import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import UnauthorizedError, ValidationError
from app.core.security import get_password_hash, verify_token
from app.models.token import TokenType
from app.models.user import UserStatus
from app.schemas.user import PasswordResetConfirm, PasswordResetRequest, TokenResponse, UserLogin
from app.services.email_service import send_email
from app.services.user_service import UserService

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_service = UserService(db)

    def login(self, credentials: UserLogin) -> TokenResponse:
        """Login with email and password"""
        user = self.user_service.authenticate_user(credentials.email, credentials.password)
        if not user:
            raise UnauthorizedError("Invalid email or password")

        if not user.is_active:
            raise UnauthorizedError("User account is deactivated")

        if user.status == UserStatus.PENDING_VERIFICATION:
            raise UnauthorizedError("Please verify your email before logging in")

        return self._create_token_pair(user)

    # google_login() and register() were removed along with their endpoints —
    # see the note in app/api/v1/endpoints/auth.py. The admin account comes from
    # the seed script, so nothing needs a public signup path.

    def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Exchange a refresh token for a new token pair."""
        token_data = verify_token(refresh_token, expected_type=TokenType.REFRESH.value)
        if not token_data:
            raise UnauthorizedError("Invalid refresh token")

        # The signature alone is not enough: logout() and reset_password() revoke
        # the row, not the JWT. Checking only the signature here left the other
        # half of the logout hole open — a stolen refresh token kept minting
        # fresh access tokens for its full 30 days after the user logged out.
        if not self.user_service.get_valid_token(refresh_token, TokenType.REFRESH):
            raise UnauthorizedError("Invalid refresh token")

        user_id = int(token_data["sub"])
        user = self.user_service.get_user_by_id(user_id)
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or inactive")

        # Revoke old refresh token
        self.user_service.revoke_token(refresh_token)

        return self._create_token_pair(user)

    def logout(self, access_token: str, refresh_token: str = None) -> bool:
        """Logout user by revoking tokens"""
        # Revoke access token
        self.user_service.revoke_token(access_token)

        # Revoke refresh token if provided
        if refresh_token:
            self.user_service.revoke_token(refresh_token)

        return True

    def request_password_reset(self, request: PasswordResetRequest) -> None:
        """Request password reset"""
        user = self.user_service.get_user_by_email(request.email)
        if not user:
            # Don't reveal if user exists - security best practice
            return

        if not user.hashed_password:
            raise ValidationError("This account uses OAuth login")
        
        # Create password reset token
        reset_token = self.user_service.create_token(
            user.id,
            TokenType.RESET_PASSWORD,
            expires_in_minutes=60,  # 1 hour
            metadata={"purpose": "password_reset"}
        )
        
        # Send password reset email
        self._send_password_reset_email(user, reset_token)

    def reset_password(self, request: PasswordResetConfirm) -> bool:
        """Reset password using token"""
        # Verify reset token
        token = self.user_service.get_valid_token(request.token, TokenType.RESET_PASSWORD)
        if not token:
            raise ValidationError("Invalid or expired reset token")

        payload = verify_token(request.token, expected_type=TokenType.RESET_PASSWORD.value)
        if not payload:
            raise ValidationError("Invalid or expired reset token")

        user_id = int(payload["sub"])
        user = self.user_service.get_user_by_id(user_id)
        if not user:
            raise ValidationError("User not found")
        
        # Update password
        user.hashed_password = get_password_hash(request.new_password)
        user.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        
        # Revoke all user tokens
        self.user_service.revoke_all_user_tokens(user.id)
        
        return True

    def verify_email(self, token: str) -> bool:
        """Verify email using verification token"""
        # Verify email verification token
        token_obj = self.user_service.get_valid_token(token, TokenType.EMAIL_VERIFICATION)
        if not token_obj:
            raise ValidationError("Invalid or expired verification token")

        payload = verify_token(token, expected_type=TokenType.EMAIL_VERIFICATION.value)
        if not payload:
            raise ValidationError("Invalid or expired verification token")

        user_id = int(payload["sub"])
        user = self.user_service.get_user_by_id(user_id)
        if not user:
            raise ValidationError("User not found")
        
        # Mark email as verified
        user.is_verified = True
        user.status = UserStatus.ACTIVE
        user.email_verified_at = datetime.now(timezone.utc)
        self.db.commit()
        
        # Revoke verification token
        self.user_service.revoke_token(token)
        
        return True

    def resend_verification_email(self, email: str) -> bool:
        """Resend email verification.

        Returns quietly for unknown or already-verified addresses. It used to
        raise "User not found", which let anyone enumerate registered emails —
        request_password_reset() one method up already got this right.
        """
        user = self.user_service.get_user_by_email(email)
        if not user or user.is_verified:
            return True

        # Create new verification token
        verification_token = self.user_service.create_token(
            user.id,
            TokenType.EMAIL_VERIFICATION,
            expires_in_minutes=60,  # 1 hour
            metadata={"purpose": "email_verification"}
        )

        # Send verification email
        self._send_verification_email(user, verification_token)

        return True

    def _create_token_pair(self, user) -> TokenResponse:
        """Create access and refresh token pair.

        Lifetimes come from settings rather than being hardcoded here — they
        used to say 30 minutes and 7 days while the config said something else
        entirely, so the documented values were never the ones in effect.
        """
        access_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        refresh_minutes = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60

        access_token = self.user_service.create_token(
            user.id,
            TokenType.ACCESS,
            expires_in_minutes=access_minutes
        )

        refresh_token = self.user_service.create_token(
            user.id,
            TokenType.REFRESH,
            expires_in_minutes=refresh_minutes
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=access_minutes * 60,
            user_id=user.id,
            email=user.email
        )

    def _send_verification_email(self, user, token: str = None) -> None:
        """Send email verification"""
        if not token:
            token = self.user_service.create_token(
                user.id,
                TokenType.EMAIL_VERIFICATION,
                expires_in_minutes=60,
                metadata={"purpose": "email_verification"}
            )
        
        subject = "Verify Your Email Address"
        body = f"""
        Hello {user.full_name or user.username or user.email},
        
        Please verify your email address by clicking the link below:
        
        {settings.BACKEND_CORS_ORIGINS[0] if settings.BACKEND_CORS_ORIGINS else 'http://localhost:3000'}/verify-email?token={token}
        
        This link will expire in 1 hour.
        
        If you didn't create an account, please ignore this email.
        
        Best regards,
        {settings.PROJECT_NAME} Team
        """
        
        self._send_email(user.email, subject, body)

    def _send_password_reset_email(self, user, token: str) -> None:
        """Send password reset email"""
        subject = "Reset Your Password"
        body = f"""
        Hello {user.full_name or user.username or user.email},

        You requested to reset your password. Click the link below to set a new password:

        {settings.BACKEND_CORS_ORIGINS[0] if settings.BACKEND_CORS_ORIGINS else 'http://localhost:3000'}/reset-password?token={token}

        This link will expire in 1 hour.

        If you didn't request a password reset, please ignore this email.

        Best regards,
        {settings.PROJECT_NAME} Team
        """

        self._send_email(user.email, subject, body)

    def _send_email(self, to_email: str, subject: str, body: str) -> None:
        """Send mail, best-effort.

        The transport moved to ``email_service.send_email``, which raises; these
        flows keep swallowing, as they did before, so that a password-reset
        request does not 500 on a mail outage. What changed is that the failure
        now reaches the logger instead of stdout, where nothing was collecting it.
        """
        try:
            send_email(to_email, subject, body)
        except Exception:
            logger.exception("Failed to send email to %s", to_email)
