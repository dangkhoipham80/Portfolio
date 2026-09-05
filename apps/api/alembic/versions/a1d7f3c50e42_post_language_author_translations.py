"""blog: post language, author name, and translation links

Revision ID: a1d7f3c50e42
Revises: f1a4c8e26b93
Create Date: 2026-09-05 10:42:11.004512

Three additive columns on ``posts``. Nothing is dropped and nothing is rewritten
beyond the backfill below, so this is safe to apply while the previous deploy is
still serving: the old code selects columns that all still exist and ignores the
new ones.

Two things worth stating, both of which autogenerate would have got wrong if it
had been asked:

* **``language`` is NOT NULL with a server default.** Adding a NOT NULL column
  to a populated table needs a default the database can apply to the rows
  already there, and ``default=`` in the model is a Python-side value that
  Alembic never emits. Without ``server_default`` the ALTER fails on the first
  existing post. The value is ``vi`` because every post on the site today is
  Vietnamese — see SUPPORTED_LANGUAGES in app/core/constants.py, where the first
  entry is the default.

  The server default is deliberately kept rather than dropped afterwards. It is
  what makes the column safe for any writer that has not been taught about it
  yet, including a psql session.

* **``translation_of_id`` is a self-referencing foreign key.** ON DELETE SET
  NULL, so deleting an original leaves its translations standing and merely
  unlinked — they are the same writing in another language, not parts of the
  original, and cascading here would delete a published English post because
  someone tidied up a Vietnamese draft. The named constraint matters for the
  downgrade: an unnamed self-FK is awkward to drop on Postgres.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1d7f3c50e42'
down_revision = 'f1a4c8e26b93'
branch_labels = None
depends_on = None

TRANSLATION_FK = 'fk_posts_translation_of_id_posts'


def upgrade() -> None:
    op.add_column(
        'posts',
        sa.Column('language', sa.String(length=8), nullable=False, server_default='vi'),
    )
    op.add_column('posts', sa.Column('author_name', sa.String(length=120), nullable=True))
    op.add_column('posts', sa.Column('translation_of_id', sa.Integer(), nullable=True))

    op.create_index(
        op.f('ix_posts_translation_of_id'), 'posts', ['translation_of_id'], unique=False
    )
    op.create_foreign_key(
        TRANSLATION_FK,
        'posts',
        'posts',
        ['translation_of_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint(TRANSLATION_FK, 'posts', type_='foreignkey')
    op.drop_index(op.f('ix_posts_translation_of_id'), table_name='posts')
    op.drop_column('posts', 'translation_of_id')
    op.drop_column('posts', 'author_name')
    op.drop_column('posts', 'language')
