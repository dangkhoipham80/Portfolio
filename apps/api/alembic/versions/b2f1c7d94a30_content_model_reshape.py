"""content model reshape: slugs, publish state, richer projects, career entries

Revision ID: b2f1c7d94a30
Revises: 4e8845a384cb
Create Date: 2026-08-09 13:20:11.402881

Two things here are not autogenerate output and must not be replaced by it:

* the slug backfills, which have to invent a value for every existing row and
  keep it unique before the unique index goes on; and
* ``skills.level``, which changes from a 1-5 integer to a named enum. Autogenerate
  emits a bare ALTER TYPE for that, which Postgres refuses without a USING clause.

Existing rows are backfilled to ``published = true``. They were publicly visible
before this migration, and defaulting them to draft would silently unpublish a
live portfolio.
"""
import re
import unicodedata

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2f1c7d94a30'
down_revision = '4e8845a384cb'
branch_labels = None
depends_on = None


# SQLAlchemy's Enum persists member *names*, not values — matching `userstatus`
# and `tokentype` in the initial migration.
project_status = sa.Enum(
    'COMPLETED', 'IN_PROGRESS', 'ON_HOLD', 'DROPPED', name='projectstatus'
)
skill_level = sa.Enum(
    'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', name='skilllevel'
)


def _slugify(value: str) -> str:
    """Frozen copy of app/core/slugs.py:slugify.

    Deliberately duplicated rather than imported. A migration has to keep
    producing the same output forever, and importing application code would let
    a later edit to slugify() silently change what this already-applied
    migration would do on a fresh database.

    Doing it in Python rather than SQL is not a style choice either: the obvious
    ``regexp_replace(title, '[^a-zA-Z0-9]+', '-')`` treats an accented letter as
    a separator, so "Phạm Đăng Khôi" comes out "ph-m-d-ng-kh-i" instead of
    "pham-dang-khoi". NFKD folds; a character class cannot.
    """
    pre_folded = value.translate(str.maketrans({"Đ": "D", "đ": "d"}))
    folded = unicodedata.normalize("NFKD", pre_folded)
    ascii_only = folded.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower())
    return re.sub(r"^-+|-+$", "", slug)[:255].strip("-")


def _backfill_slugs(table: str) -> None:
    """Give every existing row a unique slug derived from its title.

    Duplicates are suffixed -2, -3 … and a title that reduces to nothing (all
    punctuation) falls back to 'item', which then collides and gets suffixed
    like any other duplicate. Row counts here are portfolio-sized, so the
    per-row round trip costs nothing worth optimising away.
    """
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(f"SELECT id, title FROM {table} ORDER BY id")  # noqa: S608 - fixed table names
    ).fetchall()

    taken = set()
    for row_id, title in rows:
        base = _slugify(title or "") or "item"
        candidate, suffix = base, 2
        while candidate in taken:
            candidate = f"{base}-{suffix}"
            suffix += 1
        taken.add(candidate)

        bind.execute(
            sa.text(f"UPDATE {table} SET slug = :slug WHERE id = :id"),  # noqa: S608
            {"slug": candidate, "id": row_id},
        )


