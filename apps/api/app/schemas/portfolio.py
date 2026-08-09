from datetime import date, datetime
from typing import Annotated, List, Optional

from pydantic import BaseModel, BeforeValidator, ConfigDict

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

# Contact Schemas
class ContactBase(BaseModel):
    name: str
    email: str
    subject: str
    message: str

class ContactCreate(ContactBase):
    pass

class Contact(ContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    read: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
