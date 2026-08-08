from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.constants import ErrorMessages
from app.schemas.user import (
    UserCreate, UserUpdate, UserPasswordUpdate, UserResponse, UserDetailResponse,
    UserListResponse, RoleCreate, RoleUpdate, RoleResponse, RoleListResponse,
    PermissionCreate, PermissionResponse, PermissionListResponse
)
from app.services.user_service import UserService
from app.api.v1.dependencies import (
    get_current_user_dependency, require_admin, require_role, require_permission
)
from app.models.role import Role, Permission

router = APIRouter()

# User management endpoints
@router.get("/", response_model=UserListResponse)
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user = Depends(require_admin)
):
    """Get all users (admin only)"""
    user_service = UserService(get_db())
    
    filters = {}
    if search:
        filters["search"] = search
    if is_active is not None:
        filters["is_active"] = is_active
    
    users = user_service.get_users(skip=skip, limit=limit, filters=filters)
    total = len(users)  # In production, use count query
    
    return UserListResponse(
        users=[UserResponse.from_orm(user) for user in users],
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@router.get("/{user_id}", response_model=UserDetailResponse)
def get_user(
    user_id: int,
    current_user = Depends(get_current_user_dependency)
):
    """Get user by ID (own profile or admin)"""
    user_service = UserService(get_db())
    
    # Users can only view their own profile unless they're admin
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view own profile"
        )
    
    user = user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.USER_NOT_FOUND
        )
    
    return UserDetailResponse.from_orm(user)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user = Depends(get_current_user_dependency)
):
    """Update user (own profile or admin)"""
    user_service = UserService(get_db())
    
    # Users can only update their own profile unless they're admin
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update own profile"
        )
    
    user = user_service.update_user(user_id, user_data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.USER_NOT_FOUND
        )
    
    return UserResponse.from_orm(user)

@router.put("/{user_id}/password")
def update_password(
    user_id: int,
    password_data: UserPasswordUpdate,
    current_user = Depends(get_current_user_dependency)
):
    """Update user password (own profile only)"""
    user_service = UserService(get_db())
    
    # Users can only update their own password
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update own password"
        )
    
    success = user_service.update_password(user_id, password_data)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.USER_NOT_FOUND
        )
    
    return {"message": "Password updated successfully"}

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user = Depends(require_admin)
):
    """Delete user (admin only)"""
    user_service = UserService(get_db())
    
    # Prevent admin from deleting themselves
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete own account"
        )
    
    success = user_service.delete_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.USER_NOT_FOUND
        )
    
    return {"message": "User deleted successfully"}

# Role management endpoints
@router.get("/roles/", response_model=RoleListResponse)
def get_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user = Depends(require_admin)
):
    """Get all roles (admin only)"""
    user_service = UserService(get_db())
    
    # In production, implement pagination properly
    roles = user_service.db.query(Role).offset(skip).limit(limit).all()
    total = len(roles)
    
    return RoleListResponse(
        roles=[RoleResponse.from_orm(role) for role in roles],
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@router.post("/roles/", response_model=RoleResponse)
def create_role(
    role_data: RoleCreate,
    current_user = Depends(require_admin)
):
    """Create new role (admin only)"""
    user_service = UserService(get_db())
    
    role = user_service.create_role(role_data)
    return RoleResponse.from_orm(role)

@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    current_user = Depends(require_admin)
):
    """Update role (admin only)"""
    user_service = UserService(get_db())
    
    role = user_service.db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    for field, value in role_data.dict(exclude_unset=True).items():
        setattr(role, field, value)
    
    user_service.db.commit()
    user_service.db.refresh(role)
    
    return RoleResponse.from_orm(role)

# User role assignment endpoints
@router.post("/{user_id}/roles/{role_name}")
def assign_role_to_user(
    user_id: int,
    role_name: str,
    current_user = Depends(require_admin)
):
    """Assign role to user (admin only)"""
    user_service = UserService(get_db())
    
    user_role = user_service.assign_role_to_user(user_id, role_name, current_user.id)
    return {"message": f"Role '{role_name}' assigned to user successfully"}

@router.delete("/{user_id}/roles/{role_name}")
def remove_role_from_user(
    user_id: int,
    role_name: str,
    current_user = Depends(require_admin)
):
    """Remove role from user (admin only)"""
    user_service = UserService(get_db())
    
    success = user_service.remove_role_from_user(user_id, role_name)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User or role not found"
        )
    
    return {"message": f"Role '{role_name}' removed from user successfully"}

# Permission management endpoints
@router.get("/permissions/", response_model=PermissionListResponse)
def get_permissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user = Depends(require_admin)
):
    """Get all permissions (admin only)"""
    user_service = UserService(get_db())
    
    permissions = user_service.db.query(Permission).offset(skip).limit(limit).all()
    total = len(permissions)
    
    return PermissionListResponse(
        permissions=[PermissionResponse.from_orm(permission) for permission in permissions],
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@router.post("/permissions/", response_model=PermissionResponse)
def create_permission(
    permission_data: PermissionCreate,
    current_user = Depends(require_admin)
):
    """Create new permission (admin only)"""
    user_service = UserService(get_db())
    
    permission = user_service.create_permission(permission_data)
    return PermissionResponse.from_orm(permission)

@router.post("/roles/{role_name}/permissions/{permission_name}")
def assign_permission_to_role(
    role_name: str,
    permission_name: str,
    current_user = Depends(require_admin)
):
    """Assign permission to role (admin only)"""
    user_service = UserService(get_db())
    
    success = user_service.assign_permission_to_role(role_name, permission_name)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role or permission not found"
        )
    
    return {"message": f"Permission '{permission_name}' assigned to role '{role_name}' successfully"}
