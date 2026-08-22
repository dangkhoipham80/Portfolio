import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base

from .base import BaseModel


class ProjectStatus(enum.Enum):
    COMPLETED = "completed"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    DROPPED = "dropped"


class PostFormat(enum.Enum):
    """How a post's ``body`` should be read.

    Markdown is the safe default and what every existing row is. MDX is
    Markdown plus a fixed set of components the site provides — callouts,
    figures, embeds — and nothing else: the web app compiles it with imports and
    exports rejected, so a body cannot pull in code. See apps/web/lib/mdx.tsx,
    which is the only place either format is ever rendered.
    """

    MARKDOWN = "markdown"
    MDX = "mdx"


class CommentStatus(enum.Enum):
    """Where a comment is in moderation.

    Default is PENDING and the public read filters to APPROVED, so the failure
    mode of forgetting to think about this is a comment nobody sees rather than
    spam on the site. Nothing promotes a comment automatically.
    """

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


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


# The many-to-many between posts and tags.
#
# A plain Table rather than a mapped class: it carries no columns of its own and
# never needs to be queried directly, so a model for it would be a class whose
# only purpose is to be joined through. The composite primary key is what stops
# the same tag being attached to the same post twice — the console can post a
# duplicate and the database will refuse it rather than the list quietly growing
# two identical chips.
post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", Integer, ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(BaseModel):
    """A subject a post can be filed under.

    ## Why this is a table and not the JSON column it replaced

    ``posts.tags`` used to be ``list[str]``. That works right up to the moment a
    tag has to be a thing rather than a word. It cannot be renamed — "nextjs"
    to "Next.js" means rewriting every row that carries it, and missing one
    leaves two tags that look like one. It cannot carry a description, so a tag
    page has nothing to say beyond the list under it. And it has no stable
    identity, so ``/blog/tag/nextjs`` breaks the day the spelling changes.

    Splitting name from slug fixes all three: the slug is the URL and is fixed
    at creation, the name is display text and can be edited freely.

    ## Why tags are created rather than typed

    The console picks from existing tags and offers to create one explicitly.
    Free-text tagging produces "api", "API" and "apis" within a month, and the
    reader is the one who pays — three facets that should have been one, each
    holding a third of the posts.
    """

    __tablename__ = "tags"

    slug = Column(String(120), unique=True, index=True, nullable=False)
    name = Column(String(60), nullable=False)
    # Shown as the standfirst on the tag's own page. Optional: most tags are
    # self-explanatory and an invented sentence under each one is noise.
    description = Column(String(280))


class Series(BaseModel):
    """An ordered run of posts on one subject.

    Distinct from a tag, and the difference is order. A tag is a set — the posts
    carrying it have no sequence and adding one does not change the others. A
    series is a list: part 3 assumes part 2, and the reader needs a next link
    rather than a facet. Modelling both as tags would mean the reader could not
    tell which of the two they were looking at.

    A post belongs to at most one series (``posts.series_id``), because
    belonging to two makes "next" ambiguous and there is no interface that can
    answer it honestly.
    """

    __tablename__ = "series"

    slug = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    cover_image = Column(String(500))
    published = Column(Boolean, nullable=False, default=False)


class Post(BaseModel):
    """A blog post.

    ``body`` holds Markdown or MDX — see ``format`` — never HTML. The API stores
    and returns it verbatim and never renders it; the web app does that
    server-side, so no untrusted HTML is stored here waiting to be trusted by
    whatever reads the column next.
    """

    __tablename__ = "posts"

    slug = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    # Shown on the index card and used as the meta description. Optional: a
    # post without one falls back to the opening of the body.
    excerpt = Column(Text)
    body = Column(Text, nullable=False)
    format = Column(
        Enum(PostFormat), nullable=False, default=PostFormat.MARKDOWN, server_default="MARKDOWN"
    )
    cover_image = Column(String(500))
    published = Column(Boolean, nullable=False, default=False)
    # When the post first went live, which is not `created_at` — that is when
    # the draft row was made, and a post written over a fortnight would carry
    # the wrong date into the feed and the sitemap. Null until it is published.
    published_at = Column(DateTime(timezone=True))

    series_id = Column(Integer, ForeignKey("series.id", ondelete="SET NULL"), index=True)
    # Position within the series, lowest first. Meaningless without a series and
    # ignored when there is none.
    #
    # SET NULL rather than CASCADE above: deleting a series must not delete the
    # posts in it. The series is a way of reading them, not what they are.
    series_order = Column(Integer, nullable=False, default=0, server_default="0")

    # `lazy="selectin"` so listing posts costs one extra query for the whole
    # page rather than one per post. The index reads every post's tags to build
    # its facets, which is exactly the N+1 the default lazy load would produce.
    tags = relationship(
        "Tag",
        secondary=post_tags,
        back_populates="posts",
        lazy="selectin",
        order_by="Tag.name",
    )
    series = relationship("Series", back_populates="posts", lazy="joined")
    # The ORM owns these deletes rather than the database, so a post removed
    # through the service takes its comments, ratings and history with it
    # whatever the connection's foreign-key enforcement happens to be — SQLite
    # ignores ON DELETE unless a pragma is set, and the test suite runs on it.
    comments = relationship(
        "PostComment", back_populates="post", cascade="all, delete-orphan", passive_deletes=True
    )
    ratings = relationship(
        "PostRating", back_populates="post", cascade="all, delete-orphan", passive_deletes=True
    )
    revisions = relationship(
        "PostRevision",
        back_populates="post",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="PostRevision.id.desc()",
    )


