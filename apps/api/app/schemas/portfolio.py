from datetime import date, datetime
from typing import Annotated, List, Optional

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
)

from app.models.portfolio import CommentStatus, PostFormat, ProjectStatus, SkillLevel


def _no_null_list(value):
    """Read a nullable JSON column as an empty list rather than ``None``.

    The columns are nullable and rows written before this change have NULL in
    them, which fails ``List[str]`` validation — as a 500 on a public GET,
    because the error surfaces during response serialisation.
    """
    return [] if value is None else value


StringList = Annotated[List[str], BeforeValidator(_no_null_list)]


class ProjectLink(BaseModel):
    """One labelled link beyond source and live.

    The label is required and short: an unlabelled link renders as a button with
    nothing written on it, and the detail page lays these out in a row where a
    sentence-long label would break the line.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    label: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    url: Annotated[str, StringConstraints(min_length=1, max_length=500)]


LinkList = Annotated[List[ProjectLink], BeforeValidator(_no_null_list)]


class GalleryImage(BaseModel):
    """A gallery entry as the API *returns* it, which is not how it is stored.

    The column holds bare URL strings. Alt text and dimensions are looked up
    from ``media_assets`` on the way out, so a consumer can render the image
    accessibly and without reflow while the project row stays a plain list of
    strings and a description still lives in exactly one place.

    Everything but the URL is optional, because a gallery may reference an image
    the library has never seen — one pasted in by hand, or uploaded before the
    library existed. It renders; it just has nothing to say about itself.
    """

    url: str
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


def _as_gallery(value):
    """Accept the stored form (a list of URLs) or the resolved form (objects).

    Reading straight off the ORM row gives strings; the presenter in
    endpoints/projects.py replaces them with resolved objects. Both have to
    validate, or the same schema could not describe the column and the response.
    """
    if value is None:
        return []
    return [{"url": item} if isinstance(item, str) else item for item in value]


GalleryList = Annotated[List[GalleryImage], BeforeValidator(_as_gallery)]


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
    links: LinkList = []
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    status: ProjectStatus = ProjectStatus.COMPLETED
    featured: bool = False
    published: bool = False
    order: int = 0

class ProjectCreate(ProjectBase):
    # Optional on create: left out, it is derived from the title.
    slug: Optional[str] = None
    # Written as bare URLs, unlike the response — see GalleryImage. Accepting
    # objects here as well would invite a client to send alt text, which this
    # table has no column for and would silently drop.
    gallery: StringList = []

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
    gallery: Optional[List[str]] = None
    links: Optional[List[ProjectLink]] = None
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
    gallery: GalleryList = []
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

# Tag Schemas
class TagBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    description: Optional[Annotated[str, StringConstraints(max_length=280)]] = None


class TagCreate(TagBase):
    # Optional on create and fixed afterwards, like every other slug here: it is
    # the tag's URL, and regenerating it on a rename breaks any link to it.
    slug: Optional[Annotated[str, StringConstraints(max_length=120)]] = None


class TagUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[Annotated[str, StringConstraints(min_length=1, max_length=60)]] = None
    description: Optional[Annotated[str, StringConstraints(max_length=280)]] = None


class TagRef(BaseModel):
    """A tag as it appears *inside* a post.

    Slug and name both, because the consumer needs one for the link and the
    other for the label, and deriving either from the other is what the split
    exists to avoid.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str


class Tag(TagRef):
    description: Optional[str] = None
    # How many posts carry it — published-only for an anonymous caller, so the
    # facet counts on the public index add up to what is actually listed.
    # Filled in by the route; see endpoints/tags.py.
    post_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


# Series Schemas
class SeriesBase(BaseModel):
    title: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    published: bool = False


class SeriesCreate(SeriesBase):
    slug: Optional[str] = None


class SeriesUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    published: Optional[bool] = None


