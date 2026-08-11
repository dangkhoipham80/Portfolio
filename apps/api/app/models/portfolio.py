import enum

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Enum, Integer, String, Text

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
