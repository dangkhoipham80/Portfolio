#!/usr/bin/env python3
"""
Initialize authentication tables and default data
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_db
from app.models.user import UserStatus
from app.schemas.user import PermissionCreate, RoleCreate, UserCreate
from app.services.user_service import UserService


def create_default_roles():
    """Create default roles"""
    db = next(get_db())
    user_service = UserService(db)

    default_roles = [
        {"name": "admin", "description": "Administrator with full access"},
        {"name": "user", "description": "Regular user"},
        {"name": "moderator", "description": "Moderator with limited admin access"},
    ]

    for role_data in default_roles:
        try:
            user_service.create_role(RoleCreate(**role_data))
            print(f"✅ Created role: {role_data['name']}")
        except Exception as e:
            print(f"⚠️  Role {role_data['name']} already exists: {e}")

def create_default_permissions():
    """Create default permissions"""
    db = next(get_db())
    user_service = UserService(db)

    default_permissions = [
        # User permissions
        {"name": "user:read", "description": "Read user information", "resource": "user", "action": "read"},
        {"name": "user:create", "description": "Create new users", "resource": "user", "action": "create"},
        {"name": "user:update", "description": "Update user information", "resource": "user", "action": "update"},
        {"name": "user:delete", "description": "Delete users", "resource": "user", "action": "delete"},

        # Project permissions
        {"name": "project:read", "description": "Read projects", "resource": "project", "action": "read"},
        {"name": "project:create", "description": "Create projects", "resource": "project", "action": "create"},
        {"name": "project:update", "description": "Update projects", "resource": "project", "action": "update"},
        {"name": "project:delete", "description": "Delete projects", "resource": "project", "action": "delete"},

        # Skill permissions
        {"name": "skill:read", "description": "Read skills", "resource": "skill", "action": "read"},
        {"name": "skill:create", "description": "Create skills", "resource": "skill", "action": "create"},
        {"name": "skill:update", "description": "Update skills", "resource": "skill", "action": "update"},
        {"name": "skill:delete", "description": "Delete skills", "resource": "skill", "action": "delete"},

        # Contact permissions
        {"name": "contact:read", "description": "Read contacts", "resource": "contact", "action": "read"},
        {"name": "contact:create", "description": "Create contacts", "resource": "contact", "action": "create"},
        {"name": "contact:update", "description": "Update contacts", "resource": "contact", "action": "update"},
        {"name": "contact:delete", "description": "Delete contacts", "resource": "contact", "action": "delete"},

        # Certificate permissions
        {"name": "certificate:read", "description": "Read certificates", "resource": "certificate", "action": "read"},
        {"name": "certificate:create", "description": "Create certificates", "resource": "certificate", "action": "create"},
        {"name": "certificate:update", "description": "Update certificates", "resource": "certificate", "action": "update"},
        {"name": "certificate:delete", "description": "Delete certificates", "resource": "certificate", "action": "delete"},
    ]

    for permission_data in default_permissions:
        try:
            user_service.create_permission(PermissionCreate(**permission_data))
            print(f"✅ Created permission: {permission_data['name']}")
        except Exception as e:
            print(f"⚠️  Permission {permission_data['name']} already exists: {e}")

def assign_permissions_to_roles():
    """Assign permissions to roles"""
    db = next(get_db())
    user_service = UserService(db)

    # Admin gets all permissions
    admin_permissions = [
        "user:read", "user:create", "user:update", "user:delete",
        "project:read", "project:create", "project:update", "project:delete",
        "skill:read", "skill:create", "skill:update", "skill:delete",
        "contact:read", "contact:create", "contact:update", "contact:delete",
        "certificate:read", "certificate:create", "certificate:update", "certificate:delete",
    ]

    # User gets read permissions only
    user_permissions = [
        "project:read", "skill:read", "certificate:read"
    ]

    # Moderator gets read and create permissions
    moderator_permissions = [
        "project:read", "project:create", "project:update",
        "skill:read", "skill:create", "skill:update",
        "certificate:read", "certificate:create", "certificate:update",
        "contact:read", "contact:create", "contact:update",
    ]

    role_permissions = {
        "admin": admin_permissions,
        "user": user_permissions,
        "moderator": moderator_permissions,
    }

    for role_name, permissions in role_permissions.items():
        for permission_name in permissions:
            try:
                user_service.assign_permission_to_role(role_name, permission_name)
                print(f"✅ Assigned {permission_name} to {role_name}")
            except Exception as e:
                print(f"⚠️  Failed to assign {permission_name} to {role_name}: {e}")

def admin_credentials_from_env():
    """Read and check the admin credentials, before anything else happens.

    These used to be hardcoded as admin@example.com / admin123, so anyone who
    ran the script — or simply read the repository — knew how to log in as the
    administrator.

    Validated up front, ahead of opening a database session, so a missing
    variable fails immediately instead of after connecting.
    """
    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")

    if not email or not password:
        raise SystemExit(
            "Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script. Generate one with:\n"
            '  python -c "import secrets; print(secrets.token_urlsafe(24))"'
        )

    if len(password) < 12:
        raise SystemExit("ADMIN_PASSWORD must be at least 12 characters.")

    return email, password


def create_default_admin():
    """Create default admin user"""
    email, password = admin_credentials_from_env()

    db = next(get_db())
    user_service = UserService(db)

    admin_user = user_service.get_user_by_email(email)
    if admin_user:
        print("⚠️  Admin user already exists")
        return admin_user

    admin_data = UserCreate(
        email=email,
        username="admin",
        full_name="System Administrator",
        password=password,
    )

    try:
        admin_user = user_service.create_user(admin_data)
        
        # Update user to be verified and active
        admin_user.is_verified = True
        admin_user.status = UserStatus.ACTIVE
        db.commit()
        
        print(f"✅ Created admin user: {admin_user.email}")

        # Assign admin role
        user_service.assign_role_to_user(admin_user.id, "admin")
        print("✅ Assigned admin role to admin user")

        return admin_user
    except Exception as e:
        print(f"❌ Failed to create admin user: {e}")
        return None

def main():
    """Main initialization function"""
    print("🚀 Initializing authentication system...")

    try:
        # Create default roles
        print("\n📋 Creating default roles...")
        create_default_roles()

        # Create default permissions
        print("\n🔐 Creating default permissions...")
        create_default_permissions()

        # Assign permissions to roles
        print("\n🔗 Assigning permissions to roles...")
        assign_permissions_to_roles()

        # Create default admin user
        print("\n👤 Creating default admin user...")
        create_default_admin()

        print("\n✅ Authentication system initialized successfully!")
        # Deliberately does not echo the password back. This used to print
        # "Email: admin@example.com / Password: admin123" unconditionally, which
        # after the move to environment variables was simply untrue — it named
        # credentials that would not log anyone in, while the real ones went
        # unmentioned.
        print(f"\n📝 Admin account: {os.environ['ADMIN_EMAIL']}")
        print("   Password: the ADMIN_PASSWORD you supplied.")

    except Exception as e:
        print(f"\n❌ Initialization failed: {e}")
        raise

if __name__ == "__main__":
    main()