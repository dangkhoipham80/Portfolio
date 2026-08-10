"""drop the google oauth columns

Revision ID: c7a3f5e21b08
Revises: b2f1c7d94a30
Create Date: 2026-08-10 21:47:03.118204

``users.google_id`` and ``users.google_email`` were created by the initial
migration to support a ``POST /api/v1/auth/google`` sign-in. That endpoint was
removed some time ago; the columns, the unique index, two schemas and
``UserService.authenticate_google_user()`` stayed behind, reachable from
nothing. This drops the schema half of that.

Nothing has ever written to either column — the only account this API has is the
admin created by ``scripts/init_auth_tables.py``, which sets neither. Both were
confirmed entirely NULL in production before this was written:

    select count(*) from users
     where google_id is not null or google_email is not null;   -- 0

That check matters because ``ci.yml`` runs ``fly deploy`` on a push to main
touching ``apps/api``, and the release command applies migrations — so this runs
against the production database unattended. Re-run it before merging if this
branch has sat for a while.

``downgrade()`` restores the columns and the unique index, but cannot restore
values. That is exactly why the NULL check above is the precondition rather than
a nicety: with no data in them, the drop is reversible in the only sense that
matters here.

Autogenerate would have produced roughly this, but not the ordering: the unique
index has to go before the column it covers, or Postgres refuses the drop.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c7a3f5e21b08'
down_revision = 'b2f1c7d94a30'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    op.drop_column('users', 'google_id')
    op.drop_column('users', 'google_email')


def downgrade() -> None:
    # Re-added nullable, which is how the initial migration created them. They
    # come back empty; see the note above.
    op.add_column('users', sa.Column('google_email', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('google_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=True)
