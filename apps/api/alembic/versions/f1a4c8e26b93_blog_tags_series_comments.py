"""blog: tag rows, series, revisions, comments, ratings

Revision ID: f1a4c8e26b93
Revises: e5c91a72b4d8
Create Date: 2026-08-22 10:41:53.118204

Autogenerate would get two things here badly wrong, so this file is hand-written
and must not be replaced by its output:

* **``posts.tags`` becomes rows.** Autogenerate sees a JSON column disappearing
  and two unrelated tables appearing, and emits a DROP that throws every tag on
  the site away. The drop only happens here *after* the values have been read
  out, turned into ``tags`` rows and linked through ``post_tags``.

* **The enum types.** ``sa.Enum`` under Postgres is a CREATE TYPE, and
  ``op.add_column`` does not emit one — the ALTER lands first and fails on a
  type that does not exist. Both are created explicitly below, ``checkfirst`` so
  a partially-applied run can be repeated.

Everything else is additive. The one destructive step is the ``posts.tags``
drop, and ``downgrade`` rebuilds that column from the link table rather than
leaving it empty, so the round trip returns the same data it started with.

**This is not safe to apply while the previous deploy is still serving.** The
old code selects ``posts.tags``, which stops existing part-way through. Deploy
the API and this migration together, before the web app — the API's response
changes shape here, and lib/api.ts on the old web build reads a tag list of
strings. See docs/deploying.md.
"""
import re
import unicodedata

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f1a4c8e26b93'
down_revision = 'e5c91a72b4d8'
branch_labels = None
depends_on = None


# Member *names*, not values — matching every other enum in this schema.
POST_FORMAT_VALUES = ('MARKDOWN', 'MDX')
COMMENT_STATUS_VALUES = ('PENDING', 'APPROVED', 'REJECTED')

# Two objects per enum, and the split is load-bearing.
#
# A `sa.Enum` passed to `op.add_column` or `op.create_table` emits its own
# CREATE TYPE alongside the ALTER, because the type object has no idea the type
# is already there. Creating it explicitly first and then using the same object
# in three columns therefore fails on the *second* statement with
# `DuplicateObject: type "postformat" already exists` — and `checkfirst=True` on
# the explicit create does not help, since it is not the create that duplicates.
#
# So: the `sa.Enum` below is only ever used to run CREATE TYPE and DROP TYPE by
# hand, and every column reference uses the dialect's ENUM with
# `create_type=False`, which emits the reference and nothing else.
#
# Postgres-specific, deliberately. This schema is already Postgres-only —
# `now()`, `json_agg` and `::json` appear in the migrations either side of this
# one — so the dialect import is honest rather than a portability regression.
post_format_type = sa.Enum(*POST_FORMAT_VALUES, name='postformat')
comment_status_type = sa.Enum(*COMMENT_STATUS_VALUES, name='commentstatus')

post_format = postgresql.ENUM(*POST_FORMAT_VALUES, name='postformat', create_type=False)
comment_status = postgresql.ENUM(
    *COMMENT_STATUS_VALUES, name='commentstatus', create_type=False
)


def _slugify(value: str) -> str:
    """Frozen copy of app/core/slugs.py:slugify.

    Duplicated rather than imported, for the reason spelled out in
    b2f1c7d94a30: a migration has to keep producing the same output forever, and
    importing application code lets a later edit change what an
    already-applied migration would do on a fresh database.
    """
    pre_folded = value.translate(str.maketrans({"Đ": "D", "đ": "d"}))
    folded = unicodedata.normalize("NFKD", pre_folded)
    ascii_only = folded.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower())
    return re.sub(r"^-+|-+$", "", slug)[:120].strip("-")


def _existing_tags(bind) -> list[tuple[int, list[str]]]:
    """Every post's JSON tag list, as it stands before this migration.

    psycopg decodes a ``json`` column to Python for us; the ``isinstance`` guard
    covers a driver that hands back the raw text instead, and a NULL column,
    which is what a post that was never tagged has.
    """
    import json

    rows = bind.execute(sa.text("SELECT id, tags FROM posts ORDER BY id")).fetchall()
    out = []

    for post_id, raw in rows:
        if raw is None:
            continue
        value = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(value, list):
            continue
        out.append((post_id, [str(item) for item in value if str(item).strip()]))

    return out


