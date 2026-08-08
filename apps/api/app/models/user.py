from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import enum

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
    hashed_password = Column(String(255), nullable=True)  # Null for OAuth users
    avatar_url = Column(String(500), nullable=True)

    # OAuth fields
    google_id = Column(String(255), unique=True, index=True, nullable=True)
    google_email = Column(String(255), nullable=True)

    # Status and verification
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    status = Column(Enum(UserStatus), default=UserStatus.PENDING_VERIFICATION)
    email_verified_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_at = Column(DateTime, nullable=True)

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