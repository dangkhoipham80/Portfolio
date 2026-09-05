from datetime import datetime, timezone
from typing import List, Optional, Sequence, Tuple

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.constants import ErrorMessages
from app.core.exceptions import ValidationError
from app.core.slugs import unique_slug
from app.models.portfolio import (
    CareerEntry,
    Certificate,
    CommentStatus,
    Contact,
    Post,
    PostComment,
    PostRating,
    PostRevision,
    Project,
    Series,
    Skill,
    Tag,
    post_tags,
)
from app.schemas.portfolio import (
    CareerEntryCreate,
    CareerEntryUpdate,
    CertificateCreate,
    CertificateUpdate,
    ContactCreate,
    PostCommentCreate,
    PostCreate,
    PostUpdate,
    ProjectCreate,
    ProjectUpdate,
    SeriesCreate,
    SeriesUpdate,
    SkillCreate,
    SkillUpdate,
    TagCreate,
    TagUpdate,
)

# Fields on the post payloads that are references to other rows rather than
# columns. They are resolved by hand and must never reach `setattr` — a
# `series_slug` attribute on a Post row would be silently accepted by Python and
# silently dropped by SQLAlchemy.
POST_REFERENCE_FIELDS = frozenset({"tag_slugs", "series_slug", "revision_note"})


