"""add media_assets: an index of everything uploaded to Blob

Revision ID: d3b8e64a1f27
Revises: a9c4d7e13f56
Create Date: 2026-08-21 19:20:44.118203

A new table and nothing else — no column on any existing table, no backfill, no
data touched. That is worth saying explicitly because the feature this belongs
to (project galleries) *does* add columns, and those are a separate migration on
purpose: this one is safe to apply to a live database with the old code still
running, since nothing reads or writes the table until the deploy that follows.

Two details are not autogenerate output and must survive a regeneration:

* ``url`` is String(1000) with a unique index, not the String(500) every other
  URL column in this schema uses. Blob URLs carry a store id, the pathname and
  a random suffix, and 500 is not a safe ceiling for one; the uniqueness is what
  makes registration idempotent, and losing it turns every client retry into a
  duplicate row.
* ``created_at`` gets an index. The library is always read newest-first and that
  is the only ordering the picker offers, so the sort is the access pattern
  rather than an afterthought.

There is deliberately no foreign key from any content table to this one. See the
docstring on ``MediaAsset`` in app/models/portfolio.py for why, and for what is
given up by not having one.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd3b8e64a1f27'
down_revision = 'a9c4d7e13f56'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'media_assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('url', sa.String(length=1000), nullable=False),
        sa.Column('pathname', sa.String(length=1000), nullable=True),
        sa.Column('alt', sa.String(length=500), nullable=True),
        sa.Column('mime', sa.String(length=100), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_media_assets_id'), 'media_assets', ['id'], unique=False)
    op.create_index(op.f('ix_media_assets_url'), 'media_assets', ['url'], unique=True)
    op.create_index(
        op.f('ix_media_assets_created_at'), 'media_assets', ['created_at'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_media_assets_created_at'), table_name='media_assets')
    op.drop_index(op.f('ix_media_assets_url'), table_name='media_assets')
    op.drop_index(op.f('ix_media_assets_id'), table_name='media_assets')
    op.drop_table('media_assets')
