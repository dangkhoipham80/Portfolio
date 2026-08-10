from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, validator

from app.core.constants import MIN_PASSWORD_LENGTH
from app.models.token import TokenType
from app.models.user import UserStatus


# Base schemas
class UserBase(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None
    resource: str
    action: str

# Create schemas
class UserCreate(UserBase):
    password: Optional[str] = None  # Optional for OAuth users
    google_id: Optional[str] = None
    google_email: Optional[EmailStr] = None

    @validator('password')
    def validate_password(cls, v, values):
        if not v and not values.get('google_id'):
            raise ValueError('Password is required for non-OAuth users')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    # No min_length here, deliberately, and it should stay that way.
    #
    # Every other password field on this API enforces MIN_PASSWORD_LENGTH. This
    # one is a guess at an existing secret, not a new one. Constraining it would
    # answer a short guess with a 422 while a long guess gets a 401, which tells
    # an attacker where the length floor is and marks their wrong guesses as
    # differently-wrong. It would also lock out any account whose password
    # predates the rule, by refusing the login rather than the password.
    #
    # Every login failure returns the same 401.
    password: str

class GoogleLogin(BaseModel):
    google_token: str

class RoleCreate(RoleBase):
    pass

class PermissionCreate(PermissionBase):
    pass

# Update schemas
class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[UserStatus] = None

class UserPasswordUpdate(BaseModel):
    # The old password is a guess, so it is unconstrained for the same reason
    # UserLogin.password is. The new one has to clear the floor.
    current_password: str
    new_password: str = Field(..., min_length=MIN_PASSWORD_LENGTH)

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

# Response schemas
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: int
    email: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    status: UserStatus
    roles: List[str] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserDetailResponse(UserResponse):
    email_verified_at: Optional[datetime] = None
    google_id: Optional[str] = None
    google_email: Optional[EmailStr] = None

class RoleResponse(RoleBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserRoleResponse(BaseModel):
    id: int
    user_id: int
    role_id: int
    assigned_at: datetime
    assigned_by: Optional[int] = None
    role: RoleResponse

    class Config:
        from_attributes = True

class TokenInfo(BaseModel):
    id: int
    token_type: TokenType
    expires_at: datetime
    is_revoked: bool
    created_at: datetime

    class Config:
        from_attributes = True

# List response schemas
class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    size: int

class RoleListResponse(BaseModel):
    roles: List[RoleResponse]
    total: int
    page: int
    size: int

class PermissionListResponse(BaseModel):
    permissions: List[PermissionResponse]
    total: int
    page: int
    size: int

# OAuth schemas
class GoogleUserInfo(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    verified_email: bool = False

# Password reset schemas
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=MIN_PASSWORD_LENGTH)

# Email verification schemas
class EmailVerificationRequest(BaseModel):
    email: EmailStr

class EmailVerificationConfirm(BaseModel):
    token: str 