def _escape_like(term: str) -> str:
    """Make a reader's search term mean itself inside a LIKE pattern.

    The backslash has to go first, or it re-escapes the escapes added after it.
    """
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class PortfolioService:
    """Reads and writes portfolio content.

    Every read takes ``include_unpublished``, which defaults to False. Callers
    that want drafts have to ask for them, so a route that forgets to think
    about visibility leaks nothing — it just shows the published set.
    """

    def __init__(self, db: Session):
        self.db = db

    def _create_with_slug(
        self, model, payload, title_field: str = "title", prepare=None, skip=frozenset()
    ):
        """Insert a slugged row, deriving the slug from its title if absent.

        ``prepare`` runs on the built row before it is added, for fields the
        payload does not carry — the publication stamp is the only one so far.

        ``skip`` names payload fields that are not columns, so the caller can
        resolve them itself. Without it, ``model(**data)`` raises on the first
        field the table has never heard of.
        """
        data = {k: v for k, v in payload.model_dump().items() if k not in skip}
        requested = data.pop("slug", None) or getattr(payload, title_field)
        data["slug"] = unique_slug(self.db, model, requested)

        record = model(**data)
        if prepare is not None:
            prepare(record)
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    @staticmethod
    def _apply_update(record, payload, skip=frozenset()) -> None:
        # exclude_unset, not exclude_none: a PATCH-style body that explicitly
        # sends `"ended_on": null` means "clear this", and dropping nulls would
        # make an ongoing project impossible to mark ongoing again.
        for field, value in payload.model_dump(exclude_unset=True).items():
            if field in skip:
                continue
            setattr(record, field, value)

    # Project methods
    def get_projects(
        self,
        featured_only: bool = False,
        include_unpublished: bool = False,
    ) -> List[Project]:
        query = self.db.query(Project)
        if not include_unpublished:
            query = query.filter(Project.published.is_(True))
        if featured_only:
            query = query.filter(Project.featured.is_(True))
        return query.order_by(Project.order, Project.id).all()

    def get_project(
        self, project_id: int, include_unpublished: bool = False
    ) -> Optional[Project]:
        query = self.db.query(Project).filter(Project.id == project_id)
        if not include_unpublished:
            query = query.filter(Project.published.is_(True))
        return query.first()

    def get_project_by_slug(
        self, slug: str, include_unpublished: bool = False
    ) -> Optional[Project]:
        query = self.db.query(Project).filter(Project.slug == slug)
        if not include_unpublished:
            query = query.filter(Project.published.is_(True))
        return query.first()

    def create_project(self, project: ProjectCreate) -> Project:
        return self._create_with_slug(Project, project)

    def update_project(self, project_id: int, project: ProjectUpdate) -> Optional[Project]:
        db_project = self.get_project(project_id, include_unpublished=True)
        if not db_project:
            return None

        self._apply_update(db_project, project)
        self.db.commit()
        self.db.refresh(db_project)
        return db_project

    def delete_project(self, project_id: int) -> bool:
        db_project = self.get_project(project_id, include_unpublished=True)
        if not db_project:
            return False

        self.db.delete(db_project)
        self.db.commit()
        return True

    # Skill methods
    def get_skills(self, category: Optional[str] = None) -> List[Skill]:
        query = self.db.query(Skill)
        if category:
            query = query.filter(Skill.category == category)
        return query.order_by(Skill.order, Skill.id).all()

    def get_skill(self, skill_id: int) -> Optional[Skill]:
        return self.db.query(Skill).filter(Skill.id == skill_id).first()

    def create_skill(self, skill: SkillCreate) -> Skill:
        db_skill = Skill(**skill.model_dump())
        self.db.add(db_skill)
        self.db.commit()
        self.db.refresh(db_skill)
        return db_skill

    def update_skill(self, skill_id: int, skill: SkillUpdate) -> Optional[Skill]:
        db_skill = self.get_skill(skill_id)
        if not db_skill:
            return None

        self._apply_update(db_skill, skill)
        self.db.commit()
        self.db.refresh(db_skill)
        return db_skill

    def delete_skill(self, skill_id: int) -> bool:
        db_skill = self.get_skill(skill_id)
        if not db_skill:
            return False

        self.db.delete(db_skill)
        self.db.commit()
        return True

    # Certificate methods
    def get_certificates(
        self,
        category: Optional[str] = None,
        include_unpublished: bool = False,
    ) -> List[Certificate]:
        query = self.db.query(Certificate)
        if not include_unpublished:
            query = query.filter(Certificate.published.is_(True))
        if category:
            query = query.filter(Certificate.category == category)
        return query.order_by(Certificate.issue_date.desc()).all()

    def get_certificate(
        self, certificate_id: int, include_unpublished: bool = False
    ) -> Optional[Certificate]:
        query = self.db.query(Certificate).filter(Certificate.id == certificate_id)
        if not include_unpublished:
            query = query.filter(Certificate.published.is_(True))
        return query.first()

    def get_certificate_by_slug(
        self, slug: str, include_unpublished: bool = False
    ) -> Optional[Certificate]:
        query = self.db.query(Certificate).filter(Certificate.slug == slug)
        if not include_unpublished:
            query = query.filter(Certificate.published.is_(True))
        return query.first()

    def create_certificate(self, certificate: CertificateCreate) -> Certificate:
        return self._create_with_slug(Certificate, certificate)

    def update_certificate(
        self, certificate_id: int, certificate: CertificateUpdate
    ) -> Optional[Certificate]:
        db_certificate = self.get_certificate(certificate_id, include_unpublished=True)
        if not db_certificate:
            return None

        self._apply_update(db_certificate, certificate)
        self.db.commit()
        self.db.refresh(db_certificate)
        return db_certificate

    def delete_certificate(self, certificate_id: int) -> bool:
        db_certificate = self.get_certificate(certificate_id, include_unpublished=True)
        if not db_certificate:
            return False

        self.db.delete(db_certificate)
        self.db.commit()
        return True

    # Career methods
    def get_career_entries(self, include_unpublished: bool = False) -> List[CareerEntry]:
        query = self.db.query(CareerEntry)
        if not include_unpublished:
            query = query.filter(CareerEntry.published.is_(True))
        # Newest first, which is how a CV reads.
        return query.order_by(CareerEntry.started_on.desc()).all()

    def get_career_entry(
        self, entry_id: int, include_unpublished: bool = False
    ) -> Optional[CareerEntry]:
        query = self.db.query(CareerEntry).filter(CareerEntry.id == entry_id)
        if not include_unpublished:
            query = query.filter(CareerEntry.published.is_(True))
        return query.first()

    def create_career_entry(self, entry: CareerEntryCreate) -> CareerEntry:
        return self._create_with_slug(CareerEntry, entry)

    def update_career_entry(
        self, entry_id: int, entry: CareerEntryUpdate
    ) -> Optional[CareerEntry]:
        db_entry = self.get_career_entry(entry_id, include_unpublished=True)
        if not db_entry:
            return None

        self._apply_update(db_entry, entry)
        self.db.commit()
        self.db.refresh(db_entry)
        return db_entry

    def delete_career_entry(self, entry_id: int) -> bool:
        db_entry = self.get_career_entry(entry_id, include_unpublished=True)
        if not db_entry:
            return False

        self.db.delete(db_entry)
        self.db.commit()
        return True

    # Post methods
    @staticmethod
    def _stamp_publication(record) -> None:
        """Record when a post first went live.

        Set once and never moved. Unpublishing a post to fix a typo and
        publishing it again keeps the original date, so the index does not
        reshuffle and a date already sitting in someone's feed reader stays
        true. An explicit ``published_at`` in the payload wins over this — that
        is how a post gets backdated.
        """
        if record.published and record.published_at is None:
            record.published_at = datetime.now(timezone.utc)

    def _resolve_tags(self, slugs: Optional[Sequence[str]]) -> Optional[List[Tag]]:
        """Turn a list of tag slugs into rows, refusing any that do not exist.

        None means "the payload said nothing about tags", which is not the same
        as ``[]`` — that means "remove them all" — so it is passed straight back
        for the caller to leave the relationship alone.

        An unknown slug is a 422 that names every missing one at once, rather
        than the first. The console shows the message verbatim, and fixing three
        typos one round trip at a time is three times the work for no reason.
        """
        if slugs is None:
            return None

        wanted = list(dict.fromkeys(slug.strip() for slug in slugs if slug.strip()))
        if not wanted:
            return []

        found = self.db.query(Tag).filter(Tag.slug.in_(wanted)).all()
        missing = sorted(set(wanted) - {tag.slug for tag in found})

        if missing:
            raise ValidationError(
                f"No tag exists with the slug {', '.join(missing)}. "
                "Create the tag first, then attach it."
            )

        # Ordered as the caller asked, not as the database returned them.
        by_slug = {tag.slug: tag for tag in found}
        return [by_slug[slug] for slug in wanted]

    def _resolve_series(self, slug: Optional[str]) -> Optional[Series]:
        if not slug:
            return None

        record = self.db.query(Series).filter(Series.slug == slug).first()
        if record is None:
            raise ValidationError(f"No series exists with the slug {slug}.")
        return record

    def _apply_post_references(self, record: Post, payload) -> None:
        """Attach the tags and the series named by a post payload.

        Both are resolved before anything is written, so a payload naming a tag
        that does not exist leaves the post exactly as it was rather than
        half-applied.
        """
        tags = self._resolve_tags(getattr(payload, "tag_slugs", None))
        if tags is not None:
            record.tags = tags

        # `series_slug` is only meaningful when the client sent it. Unset means
        # "leave the series alone"; an explicit null means "take it out of the
        # series", and those have to stay distinguishable on an update.
        if "series_slug" in payload.model_fields_set:
            record.series = self._resolve_series(payload.series_slug)

    def get_posts(
        self,
        tag: Optional[str] = None,
        series: Optional[str] = None,
        q: Optional[str] = None,
        include_unpublished: bool = False,
    ) -> List[Post]:
        query = self.db.query(Post)
        if not include_unpublished:
            query = query.filter(Post.published.is_(True))

        if tag:
            # A join now that tags are rows, rather than the old scan in Python
            # over a JSON column — which was there because Postgres has no
            # containment operator for `json`. That constraint is gone with the
            # column.
            query = query.join(post_tags, post_tags.c.post_id == Post.id).join(
                Tag, Tag.id == post_tags.c.tag_id
            ).filter(Tag.slug == tag)

        if series:
            query = query.join(Series, Series.id == Post.series_id).filter(
                Series.slug == series
            )

        if q:
            # Title, excerpt and body, case-insensitively. `ilike` rather than a
            # full-text index: the corpus is tens of posts, and a tsvector
            # column would need its own migration, its own trigger and a
            # language choice to answer a query this size no faster.
            #
            # The term is escaped, not just parameterised. Binding stops SQL
            # injection but does nothing about LIKE's own metacharacters, and
            # they are ordinary things to search for: a query of "%" became the
            # pattern "%%%" and matched every post on the site, while "100%
            # faster" silently matched far more than it should. Underscore is
            # the same trap and quieter, since it matches any single character.
            pattern = f"%{_escape_like(q.strip())}%"
            query = query.filter(
                or_(
                    Post.title.ilike(pattern, escape="\\"),
                    Post.excerpt.ilike(pattern, escape="\\"),
                    Post.body.ilike(pattern, escape="\\"),
                )
            )

        # Newest first. Drafts have no publication date and sort to the end,
        # which is where the admin list wants them.
        return query.order_by(Post.published_at.desc().nullslast(), Post.id.desc()).all()

    def get_post(self, post_id: int, include_unpublished: bool = False) -> Optional[Post]:
        query = self.db.query(Post).filter(Post.id == post_id)
        if not include_unpublished:
            query = query.filter(Post.published.is_(True))
        return query.first()

    def get_post_by_slug(
        self, slug: str, include_unpublished: bool = False
    ) -> Optional[Post]:
        query = self.db.query(Post).filter(Post.slug == slug)
        if not include_unpublished:
            query = query.filter(Post.published.is_(True))
        return query.first()

    def create_post(self, post: PostCreate) -> Post:
        # References resolve first, so a bad tag slug 422s before a row exists.
        # The other order leaves an untagged post behind on every failed create.
        tags = self._resolve_tags(post.tag_slugs)
        series = self._resolve_series(post.series_slug)

        def attach(record: Post) -> None:
            self._stamp_publication(record)
            if tags is not None:
                record.tags = tags
            record.series = series

        return self._create_with_slug(
            Post, post, prepare=attach, skip=POST_REFERENCE_FIELDS
        )

    def update_post(self, post_id: int, post: PostUpdate) -> Optional[Post]:
        db_post = self.get_post(post_id, include_unpublished=True)
        if not db_post:
            return None

        # Before anything changes, and only when something is actually going to.
        # An update that sets `published` and nothing else is a publish toggle,
        # not an edit, and filling the history with "no change" entries would
        # bury the revisions a person actually wants to find.
        if self._touches_content(post):
            self._snapshot(db_post, note=post.revision_note)

        self._apply_update(db_post, post, skip=POST_REFERENCE_FIELDS)
        self._apply_post_references(db_post, post)
        self._stamp_publication(db_post)
        self.db.commit()
        self.db.refresh(db_post)
        return db_post

    # The fields a revision preserves. An update touching none of them has
    # nothing to record.
    _CONTENT_FIELDS = frozenset({"title", "excerpt", "body", "format", "tag_slugs"})

    @classmethod
    def _touches_content(cls, payload: PostUpdate) -> bool:
        return bool(cls._CONTENT_FIELDS & payload.model_fields_set)

    def _snapshot(self, record: Post, note: Optional[str] = None) -> PostRevision:
        """Record a post as it stands, before an edit overwrites it.

        Added to the session but not committed — the caller's commit covers both
        the snapshot and the edit, so a failure part-way cannot leave history
        claiming a change that did not happen.
        """
        revision = PostRevision(
            post_id=record.id,
            title=record.title,
            excerpt=record.excerpt,
            body=record.body,
            format=record.format,
            tag_slugs=[tag.slug for tag in record.tags],
            note=note,
        )
        self.db.add(revision)
        return revision

    def delete_post(self, post_id: int) -> bool:
        db_post = self.get_post(post_id, include_unpublished=True)
        if not db_post:
            return False

        self.db.delete(db_post)
        self.db.commit()
        return True

    # Revision methods
    def get_revisions(self, post_id: int) -> List[PostRevision]:
        return (
            self.db.query(PostRevision)
            .filter(PostRevision.post_id == post_id)
            .order_by(PostRevision.id.desc())
            .all()
        )

    def get_revision(self, post_id: int, revision_id: int) -> Optional[PostRevision]:
        return (
            self.db.query(PostRevision)
            .filter(PostRevision.id == revision_id, PostRevision.post_id == post_id)
            .first()
        )

    def restore_revision(self, post_id: int, revision_id: int) -> Optional[Post]:
        """Put a post back the way it was, keeping the version it is leaving.

        The restore is itself an edit, so it snapshots first — undoing a restore
        is then the same operation as any other undo, and nothing is lost by
        pressing the button on the wrong row.

        Tags are matched by slug against the tags that exist *now*. One that has
        since been deleted is dropped rather than recreated: the snapshot records
        what the post carried, not permission to resurrect a tag the owner
        removed on purpose.
        """
        db_post = self.get_post(post_id, include_unpublished=True)
        revision = self.get_revision(post_id, revision_id)
        if not db_post or not revision:
            return None

        self._snapshot(db_post, note=f"Before restoring revision {revision_id}")

        db_post.title = revision.title
        db_post.excerpt = revision.excerpt
        db_post.body = revision.body
        db_post.format = revision.format
        db_post.tags = (
            self.db.query(Tag).filter(Tag.slug.in_(revision.tag_slugs or [])).all()
        )

        self.db.commit()
        self.db.refresh(db_post)
        return db_post

    # Tag methods
    def get_tags(self, include_unpublished: bool = False) -> List[Tuple[Tag, int]]:
        """Every tag, with how many posts the caller can actually see under it.

        The count is part of the query rather than ``len(tag.posts)`` per row,
        which would be one round trip per tag, and it is filtered by the same
        visibility rule as the listing — otherwise a facet promises nine posts
        and delivers the two that are published.

        Tags with no visible posts are still returned. The console needs them to
        offer them, and the public routes drop empty ones themselves.
        """
        visible = self.db.query(post_tags.c.tag_id, func.count().label("n")).join(
            Post, Post.id == post_tags.c.post_id
        )
        if not include_unpublished:
            visible = visible.filter(Post.published.is_(True))
        counts = dict(visible.group_by(post_tags.c.tag_id).all())

        tags = self.db.query(Tag).order_by(Tag.name).all()
        return [(tag, counts.get(tag.id, 0)) for tag in tags]

    def get_tag(self, tag_id: int) -> Optional[Tag]:
        return self.db.query(Tag).filter(Tag.id == tag_id).first()

    def get_tag_by_slug(self, slug: str) -> Optional[Tag]:
        return self.db.query(Tag).filter(Tag.slug == slug).first()

    def create_tag(self, tag: TagCreate) -> Tag:
        return self._create_with_slug(Tag, tag, title_field="name")

    def update_tag(self, tag_id: int, tag: TagUpdate) -> Optional[Tag]:
        record = self.db.query(Tag).filter(Tag.id == tag_id).first()
        if not record:
            return None

        # No slug here, and that is the API's rule rather than an omission: the
        # slug is the tag's URL, and renaming "nextjs" to "Next.js" must not
        # break every link already published to /blog/tag/nextjs.
        self._apply_update(record, tag)
        self.db.commit()
        self.db.refresh(record)
        return record

    def delete_tag(self, tag_id: int) -> bool:
        record = self.db.query(Tag).filter(Tag.id == tag_id).first()
        if not record:
            return False

        # The posts stay; only the filing goes. Clearing the association
        # explicitly rather than relying on ON DELETE, so the ORM writes the
        # DELETE itself and the behaviour does not depend on whether the
        # connection enforces foreign keys.
        record.posts = []
        self.db.delete(record)
        self.db.commit()
        return True

    # Series methods
    def get_series_list(self, include_unpublished: bool = False) -> List[Series]:
        query = self.db.query(Series)
        if not include_unpublished:
            query = query.filter(Series.published.is_(True))
        return query.order_by(Series.title).all()

    def get_series(self, series_id: int, include_unpublished: bool = False) -> Optional[Series]:
        query = self.db.query(Series).filter(Series.id == series_id)
        if not include_unpublished:
            query = query.filter(Series.published.is_(True))
        return query.first()

    def get_series_by_slug(
        self, slug: str, include_unpublished: bool = False
    ) -> Optional[Series]:
        query = self.db.query(Series).filter(Series.slug == slug)
        if not include_unpublished:
            query = query.filter(Series.published.is_(True))
        return query.first()

    def get_series_posts(
        self, series_id: int, include_unpublished: bool = False
    ) -> List[Post]:
        """The run, in reading order — which is not the index's order.

        Everywhere else posts are newest-first. A series is the one place that
        would be wrong: part 1 is the oldest and is where the reader starts.
        """
        query = self.db.query(Post).filter(Post.series_id == series_id)
        if not include_unpublished:
            query = query.filter(Post.published.is_(True))
        return query.order_by(Post.series_order, Post.id).all()

    def create_series(self, series: SeriesCreate) -> Series:
        return self._create_with_slug(Series, series)

    def update_series(self, series_id: int, series: SeriesUpdate) -> Optional[Series]:
        record = self.get_series(series_id, include_unpublished=True)
        if not record:
            return None

        self._apply_update(record, series)
        self.db.commit()
        self.db.refresh(record)
        return record

    def delete_series(self, series_id: int) -> bool:
        record = self.get_series(series_id, include_unpublished=True)
        if not record:
            return False

        # Detach rather than cascade. Deleting a series must not delete the
        # posts in it — the series is a way of reading them, not what they are.
        for post in list(record.posts):
            post.series_id = None
            post.series_order = 0

        self.db.delete(record)
        self.db.commit()
        return True

    # Comment methods
    def get_comments(
        self, post_id: int, include_unapproved: bool = False
    ) -> List[PostComment]:
        """A post's comments, oldest first.

        Flat, not nested. ``parent_id`` is on every row and the consumer builds
        the two-level tree — which it has to do anyway to render replies under
        the right parent, and doing it here would mean a second shape for the
        same data.
        """
        query = self.db.query(PostComment).filter(PostComment.post_id == post_id)
        if not include_unapproved:
            query = query.filter(PostComment.status == CommentStatus.APPROVED)
        return query.order_by(PostComment.id).all()

    def get_comment_queue(
        self, status: Optional[CommentStatus] = None
    ) -> List[PostComment]:
        """The moderation queue across every post, newest first.

        Newest first here and oldest first on the public read, because these are
        two different jobs: moderating is a worklist and the newest arrival is
        the one waiting, while reading a thread is following a conversation.
        """
        query = self.db.query(PostComment)
        if status is not None:
            query = query.filter(PostComment.status == status)
        return query.order_by(PostComment.id.desc()).all()

    def get_comment(self, comment_id: int) -> Optional[PostComment]:
        return self.db.query(PostComment).filter(PostComment.id == comment_id).first()

    def create_comment(
        self, post_id: int, payload: PostCommentCreate, author_hash: Optional[str] = None
    ) -> PostComment:
        """Queue a reader's comment. Never approves it.

        There is no path here that produces an APPROVED row. Auto-approving on
        any signal — a returning ``author_hash``, a short body, an address that
        has commented before — is how a comment section becomes a spam section,
        because every one of those signals is trivially forged by the only
        parties who bother.
        """
        if payload.parent_id is not None:
            parent = self.get_comment(payload.parent_id)
            # A parent from another post would render a reply under a comment
            # that is not on the page; a parent that is itself a reply would
            # nest two deep, which the layout does not do.
            if (
                parent is None
                or parent.post_id != post_id
                or parent.parent_id is not None
                or parent.status != CommentStatus.APPROVED
            ):
                raise ValidationError(ErrorMessages.COMMENT_PARENT_INVALID)

        record = PostComment(
            post_id=post_id,
            parent_id=payload.parent_id,
            author_name=payload.author_name,
            author_email=payload.author_email,
            body=payload.body,
            status=CommentStatus.PENDING,
            author_hash=author_hash,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def moderate_comment(
        self, comment_id: int, status: CommentStatus
    ) -> Optional[PostComment]:
        record = self.get_comment(comment_id)
        if not record:
            return None

        record.status = status
        self.db.commit()
        self.db.refresh(record)
        return record

    def delete_comment(self, comment_id: int) -> bool:
        record = self.get_comment(comment_id)
        if not record:
            return False

        # Replies go with it, through the relationship's cascade. A reply whose
        # parent is gone has nothing to sit under and reads as a non-sequitur.
        self.db.delete(record)
        self.db.commit()
        return True

    def count_recent_comments(self, author_hash: str, since: datetime) -> int:
        """How many comments this handle has left lately.

        Backs a per-author limit that the IP-keyed rate limiter cannot express:
        slowapi's window is per route and resets on restart, and this one has to
        survive a deploy and follow the handle rather than the connection.
        """
        return (
            self.db.query(func.count(PostComment.id))
            .filter(
                PostComment.author_hash == author_hash,
                PostComment.created_at >= since,
            )
            .scalar()
            or 0
        )

    # Rating methods
    def get_rating_summary(self, post_id: int, voter_hash: Optional[str] = None) -> dict:
        """A post's stars: the mean, the count, and the five buckets.

        Aggregated in SQL rather than by loading every row, because the summary
        is read on every render of the post page and the vote count is the one
        number here with no ceiling.
        """
        rows = (
            self.db.query(PostRating.stars, func.count(PostRating.id))
            .filter(PostRating.post_id == post_id)
            .group_by(PostRating.stars)
            .all()
        )

        distribution = [0, 0, 0, 0, 0]
        total = 0
        count = 0
        for stars, n in rows:
            # Defensive: `stars` is constrained to 1-5 by the schema, but a row
            # written by hand could sit outside it, and an IndexError here would
            # 500 the whole post page over a decoration.
            if 1 <= stars <= 5:
                distribution[stars - 1] = n
            total += stars * n
            count += n

        mine = None
        if voter_hash:
            mine = (
                self.db.query(PostRating.stars)
                .filter(
                    PostRating.post_id == post_id, PostRating.voter_hash == voter_hash
                )
                .scalar()
            )

        return {
            # One decimal place. Two implies a precision that forty votes do not
            # have, and the control renders it as "4.6" either way.
            "average": round(total / count, 1) if count else 0.0,
            "count": count,
            "distribution": distribution,
            "mine": mine,
        }

    def rate_post(self, post_id: int, stars: int, voter_hash: str) -> dict:
        """Record one visitor's score, replacing their previous one.

        Changing your mind is an update, not a second vote — which is what the
        unique constraint on (post_id, voter_hash) enforces underneath, and why
        refreshing the page cannot move the average.
        """
        existing = (
            self.db.query(PostRating)
            .filter(PostRating.post_id == post_id, PostRating.voter_hash == voter_hash)
            .first()
        )

        if existing:
            existing.stars = stars
        else:
            self.db.add(PostRating(post_id=post_id, stars=stars, voter_hash=voter_hash))

        self.db.commit()
        return self.get_rating_summary(post_id, voter_hash=voter_hash)

    # Contact methods
    def get_contacts(self, unread_only: bool = False) -> List[Contact]:
        query = self.db.query(Contact)
        if unread_only:
            query = query.filter(Contact.read.is_(False))
        return query.order_by(Contact.created_at.desc()).all()

    def get_contact(self, contact_id: int) -> Optional[Contact]:
        return self.db.query(Contact).filter(Contact.id == contact_id).first()

    def create_contact(self, contact: ContactCreate) -> Contact:
        db_contact = Contact(**contact.model_dump())
        self.db.add(db_contact)
        self.db.commit()
        self.db.refresh(db_contact)
        return db_contact

    def mark_contact_as_read(self, contact_id: int) -> Optional[Contact]:
        db_contact = self.get_contact(contact_id)
        if not db_contact:
            return None

        db_contact.read = True
        self.db.commit()
        self.db.refresh(db_contact)
        return db_contact

    def delete_contact(self, contact_id: int) -> bool:
        db_contact = self.get_contact(contact_id)
        if not db_contact:
            return False

        self.db.delete(db_contact)
        self.db.commit()
        return True
