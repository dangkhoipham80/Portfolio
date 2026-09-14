"""reader accounts: comment authorship, login streak, reading progress

Revision ID: c4e91b82f7a5
Revises: a1d7f3c50e42
Create Date: 2026-09-14 09:12:40.118322

Three unrelated-looking changes in one revision because they arrive together and
are the same change seen from three places: a comment, a sign-in and a scroll
position all start belonging to an account.

Everything here is additive. Nothing is dropped, nothing is rewritten, and every
new column is either nullable or carries a server default — so this can be
applied while the previous deploy is still serving: the old code selects columns
that all still exist and never writes the new ones.

Two things autogenerate would have got wrong, and which are therefore written by
hand:

* **``users.login_streak`` is NOT NULL with a server default of 0.** Adding a
  NOT NULL column to a populated table needs a default the *database* can apply
  to the rows already there; ``default=`` in the model is a Python-side value
  Alembic never emits, so without ``server_default`` the ALTER fails on the
  first existing account. The default is kept afterwards rather than dropped,
  which is what makes the column safe for a writer that has not been taught
  about it — a psql session included.

* **``post_comments.user_id`` is ON DELETE SET NULL, and nullable.** Both
  matter and autogenerate has no way to know either. Nullable because the
  comments already in the table were written before accounts existed, and
  back-filling them would mean inventing an account for a name somebody typed
  into a box. SET NULL because deleting an account must not take a thread other
  people replied to with it — the comment keeps the name it was signed with and
  loses only its link.

  ``post_reading_progress.user_id`` is the opposite, CASCADE, and for the
  opposite reason: a scroll position is not a contribution to anything. When the
  account goes there is nobody it could still be about.

The downgrade is real and was run — CI round-trips the head revision on an empty
database. It drops in reverse dependency order so the foreign keys go before the
tables they point at.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c4e91b82f7a5'
down_revision = 'a1d7f3c50e42'
branch_labels = None
depends_on = None

COMMENT_AUTHOR_FK = 'fk_post_comments_user_id_users'


def upgrade() -> None:
    # --- the login streak -------------------------------------------------
    op.add_column(
        'users',
        sa.Column('login_streak', sa.Integer(), nullable=False, server_default='0'),
    )
    # A Date, not a timestamp: a streak asks "was yesterday a day you signed
    # in", and storing the instant means every reader re-derives the day
    # boundary for itself. See UserService.record_login.
    op.add_column('users', sa.Column('last_login_day', sa.Date(), nullable=True))

    # --- who wrote a comment ---------------------------------------------
    op.add_column('post_comments', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_index(
        op.f('ix_post_comments_user_id'), 'post_comments', ['user_id'], unique=False
    )
    op.create_foreign_key(
        COMMENT_AUTHOR_FK,
        'post_comments',
        'users',
        ['user_id'],
        ['id'],
        ondelete='SET NULL',
    )

    # --- how far through a post an account has got ------------------------
    op.create_table(
        'post_reading_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('progress', sa.Float(), nullable=False, server_default='0'),
        sa.Column('finished', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        # One row per reader per post, which is what makes a write an upsert
        # rather than an append.
        sa.UniqueConstraint('user_id', 'post_id', name='uq_post_reading_progress_user_post'),
    )
    op.create_index(
        op.f('ix_post_reading_progress_id'), 'post_reading_progress', ['id'], unique=False
    )
    op.create_index(
        op.f('ix_post_reading_progress_post_id'),
        'post_reading_progress',
        ['post_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_post_reading_progress_user_id'),
        'post_reading_progress',
        ['user_id'],
        unique=False,
    )
    # The reading list is always "this account's posts, most recent first".
    op.create_index(
        'ix_post_reading_progress_user_id_last_read_at',
        'post_reading_progress',
        ['user_id', 'last_read_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        'ix_post_reading_progress_user_id_last_read_at', table_name='post_reading_progress'
    )
    op.drop_index(
        op.f('ix_post_reading_progress_user_id'), table_name='post_reading_progress'
    )
    op.drop_index(
        op.f('ix_post_reading_progress_post_id'), table_name='post_reading_progress'
    )
    op.drop_index(op.f('ix_post_reading_progress_id'), table_name='post_reading_progress')
    op.drop_table('post_reading_progress')

    op.drop_constraint(COMMENT_AUTHOR_FK, 'post_comments', type_='foreignkey')
    op.drop_index(op.f('ix_post_comments_user_id'), table_name='post_comments')
    op.drop_column('post_comments', 'user_id')

    op.drop_column('users', 'last_login_day')
    op.drop_column('users', 'login_streak')