Tag.posts = relationship("Post", secondary=post_tags, back_populates="tags")
Series.posts = relationship(
    "Post", back_populates="series", order_by="Post.series_order, Post.id"
)


class PostRevision(BaseModel):
    """A post as it was before an edit.

    Written by the service on every admin update, holding the values that are
    about to be overwritten — so revision *n* is the state the post left, not
    the state it arrived at, and the current row is always the newest version.
    That ordering matters when restoring: picking a revision means "put the post
    back the way it was at that point", and there is no revision for the present
    because the post itself is it.

    Only the fields a person writes are kept. ``published`` and ``published_at``
    are not history — restoring an old body must not silently unpublish a post
    or move a date already sitting in someone's feed reader.
    """

    __tablename__ = "post_revisions"

    __table_args__ = (Index("ix_post_revisions_post_id_id", "post_id", "id"),)

    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(255), nullable=False)
    excerpt = Column(Text)
    body = Column(Text, nullable=False)
    format = Column(Enum(PostFormat), nullable=False, default=PostFormat.MARKDOWN)
    # Tag *slugs*, as a snapshot. Deliberately not a relationship: history has
    # to survive the tag being deleted, and a foreign key would either block
    # that delete or erase the fact that the post once carried it.
    tag_slugs = Column(JSON)  # list[str]
    # What the edit was, when the admin bothered to say. Free text.
    note = Column(String(280))

    post = relationship("Post", back_populates="revisions")


class PostComment(BaseModel):
    """A reader's comment, pending until an admin approves it.

    ## Why there is no account

    Comments take a name and an email and nothing else. Requiring a login on a
    portfolio blog is asking a stranger to sign up in order to say one sentence,
    which mostly means nobody says anything. The cost is that a name is a claim
    rather than a fact, so nothing here is presented as verified.

    ## Why the email is stored but never returned

    It is how the owner replies, and it is a weak signal of the same person
    commenting twice. It is not in the public schema — see ``schemas`` — so it
    cannot leak through the response model by someone adding a field.

    ## Threading is one level deep

    ``parent_id`` points at a top-level comment and replies cannot themselves be
    replied to. Arbitrary depth needs indentation the layout does not have below
    375px, and a two-level thread is what a comment section on a technical post
    actually uses.
    """

    __tablename__ = "post_comments"

    # The public read is always "approved comments on this post, oldest first".
    __table_args__ = (Index("ix_post_comments_post_id_status", "post_id", "status"),)

    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id = Column(Integer, ForeignKey("post_comments.id", ondelete="CASCADE"), index=True)
    author_name = Column(String(80), nullable=False)
    author_email = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(
        Enum(CommentStatus), nullable=False, default=CommentStatus.PENDING, server_default="PENDING"
    )
    # Salted hash of the submitter's address, for rate limiting and for spotting
    # a run of comments from one source in the moderation queue. Not the address
    # itself: an IP log on a blog is a liability with no matching use.
    author_hash = Column(String(64), index=True)

    post = relationship("Post", back_populates="comments")


# Declared after the class rather than inside it because the many-to-one half
# needs `remote_side=[PostComment.id]`, and `id` comes from BaseModel — it is
# not a name in this class's body, so it does not exist until the class does.
PostComment.replies = relationship(
    "PostComment",
    back_populates="parent",
    cascade="all, delete-orphan",
    passive_deletes=True,
    order_by="PostComment.id",
)
PostComment.parent = relationship(
    "PostComment",
    back_populates="replies",
    remote_side=[PostComment.id],
)


class PostRating(BaseModel):
    """One reader's score for one post, out of five.

    ## What a vote is keyed on

    ``voter_hash`` — a salted digest of the caller's address and user agent. The
    unique constraint with ``post_id`` is what makes a second vote an update
    rather than a new row, so a post's average cannot be moved by refreshing.

    It is a weak key and that is the accepted limit: a different browser, or a
    different network, is a different voter. The alternative is an account, and
    an account is a much larger thing to ask for than a star. What it does stop
    is the only attack that actually happens here, which is somebody clicking
    five stars twenty times.

    The address is never stored — only the digest, and the salt lives in the
    application secret, so the table cannot be turned back into a list of who
    read what.
    """

    __tablename__ = "post_ratings"

    __table_args__ = (
        UniqueConstraint("post_id", "voter_hash", name="uq_post_ratings_post_voter"),
    )

    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stars = Column(Integer, nullable=False)
    voter_hash = Column(String(64), nullable=False)

    post = relationship("Post", back_populates="ratings")


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
