# Minimum length for any password this API accepts.
#
# The seed script has refused anything shorter since it stopped shipping a
# hardcoded "admin123", but that was the only place the rule existed: the reset
# and change-password schemas took `str` and accepted a single character, so the
# 12-character admin password could be replaced with "a" through the reset flow
# the script was trying to protect.
#
# Length only. No character-class rules — they push people towards "Password1!"
# and NIST dropped the recommendation in SP 800-63B.
MIN_PASSWORD_LENGTH = 12

# How long a password-reset link stays good for.
#
# One hour was already the answer in three places — the token's expiry, the
# sentence in the mail, and the copy on the web app's reset screen — which is
# three chances for the link to outlive what it claims. Long enough to survive a
# mail client's delay and a walk to another device; short enough that a reset
# mail sitting in an unattended inbox is not a standing key to the account.
PASSWORD_RESET_EXPIRE_MINUTES = 60

# Same shape, for the verification mail.
EMAIL_VERIFICATION_EXPIRE_MINUTES = 60


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

    # Career related
    CAREER_ENTRY_NOT_FOUND = "Career entry not found"

    # Blog related
    POST_NOT_FOUND = "Post not found"
    TAG_NOT_FOUND = "Tag not found"
    SERIES_NOT_FOUND = "Series not found"
    COMMENT_NOT_FOUND = "Comment not found"
    REVISION_NOT_FOUND = "Revision not found"
    # A reply must attach to a top-level comment on the same post. Both halves
    # matter: threading is one level deep, and a parent from another post would
    # put a reply under a comment the reader cannot see.
    COMMENT_PARENT_INVALID = "That comment cannot be replied to"

    MEDIA_NOT_FOUND = "Media asset not found"

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
    CAREER_ENTRY_DELETED = "Career entry deleted successfully"
    POST_DELETED = "Post deleted successfully"
    MEDIA_DELETED = "Media asset deleted successfully"
    TAG_DELETED = "Tag deleted successfully"
    SERIES_DELETED = "Series deleted successfully"
    COMMENT_DELETED = "Comment deleted successfully"
    # Said to the reader, not the admin — so it explains the wait rather than
    # reporting a database write.
    COMMENT_QUEUED = "Thanks — your comment is waiting to be approved."