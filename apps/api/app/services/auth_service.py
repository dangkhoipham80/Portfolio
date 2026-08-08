from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.token import TokenType
from app.models.user import UserStatus
from app.schemas.user import UserCreate, UserLogin, GoogleLogin, TokenResponse, PasswordResetRequest, PasswordResetConfirm
from app.services.user_service import UserService
from app.core.security import create_access_token, verify_token
from app.core.constants import ErrorMessages
from app.core.exceptions import UnauthorizedError, ValidationError
from app.core.config import settings
import httpx
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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

    def google_login(self, google_data: GoogleLogin) -> TokenResponse:
        """Login with Google OAuth"""
        try:
            # Verify Google token and get user info
            google_user_info = self._verify_google_token(google_data.google_token)

            # Authenticate or create user
            user = self.user_service.authenticate_google_user(google_user_info)

            return self._create_token_pair(user)

        except Exception as e:
            raise UnauthorizedError(f"Google authentication failed: {str(e)}")

    def register(self, user_data: UserCreate) -> Dict[str, Any]:
        """Register new user"""
        user = self.user_service.create_user(user_data)

        # Send email verification if not OAuth user
        if not user.google_id:
            self._send_verification_email(user)

        return {
            "message": "User registered successfully",
            "user_id": user.id,
            "email_verification_required": not user.google_id
        }

    def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Refresh access token using refresh token"""
        # Verify refresh token
        token_data = verify_token(refresh_token)
        if not token_data or token_data.get("type") != TokenType.REFRESH.value:
            raise UnauthorizedError("Invalid refresh token")

        user_id = int(token_data.get("sub"))
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
        
        user_id = int(verify_token(request.token).get("sub"))
        user = self.user_service.get_user_by_id(user_id)
        if not user:
            raise ValidationError("User not found")
        
        # Update password
        user.hashed_password = self.user_service.get_password_hash(request.new_password)
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
        
        user_id = int(verify_token(token).get("sub"))
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
        """Resend email verification"""
        user = self.user_service.get_user_by_email(email)
        if not user:
            raise ValidationError("User not found")

        if user.is_verified:
            raise ValidationError("Email is already verified")

        if user.google_id:
            raise ValidationError("OAuth users don't need email verification")

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
        """Create access and refresh token pair"""
        # Create access token (30 minutes)
        access_token = self.user_service.create_token(
            user.id,
            TokenType.ACCESS,
            expires_in_minutes=30
        )

        # Create refresh token (7 days)
        refresh_token = self.user_service.create_token(
            user.id,
            TokenType.REFRESH,
            expires_in_minutes=10080  # 7 days
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=30 * 60,  # 30 minutes in seconds
            user_id=user.id,
            email=user.email
        )

    def _verify_google_token(self, google_token: str) -> Dict[str, Any]:
        """Verify Google ID token and return user info"""
        try:
            # In production, use Google's official library
            # For now, we'll make a request to Google's userinfo endpoint
            headers = {"Authorization": f"Bearer {google_token}"}
            with httpx.Client() as client:
                response = client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers=headers
                )

            if response.status_code != 200:
                raise ValidationError("Failed to verify Google token")

            user_info = response.json()

            # Validate required fields
            if not user_info.get("id") or not user_info.get("email"):
                raise ValidationError("Invalid user info from Google")

            return {
                "id": user_info["id"],
                "email": user_info["email"],
                "name": user_info.get("name", ""),
                "picture": user_info.get("picture"),
                "verified_email": user_info.get("verified_email", False)
            }

        except ValidationError:
            raise
        except Exception as e:
            raise ValidationError(f"Google token verification failed: {str(e)}")

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
        """Send email using SMTP"""
        try:
            msg = MIMEMultipart()
            msg['From'] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
            msg['To'] = to_email
            msg['Subject'] = subject

            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            if settings.SMTP_TLS:
                server.starttls()

            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()

        except Exception as e:
            # Log error but don't fail the request
            print(f"Failed to send email to {to_email}: {str(e)}")

    def get_password_hash(self, password: str) -> str:
        """Get password hash"""
        from app.core.security import get_password_hash
        return get_password_hash(password)