def _migrate_tags_to_rows(bind) -> None:
    """Turn every distinct tag string into a row, and link the posts to it.

    Keyed on the slug rather than the raw string, so "API" and "api" — which
    read as one subject and were two facets on the index — converge onto a
    single row. The first spelling encountered wins as the display name, which
    is arbitrary but visible and editable in the console afterwards; the
    alternative is inventing a canonical casing here that the owner never chose.

    A tag that slugifies to nothing (punctuation only) is dropped. There is no
    URL that could address it, so keeping it would create a facet that 404s.
    """
    tag_ids: dict[str, int] = {}

    for post_id, names in _existing_tags(bind):
        for name in names:
            slug = _slugify(name)
            if not slug:
                continue

            if slug not in tag_ids:
                tag_ids[slug] = bind.execute(
                    sa.text(
                        "INSERT INTO tags (slug, name, created_at) "
                        "VALUES (:slug, :name, now()) RETURNING id"
                    ),
                    {"slug": slug, "name": name.strip()[:60]},
                ).scalar_one()

            # ON CONFLICT: a post carrying ["API", "api"] reduces to one slug
            # and would otherwise violate the composite primary key.
            bind.execute(
                sa.text(
                    "INSERT INTO post_tags (post_id, tag_id) VALUES (:post_id, :tag_id) "
                    "ON CONFLICT DO NOTHING"
                ),
                {"post_id": post_id, "tag_id": tag_ids[slug]},
            )


def upgrade() -> None:
    bind = op.get_bind()

    post_format_type.create(bind, checkfirst=True)
    comment_status_type.create(bind, checkfirst=True)

    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('name', sa.String(length=60), nullable=False),
        sa.Column('description', sa.String(length=280), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tags_id'), 'tags', ['id'])
    op.create_index(op.f('ix_tags_slug'), 'tags', ['slug'], unique=True)

    op.create_table(
        'series',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_image', sa.String(length=500), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_series_id'), 'series', ['id'])
    op.create_index(op.f('ix_series_slug'), 'series', ['slug'], unique=True)

    op.create_table(
        'post_tags',
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('post_id', 'tag_id'),
    )

    op.add_column(
        'posts',
        sa.Column('format', post_format, nullable=False, server_default='MARKDOWN'),
    )
    op.add_column(
        'posts',
        sa.Column('series_order', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column('posts', sa.Column('series_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_posts_series_id'), 'posts', ['series_id'])
    op.create_foreign_key(
        'fk_posts_series_id', 'posts', 'series', ['series_id'], ['id'], ondelete='SET NULL'
    )

    # Before the drop below, and the only reason this file is hand-written.
    _migrate_tags_to_rows(bind)
    op.drop_column('posts', 'tags')

    op.create_table(
        'post_revisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('excerpt', sa.Text(), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('format', post_format, nullable=False, server_default='MARKDOWN'),
        sa.Column('tag_slugs', sa.JSON(), nullable=True),
        sa.Column('note', sa.String(length=280), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_post_revisions_id'), 'post_revisions', ['id'])
    op.create_index(op.f('ix_post_revisions_post_id'), 'post_revisions', ['post_id'])
    op.create_index('ix_post_revisions_post_id_id', 'post_revisions', ['post_id', 'id'])

    op.create_table(
        'post_comments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('author_name', sa.String(length=80), nullable=False),
        sa.Column('author_email', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('status', comment_status, nullable=False, server_default='PENDING'),
        sa.Column('author_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['post_comments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_post_comments_id'), 'post_comments', ['id'])
    op.create_index(op.f('ix_post_comments_post_id'), 'post_comments', ['post_id'])
    op.create_index(op.f('ix_post_comments_parent_id'), 'post_comments', ['parent_id'])
    op.create_index(op.f('ix_post_comments_author_hash'), 'post_comments', ['author_hash'])
    op.create_index('ix_post_comments_post_id_status', 'post_comments', ['post_id', 'status'])

    op.create_table(
        'post_ratings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('stars', sa.Integer(), nullable=False),
        sa.Column('voter_hash', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_id', 'voter_hash', name='uq_post_ratings_post_voter'),
    )
    op.create_index(op.f('ix_post_ratings_id'), 'post_ratings', ['id'])
    op.create_index(op.f('ix_post_ratings_post_id'), 'post_ratings', ['post_id'])


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_table('post_ratings')
    op.drop_table('post_comments')
    op.drop_table('post_revisions')

    # Rebuilt from the link table, not left NULL. A downgrade that silently
    # untags every post is a downgrade nobody can run twice, and the whole point
    # of keeping one is that it returns the database to where it started.
    op.add_column('posts', sa.Column('tags', sa.JSON(), nullable=True))
    bind.execute(
        sa.text(
            "UPDATE posts SET tags = COALESCE(("
            "  SELECT json_agg(t.name ORDER BY t.name)"
            "  FROM post_tags pt JOIN tags t ON t.id = pt.tag_id"
            "  WHERE pt.post_id = posts.id"
            "), '[]'::json)"
        )
    )

    op.drop_constraint('fk_posts_series_id', 'posts', type_='foreignkey')
    op.drop_index(op.f('ix_posts_series_id'), table_name='posts')
    op.drop_column('posts', 'series_id')
    op.drop_column('posts', 'series_order')
    op.drop_column('posts', 'format')

    op.drop_table('post_tags')
    op.drop_table('series')
    op.drop_table('tags')

    comment_status_type.drop(bind, checkfirst=True)
    post_format_type.drop(bind, checkfirst=True)