def upgrade() -> None:
    bind = op.get_bind()
    project_status.create(bind, checkfirst=True)
    skill_level.create(bind, checkfirst=True)

    # --- projects -----------------------------------------------------------
    op.add_column('projects', sa.Column('slug', sa.String(length=255), nullable=True))
    op.add_column('projects', sa.Column('long_description', sa.Text(), nullable=True))
    op.add_column('projects', sa.Column('features', sa.JSON(), nullable=True))
    op.add_column('projects', sa.Column('challenges', sa.JSON(), nullable=True))
    op.add_column('projects', sa.Column('started_on', sa.Date(), nullable=True))
    op.add_column('projects', sa.Column('ended_on', sa.Date(), nullable=True))
    op.add_column(
        'projects',
        sa.Column('status', project_status, nullable=False, server_default='COMPLETED'),
    )
    op.add_column(
        'projects',
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE projects SET published = true")

    _backfill_slugs('projects')
    op.alter_column('projects', 'slug', nullable=False)
    op.create_index(op.f('ix_projects_slug'), 'projects', ['slug'], unique=True)

    # --- skills -------------------------------------------------------------
    # 1-5 collapses onto four names; 2 and 3 both land on INTERMEDIATE because
    # the old scale had no separate label for either.
    op.execute(
        """
        ALTER TABLE skills
        ALTER COLUMN level DROP DEFAULT,
        ALTER COLUMN level TYPE skilllevel
        USING (
            CASE level
                WHEN 5 THEN 'EXPERT'
                WHEN 4 THEN 'ADVANCED'
                WHEN 3 THEN 'INTERMEDIATE'
                WHEN 2 THEN 'INTERMEDIATE'
                ELSE 'BEGINNER'
            END
        )::skilllevel
        """
    )
    op.execute("UPDATE skills SET level = 'BEGINNER' WHERE level IS NULL")
    op.alter_column('skills', 'level', nullable=False, server_default='BEGINNER')

    # --- certificates -------------------------------------------------------
    op.add_column('certificates', sa.Column('slug', sa.String(length=255), nullable=True))
    op.add_column('certificates', sa.Column('credential_id', sa.String(length=100), nullable=True))
    op.add_column('certificates', sa.Column('category', sa.String(length=50), nullable=True))
    op.add_column('certificates', sa.Column('skills', sa.JSON(), nullable=True))
    op.add_column(
        'certificates',
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE certificates SET published = true")

    _backfill_slugs('certificates')
    op.alter_column('certificates', 'slug', nullable=False)
    op.create_index(op.f('ix_certificates_slug'), 'certificates', ['slug'], unique=True)

    # --- career_entries -----------------------------------------------------
    op.create_table(
        'career_entries',
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('started_on', sa.Date(), nullable=False),
        sa.Column('ended_on', sa.Date(), nullable=True),
        sa.Column('highlights', sa.JSON(), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
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
    op.create_index(op.f('ix_career_entries_id'), 'career_entries', ['id'], unique=False)
    op.create_index(op.f('ix_career_entries_slug'), 'career_entries', ['slug'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_career_entries_slug'), table_name='career_entries')
    op.drop_index(op.f('ix_career_entries_id'), table_name='career_entries')
    op.drop_table('career_entries')

    op.drop_index(op.f('ix_certificates_slug'), table_name='certificates')
    op.drop_column('certificates', 'published')
    op.drop_column('certificates', 'skills')
    op.drop_column('certificates', 'category')
    op.drop_column('certificates', 'credential_id')
    op.drop_column('certificates', 'slug')

    # Back to the 1-5 scale. INTERMEDIATE has to pick one of the two integers it
    # was merged from; 3 is the midpoint, so a round trip is lossy for old 2s.
    op.execute(
        """
        ALTER TABLE skills
        ALTER COLUMN level DROP DEFAULT,
        ALTER COLUMN level TYPE INTEGER
        USING (
            CASE level
                WHEN 'EXPERT' THEN 5
                WHEN 'ADVANCED' THEN 4
                WHEN 'INTERMEDIATE' THEN 3
                ELSE 1
            END
        )
        """
    )
    op.alter_column('skills', 'level', nullable=True, server_default='1')

    op.drop_index(op.f('ix_projects_slug'), table_name='projects')
    op.drop_column('projects', 'published')
    op.drop_column('projects', 'status')
    op.drop_column('projects', 'ended_on')
    op.drop_column('projects', 'started_on')
    op.drop_column('projects', 'challenges')
    op.drop_column('projects', 'features')
    op.drop_column('projects', 'long_description')
    op.drop_column('projects', 'slug')

    # Same reason as the initial migration: autogenerate never drops the named
    # enum types, so a downgrade-then-upgrade fails with "type already exists".
    bind = op.get_bind()
    skill_level.drop(bind, checkfirst=True)
    project_status.drop(bind, checkfirst=True)
