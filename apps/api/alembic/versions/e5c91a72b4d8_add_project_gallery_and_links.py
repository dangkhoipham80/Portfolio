"""add projects.gallery and projects.links

Revision ID: e5c91a72b4d8
Revises: d3b8e64a1f27
Create Date: 2026-08-21 19:52:07.664412

Two nullable JSON columns, matching ``technologies``/``features``/``challenges``
on the same table. No backfill and no default: NULL means "never set", and the
API reads a null JSON list as ``[]`` through the ``_no_null_list`` validator
that already exists for the three columns above — the same reason those are
nullable rather than ``server_default='[]'``.

Writing ``'[]'`` into every existing row instead would be a table rewrite to
express something the read path already handles, and would make "the admin has
not touched this yet" and "the admin cleared it" indistinguishable in the data.

Additive and safe to apply while the old code is running: nothing selects these
columns until the deploy that follows.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e5c91a72b4d8'
down_revision = 'd3b8e64a1f27'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('gallery', sa.JSON(), nullable=True))
    op.add_column('projects', sa.Column('links', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'links')
    op.drop_column('projects', 'gallery')
