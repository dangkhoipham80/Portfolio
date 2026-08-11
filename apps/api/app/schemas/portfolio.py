from datetime import date, datetime
from typing import Annotated, List, Optional

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, StringConstraints

from app.models.portfolio import ProjectStatus, SkillLevel


def _no_null_list(value):
    """Read a nullable JSON column as an empty list rather than ``None``.

    The columns are nullable and rows written before this change have NULL in
    them, which fails ``List[str]`` validation — as a 500 on a public GET,
    because the error surfaces during response serialisation.
    """
    return [] if value is None else value


StringList = Annotated[List[str], BeforeValidator(_no_null_list)]


# Project Schemas
class ProjectBase(BaseModel):
    title: str
    description: str
    long_description: Optional[str] = None
    image_url: Optional[str] = None
    github_url: Optional[str] = None
    live_url: Optional[str] = None
    technologies: StringList = []
    features: StringList = []
    challenges: StringList = []
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    status: ProjectStatus = ProjectStatus.COMPLETED
    featured: bool = False
    published: bool = False
    order: int = 0

class ProjectCreate(ProjectBase):
    # Optional on create: left out, it is derived from the title.
    slug: Optional[str] = None

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    long_description: Optional[str] = None
    image_url: Optional[str] = None
    github_url: Optional[str] = None
    live_url: Optional[str] = None
    technologies: Optional[List[str]] = None
    features: Optional[List[str]] = None
    challenges: Optional[List[str]] = None
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    status: Optional[ProjectStatus] = None
    featured: Optional[bool] = None
    published: Optional[bool] = None
    order: Optional[int] = None

class Project(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# Skill Schemas
class SkillBase(BaseModel):
    name: str
    category: str
    level: SkillLevel = SkillLevel.BEGINNER
    icon: Optional[str] = None
    order: int = 0

class SkillCreate(SkillBase):
    pass

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    level: Optional[SkillLevel] = None
    icon: Optional[str] = None
    order: Optional[int] = None

class Skill(SkillBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

# Certificate Schemas
class CertificateBase(BaseModel):
    title: str
    issuer: str
    issue_date: datetime
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    skills: StringList = []
    published: bool = False

class CertificateCreate(CertificateBase):
    slug: Optional[str] = None

class CertificateUpdate(BaseModel):
    title: Optional[str] = None
    issuer: Optional[str] = None
    issue_date: Optional[datetime] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    skills: Optional[List[str]] = None
    published: Optional[bool] = None

class Certificate(CertificateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# Career Schemas
class CareerEntryBase(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    started_on: date
    ended_on: Optional[date] = None
    highlights: StringList = []
    published: bool = False

class CareerEntryCreate(CareerEntryBase):
    slug: Optional[str] = None

class CareerEntryUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    highlights: Optional[List[str]] = None
    published: Optional[bool] = None

class CareerEntry(CareerEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# Post Schemas
class PostBase(BaseModel):
    title: str
    excerpt: Optional[str] = None
    # Markdown. See the note on the model: the API neither renders nor
    # sanitises it, because it is not HTML on the way in or the way out.
    body: str
    tags: StringList = []
    cover_image: Optional[str] = None
    published: bool = False
    # Writable so a post can be backdated to when it was actually written. Left
    # out, the service stamps it the first time the post is published.
    published_at: Optional[datetime] = None

class PostCreate(PostBase):
    slug: Optional[str] = None

class PostUpdate(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None
    cover_image: Optional[str] = None
    published: Optional[bool] = None
    published_at: Optional[datetime] = None

class Post(PostBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# Contact Schemas
class ContactBase(BaseModel):
    name: str
    email: str
    subject: str
    message: str

class ContactCreate(ContactBase):
    """The public contact form's payload — the only unauthenticated write.

    Constraints live here rather than on ``ContactBase`` on purpose. ``Contact``
    is the *response* model and inherits the same base, so a stricter base would
    validate on the way out too: any row already in the table with a malformed
    address — every row is one, since nothing validated until now — would 500
    the admin ``GET /contacts`` instead of being readable.

    The max lengths are the column widths from ``models/portfolio.py``, not
    invented numbers. Without them an over-long name reached Postgres and came
    back as a DataError 500; ``message`` is a TEXT column with no width, so the
    5000 is a judgement about what a contact form is for and is the one figure
    here the database does not dictate.

    ``str_strip_whitespace`` runs before the length checks, so a field of spaces
    fails ``min_length`` rather than storing blank.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    name: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    email: Annotated[EmailStr, StringConstraints(max_length=255)]
    subject: Annotated[str, StringConstraints(min_length=1, max_length=255)]
    message: Annotated[str, StringConstraints(min_length=1, max_length=5000)]

class Contact(ContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    read: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
