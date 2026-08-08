from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.user import User, UserStatus
from app.models.token import Token, TokenType
from app.models.role import Role, Permission, UserRole, RolePermission
from app.schemas.user import UserCreate, UserUpdate, UserPasswordUpdate, RoleCreate, PermissionCreate
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.constants import ErrorMessages
from app.core.exceptions import NotFoundError, ConflictError, ValidationError
import json

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
        
        # Hash password if provided
        hashed_password = None
        if user_data.password:
            hashed_password = get_password_hash(user_data.password)
        
        # Create user
        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            avatar_url=user_data.avatar_url,
            google_id=user_data.google_id,
            google_email=user_data.google_email,
            status=UserStatus.ACTIVE if user_data.google_id else UserStatus.PENDING_VERIFICATION
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

    def get_user_by_google_id(self, google_id: str) -> Optional[User]:
        """Get user by Google ID"""
        return self.db.query(User).filter(User.google_id == google_id).first()

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
        for field, value in user_data.dict(exclude_unset=True).items():
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

    def authenticate_google_user(self, google_user_info: Dict[str, Any]) -> User:
        """Authenticate or create user with Google OAuth"""
        # Check if user exists by Google ID
        user = self.get_user_by_google_id(google_user_info["id"])
        
        if not user:
            # Check if user exists by email
            user = self.get_user_by_email(google_user_info["email"])
            if user:
                # Link existing user with Google account
                user.google_id = google_user_info["id"]
                user.google_email = google_user_info["email"]
                user.is_verified = True
                user.status = UserStatus.ACTIVE
            else:
                # Create new user
                user_data = UserCreate(
                    email=google_user_info["email"],
                    full_name=google_user_info["name"],
                    avatar_url=google_user_info.get("picture"),
                    google_id=google_user_info["id"],
                    google_email=google_user_info["email"]
                )
                user = self.create_user(user_data)

        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        self.db.commit()

        return user

    # Token management
    def create_token(self, user_id: int, token_type: TokenType, expires_in_minutes: int = 30, metadata: Dict[str, Any] = None) -> str:
        """Create a new token"""
        from app.core.security import create_access_token

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
        token_data = {"sub": str(user_id), "type": token_type.value}

        if metadata:
            token_data.update(metadata)

        token_string = create_access_token(token_data, timedelta(minutes=expires_in_minutes))

        # Store token in database
        token = Token(
            user_id=user_id,
            token_type=token_type,
            token_hash=token_string,  # In production, hash this
            expires_at=expires_at,
            token_metadata=json.dumps(metadata) if metadata else None
        )

        self.db.add(token)
        self.db.commit()

        return token_string

    def revoke_token(self, token_hash: str) -> bool:
        """Revoke a token"""
        token = self.db.query(Token).filter(Token.token_hash == token_hash).first()
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

    def get_valid_token(self, token_hash: str, token_type: TokenType) -> Optional[Token]:
        """Get a valid token"""
        token = self.db.query(Token).filter(
            and_(
                Token.token_hash == token_hash,
                Token.token_type == token_type,
                Token.is_revoked == False,
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
        
        role = Role(**role_data.dict())
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
        
        permission = Permission(**permission_data.dict())
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