class SeriesRef(BaseModel):
    """A series as it appears inside a post — no post list, or this recurses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str


class Series(SeriesRef):
    description: Optional[str] = None
    cover_image: Optional[str] = None
    published: bool = False
    # Filled by the route from the posts actually visible to this caller.
    post_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


# Post Schemas
class PostBase(BaseModel):
    title: str
    excerpt: Optional[str] = None
    # Markdown or MDX, per `format`. See the note on the model: the API neither
    # renders nor sanitises it, because it is not HTML on the way in or out.
    body: str
    format: PostFormat = PostFormat.MARKDOWN
    cover_image: Optional[str] = None
    published: bool = False
    # Writable so a post can be backdated to when it was actually written. Left
    # out, the service stamps it the first time the post is published.
    published_at: Optional[datetime] = None
    series_order: int = 0


class PostWrite(BaseModel):
    """The half of a post's payload that is a reference to something else.

    Tags arrive as slugs of rows that already exist, and a slug matching nothing
    is a 422 naming it rather than a tag invented on the spot. That is the point
    of tags being rows: a typo has to fail loudly, or the index grows a facet
    holding one post that nobody meant to create.

    ``series_slug`` is the same, with null meaning "not in a series" — which is
    why it is spelled as its own field rather than folded into PostUpdate's
    optionals, where null already means "leave alone".
    """

    tag_slugs: Optional[List[str]] = None
    series_slug: Optional[str] = None


class PostCreate(PostBase, PostWrite):
    slug: Optional[str] = None


class PostUpdate(PostWrite):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    format: Optional[PostFormat] = None
    cover_image: Optional[str] = None
    published: Optional[bool] = None
    published_at: Optional[datetime] = None
    series_order: Optional[int] = None
    # What changed, recorded on the revision this update creates. Never stored
    # on the post itself.
    revision_note: Optional[Annotated[str, StringConstraints(max_length=280)]] = None


class Post(PostBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    # Objects, not strings. The web app needs the slug to build a tag URL and
    # the name to print, and a bare string can only supply one of them — which
    # is the reason this stopped being a JSON list of names. Ordered by name in
    # the relationship, so the chips under a post do not reshuffle between
    # requests.
    tags: List[TagRef] = []
    series: Optional[SeriesRef] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class PostRevision(BaseModel):
    """A past version of a post. Admin-only; never served publicly."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    title: str
    excerpt: Optional[str] = None
    body: str
    format: PostFormat = PostFormat.MARKDOWN
    tag_slugs: StringList = []
    note: Optional[str] = None
    created_at: datetime


# Comment Schemas
class PostCommentCreate(BaseModel):
    """What a reader posts. The only unauthenticated write besides the contact form.

    Lengths are the column widths from models/portfolio.py, with one exception:
    ``body`` is TEXT and has none, so the 4000 is a judgement about what a
    comment is rather than something the database dictates.

    The email is required and never published — see the model. Validating it as
    an address is not identity verification and is not treated as any; it is
    there so a typo is caught at the form rather than discovered when a reply
    bounces.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    author_name: Annotated[str, StringConstraints(min_length=1, max_length=80)]
    author_email: Annotated[EmailStr, StringConstraints(max_length=255)]
    body: Annotated[str, StringConstraints(min_length=2, max_length=4000)]
    # A top-level comment on the same post. Anything else is rejected by the
    # route, which is where the post is known.
    parent_id: Optional[int] = None


class PostComment(BaseModel):
    """A comment as the public sees it.

    No ``author_email`` and no ``author_hash``, and their absence is the point:
    this model is what makes the route incapable of leaking either. Adding a
    field to the model is the only way they could appear, which is a visible
    edit in review rather than a filter someone forgets to apply.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    parent_id: Optional[int] = None
    author_name: str
    body: str
    created_at: datetime


class PostCommentAdmin(PostComment):
    """The moderation view: the same comment, plus what decides its fate."""

    author_email: str
    status: CommentStatus
    author_hash: Optional[str] = None
    # Which post it is on, so the queue can link to it without a second request.
    post_slug: Optional[str] = None
    post_title: Optional[str] = None


class PostCommentModerate(BaseModel):
    status: CommentStatus


# Rating Schemas
class PostRatingCreate(BaseModel):
    stars: Annotated[int, Field(ge=1, le=5)]


class PostRatingSummary(BaseModel):
    """A post's score, and enough of the shape to be honest about it.

    ``count`` sits next to ``average`` everywhere it is shown: 5.0 from one vote
    and 4.6 from fifty are not the same claim, and an average alone cannot tell
    them apart. ``distribution`` is the five bucket counts, low to high, so the
    reader can see a bimodal split rather than a mean hiding it.
    """

    average: float = 0.0
    count: int = 0
    distribution: List[int] = [0, 0, 0, 0, 0]
    # This caller's own vote, if they have one. Lets the control show what they
    # chose instead of asking again.
    mine: Optional[int] = None

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


# Media Schemas
class MediaAssetBase(BaseModel):
    alt: Optional[Annotated[str, StringConstraints(max_length=500)]] = None


class MediaAssetCreate(MediaAssetBase):
    """What the console posts once Blob has taken the bytes.

    Every field but the URL is optional because every field but the URL is
    something the browser had to measure or was told by the upload, and a
    registration that fails because an image's dimensions could not be read
    would leave exactly the orphan this table exists to prevent. A row that
    knows only where the object is still beats no row.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    url: Annotated[str, StringConstraints(min_length=1, max_length=1000)]
    pathname: Optional[Annotated[str, StringConstraints(max_length=1000)]] = None
    mime: Optional[Annotated[str, StringConstraints(max_length=100)]] = None
    size_bytes: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None


class MediaAssetUpdate(MediaAssetBase):
    """Alt text and nothing else.

    The URL, size and dimensions are facts about an object in a bucket; they are
    not editable, and offering to edit them would be offering to make this table
    disagree with Blob. Alt text is the one field a person writes.
    """


class MediaAsset(MediaAssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    pathname: Optional[str] = None
    mime: Optional[str] = None
    size_bytes: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
