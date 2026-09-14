import enum

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class UserStatus(enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    full_name = Column(String(255), nullable=True)
    # Nullable because the column outlived the Google OAuth sign-in it was made
    # nullable for. Every account now has a password; the paths that read this
    # still check for null rather than assume, because a null here must refuse
    # the operation and not raise.
    hashed_password = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)

    # Status and verification
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    status = Column(Enum(UserStatus), default=UserStatus.PENDING_VERIFICATION)
    email_verified_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_at = Column(DateTime, nullable=True)

    # How many days running this account has signed in, and the UTC day the
    # streak was last extended.
    #
    # A Date and not a timestamp, because the question a streak asks is "was
    # yesterday a day you signed in", and a timestamp cannot answer it without
    # re-deriving the day on every read — which is where two callers start
    # disagreeing about where the day boundary is. UTC, like every other instant
    # this application stores; see UserService.record_login for the arithmetic
    # and for why the boundary is stated rather than inferred.
    #
    # `last_login_at` above is not enough on its own: it is overwritten by every
    # login, so the moment a second login lands on the same day the previous
    # day is gone and the streak cannot be continued or broken.
    login_streak = Column(Integer, nullable=False, default=0, server_default="0")
    last_login_day = Column(Date, nullable=True)

    # Relationships
    tokens = relationship("Token", back_populates="user", cascade="all, delete-orphan")
    user_roles = relationship("UserRole", back_populates="user", foreign_keys="UserRole.user_id", cascade="all, delete-orphan")

    @property
    def roles(self):
        """Get list of role names for the user"""
        return [user_role.role.name for user_role in self.user_roles]

    @property
    def is_admin(self):
        """Check if user has admin role"""
        return "admin" in self.roles

    def has_role(self, role_name: str) -> bool:
        """Check if user has specific role"""
        return role_name in self.roles

    def has_permission(self, permission_name: str) -> bool:
        """Check if user has specific permission through roles"""
        for user_role in self.user_roles:
            if user_role.role.has_permission(permission_name):
                return True
        return False