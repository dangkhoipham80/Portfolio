import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Index,
    Integer,
    String,
    Text,
)

from .base import BaseModel


class ProjectStatus(enum.Enum):
    COMPLETED = "completed"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    DROPPED = "dropped"


class SkillLevel(enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class Project(BaseModel):
    __tablename__ = "projects"

    slug = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    # The card blurb. `long_description` is the modal body — the frontend has
    # always had both, but only this one had a column, so the detail view could
    # never have been served from the API.
    description = Column(Text, nullable=False)
    long_description = Column(Text)
    image_url = Column(String(500))
    github_url = Column(String(500))
    live_url = Column(String(500))
    technologies = Column(JSON)  # list[str]
    features = Column(JSON)      # list[str]
    challenges = Column(JSON)    # list[str]
    # Demo screenshots beyond the cover, in display order.
    #
    # Plain URLs, not {url, caption} objects. Alt text lives on the MediaAsset
    # row for that URL and is inherited by every use, which is the whole reason
    # that table exists; a caption stored per use here would be a second place
    # to describe the same picture and would start disagreeing immediately.
    gallery = Column(JSON)  # list[str]
    # Anything beyond source and live: a demo video, a case study, a Figma file.
    #
    # `github_url` and `live_url` stay as their own columns rather than folding
    # in here. They are not just two more links — the detail page gives them
    # fixed positions and labels, every existing row has them populated, and
    # collapsing them would mean a data migration to buy nothing.
    links = Column(JSON)  # list[{"label": str, "url": str}]
    started_on = Column(Date)
    ended_on = Column(Date)      # Null while the work is still running.
    status = Column(Enum(ProjectStatus), nullable=False, default=ProjectStatus.COMPLETED)
    featured = Column(Boolean, default=False)
    published = Column(Boolean, nullable=False, default=False)
    order = Column(Integer, default=0)


class Skill(BaseModel):
    __tablename__ = "skills"

    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # Frontend, Backend, Database, ...
    # Was an unlabelled 1-5 integer. The frontend renders "Advanced"/"Expert"
    # and had to invent its own mapping, so the names live here instead.
    level = Column(Enum(SkillLevel), nullable=False, default=SkillLevel.BEGINNER)
    icon = Column(String(100))
    order = Column(Integer, default=0)


class Certificate(BaseModel):
    __tablename__ = "certificates"

    slug = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    issuer = Column(String(255), nullable=False)
    issue_date = Column(DateTime, nullable=False)
    credential_id = Column(String(100))
    credential_url = Column(String(500))
    image_url = Column(String(500))
    description = Column(Text)
    category = Column(String(50))
    skills = Column(JSON)  # list[str]
    published = Column(Boolean, nullable=False, default=False)


class CareerEntry(BaseModel):
    __tablename__ = "career_entries"

    slug = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    location = Column(String(255))
    started_on = Column(Date, nullable=False)
    ended_on = Column(Date)  # Null means "Present"; the frontend renders that.
    highlights = Column(JSON)  # list[str]
    published = Column(Boolean, nullable=False, default=False)


class Post(BaseModel):
    """A blog post.

    ``body`` holds Markdown, not HTML. The API stores and returns it verbatim
    and never renders it — the web app does that server-side through a
    sanitising pipeline, so no untrusted HTML is stored here waiting to be
    trusted by whatever reads the column next.
    """

    __tablename__ = "posts"

    slug = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    # Shown on the index card and used as the meta description. Optional: a
    # post without one falls back to the opening of the body.
    excerpt = Column(Text)
    body = Column(Text, nullable=False)
    tags = Column(JSON)  # list[str]
    cover_image = Column(String(500))
    published = Column(Boolean, nullable=False, default=False)
    # When the post first went live, which is not `created_at` — that is when
    # the draft row was made, and a post written over a fortnight would carry
    # the wrong date into the feed and the sitemap. Null until it is published.
    published_at = Column(DateTime(timezone=True))


class Contact(BaseModel):
    __tablename__ = "contacts"

    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)


class MediaAsset(BaseModel):
    """An index of every image uploaded to Blob storage.

    ## Why this table exists

    Before it, nothing recorded an upload. The browser sent bytes straight to
    Vercel Blob, got a URL back, and that URL survived only if the admin went on
    to save the form it was typed into. Upload an image, change your mind, and
    the object stays in the bucket for good — unreferenced, unlistable through
    the app, impossible to find again. A row is written here when the upload
    completes, so the objects in the bucket and the rows in this table stay the
    same set.

    ## Why nothing has a foreign key to it

    Content references images by URL, in ordinary JSON columns, exactly as
    ``technologies`` and ``features`` already do. No join tables, no ``ON
    DELETE`` behaviour. That is a deliberate limit rather than an oversight: the
    alternative is a link table per content type, a nested schema per
    relationship, and an ordering column to keep a gallery in sequence — a large
    amount of machinery to enforce integrity over a handful of screenshots.

    The cost is that deleting a row here does not remove the URL from a project
    using it, so the image keeps rendering from Blob. That is the right way for
    this to fail: the picture stays up.

    ## What belongs to the asset rather than to the use

    ``alt`` above all. It describes the image, not the place the image appears,
    so it is written once and every later use inherits it — which is the whole
    reason a library beats a ``gallery`` column on each table. Width and height
    are here so a gallery can reserve the right box before the bytes arrive
    rather than reflowing the page around each one as it lands.
    """

    __tablename__ = "media_assets"

    # `created_at` comes from BaseModel, which every table shares and none of
    # them index. The library is only ever read newest-first, so here the sort
    # *is* the access pattern — but the index has to be declared on this table
    # rather than by adding `index=True` to the base, which would silently put
    # one on every table in the schema.
    #
    # Declared at all because `alembic check` compares the model to the
    # database: the migration created this index and the model did not know
    # about it, so the next autogenerate would have proposed dropping it.
    __table_args__ = (Index("ix_media_assets_created_at", "created_at"),)

    # Unique, so registering the same upload twice is a no-op rather than a
    # duplicate row. Blob's `addRandomSuffix` makes collisions between distinct
    # uploads impossible, so a repeat here only ever means a retry.
    url = Column(String(1000), unique=True, index=True, nullable=False)
    # Blob's own path — the filename plus that random suffix. Kept because it
    # addresses the object for a later delete, and because the original filename
    # is the only human-readable handle a library has to search on.
    pathname = Column(String(1000))
    # Nullable, and deliberately not defaulted from the filename: wrong alt text
    # is worse than none, and "screenshot-3-a8f2.png" read aloud is worse than
    # silence.
    alt = Column(String(500))
    mime = Column(String(100))
    size_bytes = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
