import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.role import Permission, Role, RolePermission, UserRole
from app.models.token import Token, TokenType
from app.models.user import User, UserStatus
from app.schemas.user import (
    PermissionCreate,
    RoleCreate,
    UserCreate,
    UserPasswordUpdate,
    UserUpdate,
)


class UserService:
    def __init__(self, db: Session):
        self.db = db

    # User CRUD operations
    def create_user(self, user_data: UserCreate) -> User:
        """Create a new user"""
        # Check if user already exists
        existing_user = self.get_user_by_email(user_data.email)
        if existing_user:
            raise ConflictError("User with this email already exists")
        
        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=get_password_hash(user_data.password),
            avatar_url=user_data.avatar_url,
            status=UserStatus.PENDING_VERIFICATION,
        )


        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        # Assign default role
        self.assign_default_role(user.id)
        
        return user

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()

    def get_users(self, skip: int = 0, limit: int = 100, filters: Dict[str, Any] = None) -> List[User]:
        """Get users with pagination and filters"""
        query = self.db.query(User)
        
        if filters:
            if filters.get("is_active") is not None:
                query = query.filter(User.is_active == filters["is_active"])
            if filters.get("status"):
                query = query.filter(User.status == filters["status"])
            if filters.get("search"):
                search_term = f"%{filters['search']}%"
                query = query.filter(
                    or_(
                        User.email.ilike(search_term),
                        User.full_name.ilike(search_term),
                        User.username.ilike(search_term)
                    )
                )
        
        return query.offset(skip).limit(limit).all()

    def update_user(self, user_id: int, user_data: UserUpdate) -> Optional[User]:
        """Update user"""
        user = self.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("User not found")
        
        # Update fields
        for field, value in user_data.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        
        user.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_password(self, user_id: int, password_data: UserPasswordUpdate) -> bool:
        """Update user password"""
        user = self.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("User not found")
        
        if not user.hashed_password:
            raise ValidationError("User does not have a password set")
        
        # Verify current password
        if not verify_password(password_data.current_password, user.hashed_password):
            raise ValidationError("Current password is incorrect")
        
        # Update password
        user.hashed_password = get_password_hash(password_data.new_password)
        user.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    def delete_user(self, user_id: int) -> bool:
        """Delete user"""
        user = self.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("User not found")
        
        self.db.delete(user)
        self.db.commit()
        return True

    # Authentication methods
    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        user = self.get_user_by_email(email)
        if not user or not user.hashed_password:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        if not user.is_active:
            return None
        
        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        self.db.commit()
        
        return user

    # authenticate_google_user() was removed with the rest of the Google OAuth
    # scaffolding. The POST /auth/google endpoint that called it had already
    # gone; this method, get_user_by_google_id(), the two schemas and the two
    # columns stayed behind and were reachable from nothing. Unreachable code
    # that mints sessions is the kind that gets wired back up by accident.

    # Token management
    @staticmethod
    def hash_token(token_string: str) -> str:
        """Digest a token for storage.

        The column is named token_hash but used to hold the raw JWT, with a
        "# In production, hash this" note next to it. That meant read access to
        the database handed over every live access, refresh and reset token in
        directly usable form. A digest is enough: lookups are exact-match, so
        there is nothing to compare fuzzily and no need to be reversible.
        """
        return hashlib.sha256(token_string.encode("utf-8")).hexdigest()

    def create_token(self, user_id: int, token_type: TokenType, expires_in_minutes: int = 30, metadata: Dict[str, Any] = None) -> str:
        """Create a new token"""

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)

        # `jti` makes the JWT unique. Without it the payload is just sub/type/exp/iat,
        # and exp/iat have one-second resolution — so two logins inside the same
        # second produced byte-identical tokens and therefore two rows with the same
        # hash. revoke_token() updates .first() of those, so logout would flip one row
        # while get_valid_token() went on matching the other: the token stayed live.
        token_data = {
            "sub": str(user_id),
            "type": token_type.value,
            "jti": secrets.token_urlsafe(16),
        }

        if metadata:
            token_data.update(metadata)

        token_string = create_access_token(token_data, timedelta(minutes=expires_in_minutes))

        token = Token(
            user_id=user_id,
            token_type=token_type,
            token_hash=self.hash_token(token_string),
            expires_at=expires_at,
            token_metadata=json.dumps(metadata) if metadata else None
        )

        self.db.add(token)
        self.db.commit()

        return token_string

    def revoke_token(self, token_string: str) -> bool:
        """Revoke a token, given the token itself."""
        token = self.db.query(Token).filter(
            Token.token_hash == self.hash_token(token_string)
        ).first()
        if not token:
            return False

        token.is_revoked = True
        self.db.commit()
        return True

    def revoke_all_user_tokens(self, user_id: int, token_type: TokenType = None) -> bool:
        """Revoke all tokens for a user"""
        query = self.db.query(Token).filter(Token.user_id == user_id)
        if token_type:
            query = query.filter(Token.token_type == token_type)
        
        tokens = query.all()
        for token in tokens:
            token.is_revoked = True
        
        self.db.commit()
        return True

    def get_valid_token(self, token_string: str, token_type: TokenType) -> Optional[Token]:
        """Look up a token by its value; None if unknown, revoked or expired."""
        token = self.db.query(Token).filter(
            and_(
                Token.token_hash == self.hash_token(token_string),
                Token.token_type == token_type,
                Token.is_revoked.is_(False),
                Token.expires_at > datetime.now(timezone.utc)
            )
        ).first()
        
        return token

    # Role management
    def create_role(self, role_data: RoleCreate) -> Role:
        """Create a new role"""
        existing_role = self.db.query(Role).filter(Role.name == role_data.name).first()
        if existing_role:
            raise ConflictError("Role with this name already exists")
        
        role = Role(**role_data.model_dump())
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def get_role_by_name(self, name: str) -> Optional[Role]:
        """Get role by name"""
        return self.db.query(Role).filter(Role.name == name).first()

    def assign_role_to_user(self, user_id: int, role_name: str, assigned_by: int = None) -> UserRole:
        """Assign role to user"""
        user = self.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("User not found")
        
        role = self.get_role_by_name(role_name)
        if not role:
            raise NotFoundError("Role not found")
        
        # Check if user already has this role
        existing_user_role = self.db.query(UserRole).filter(
            and_(UserRole.user_id == user_id, UserRole.role_id == role.id)
        ).first()
        
        if existing_user_role:
            raise ConflictError("User already has this role")
        
        user_role = UserRole(
            user_id=user_id,
            role_id=role.id,
            assigned_by=assigned_by
        )
        
        self.db.add(user_role)
        self.db.commit()
        self.db.refresh(user_role)
        return user_role

    def remove_role_from_user(self, user_id: int, role_name: str) -> bool:
        """Remove role from user"""
        role = self.get_role_by_name(role_name)
        if not role:
            raise NotFoundError("Role not found")
        
        user_role = self.db.query(UserRole).filter(
            and_(UserRole.user_id == user_id, UserRole.role_id == role.id)
        ).first()
        
        if not user_role:
            raise NotFoundError("User does not have this role")
        
        self.db.delete(user_role)
        self.db.commit()
        return True

    def assign_default_role(self, user_id: int) -> UserRole:
        """Assign default role to new user"""
        default_role = self.get_role_by_name("user")
        if not default_role:
            # Create default role if it doesn't exist
            default_role = self.create_role(RoleCreate(name="user", description="Default user role"))
        
        return self.assign_role_to_user(user_id, "user")

    # Permission management
    def create_permission(self, permission_data: PermissionCreate) -> Permission:
        """Create a new permission"""
        existing_permission = self.db.query(Permission).filter(Permission.name == permission_data.name).first()
        if existing_permission:
            raise ConflictError("Permission with this name already exists")
        
        permission = Permission(**permission_data.model_dump())
        self.db.add(permission)
        self.db.commit()
        self.db.refresh(permission)
        return permission

    def assign_permission_to_role(self, role_name: str, permission_name: str) -> bool:
        """Assign permission to role"""
        role = self.get_role_by_name(role_name)
        if not role:
            raise NotFoundError("Role not found")
        
        permission = self.db.query(Permission).filter(Permission.name == permission_name).first()
        if not permission:
            raise NotFoundError("Permission not found")
        
        # Check if role already has this permission
        existing_role_permission = self.db.query(RolePermission).filter(
            and_(RolePermission.role_id == role.id, RolePermission.permission_id == permission.id)
        ).first()
        
        if existing_role_permission:
            raise ConflictError("Role already has this permission")
        
        role_permission = RolePermission(role_id=role.id, permission_id=permission.id)
        self.db.add(role_permission)
        self.db.commit()
        return True 