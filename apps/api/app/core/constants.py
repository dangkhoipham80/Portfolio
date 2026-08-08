# Error Messages
class ErrorMessages:
    # User related
    USER_NOT_FOUND = "User not found"
    USER_ALREADY_EXISTS = "User already exists"
    INVALID_CREDENTIALS = "Invalid email or password"
    ACCOUNT_DEACTIVATED = "User account is deactivated"
    EMAIL_NOT_VERIFIED = "Please verify your email before logging in"

    # Contact related
    CONTACT_NOT_FOUND = "Contact not found"

    # Project related
    PROJECT_NOT_FOUND = "Project not found"

    # Skill related
    SKILL_NOT_FOUND = "Skill not found"

    # Certificate related
    CERTIFICATE_NOT_FOUND = "Certificate not found"

    # Role & Permission related
    ROLE_NOT_FOUND = "Role not found"
    PERMISSION_NOT_FOUND = "Permission not found"
    ROLE_ALREADY_EXISTS = "Role already exists"
    PERMISSION_ALREADY_EXISTS = "Permission already exists"
    USER_ALREADY_HAS_ROLE = "User already has this role"
    ROLE_ALREADY_HAS_PERMISSION = "Role already has this permission"

    # Token related
    INVALID_TOKEN = "Invalid or expired token"
    INVALID_REFRESH_TOKEN = "Invalid refresh token"

    # Generic messages
    ITEM_NOT_FOUND = "Item not found"
    UNAUTHORIZED = "Unauthorized"
    FORBIDDEN = "Forbidden"
    VALIDATION_ERROR = "Validation error"
    INTERNAL_SERVER_ERROR = "Internal server error"

# Success Messages
class SuccessMessages:
    CONTACT_DELETED = "Contact deleted successfully"
    PROJECT_DELETED = "Project deleted successfully"
    SKILL_DELETED = "Skill deleted successfully"
    CERTIFICATE_DELETED = "Certificate deleted successfully"