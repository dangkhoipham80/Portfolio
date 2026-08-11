"""add the posts table for the blog

Revision ID: a9c4d7e13f56
Revises: c7a3f5e21b08
Create Date: 2026-08-11 19:04:12.883517

A new table with no data to move, so this is the cheap kind of migration. Three
things were still decided by hand rather than taken from autogenerate:

``published`` gets ``server_default=false``, matching ``career_entries`` in
b2f1c7d94a30 rather than the model's Python-side ``default=False``. The ORM
always supplies the value, but ``INSERT`` from psql or a future backfill does
not, and a NOT NULL column with no default turns that into an error instead of a
draft.

``tags`` is ``json``, not ``jsonb``, to match every other list column in this
schema. That costs the containment operator, which is why
``PortfolioService.get_posts`` filters by tag in Python — the note is there.
Switching the whole schema to jsonb is a separate change, not a thing to do to
one new table.

``published_at`` is nullable and carries no index. Null is the normal state of a
draft, and the table is expected to hold tens of rows, so the ordering scan is
free; an index here would be decoration.

``downgrade()`` drops the table, and with it every post ever written. That is
reversible only while the table is empty, which it is on the way in — this
migration creates it. Anyone reaching for the downgrade later is deleting
content, not undoing a schema change.

``ci.yml`` runs ``fly deploy`` on a push to main touching ``apps/api`` and the
release command applies migrations, so this runs unattended against production.
A CREATE TABLE is safe to run that way; nothing existing is touched.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a9c4d7e13f56'
down_revision = 'c7a3f5e21b08'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'posts',
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('excerpt', sa.Text(), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('cover_image', sa.String(length=500), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_posts_id'), 'posts', ['id'], unique=False)
    op.create_index(op.f('ix_posts_slug'), 'posts', ['slug'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_posts_slug'), table_name='posts')
    op.drop_index(op.f('ix_posts_id'), table_name='posts')
    op.drop_table('posts')
