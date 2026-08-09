from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.slugs import unique_slug
from app.models.portfolio import CareerEntry, Certificate, Contact, Project, Skill
from app.schemas.portfolio import (
    CareerEntryCreate,
    CareerEntryUpdate,
    CertificateCreate,
    CertificateUpdate,
    ContactCreate,
    ProjectCreate,
    ProjectUpdate,
    SkillCreate,
    SkillUpdate,
)


class PortfolioService:
    """Reads and writes portfolio content.

    Every read takes ``include_unpublished``, which defaults to False. Callers
    that want drafts have to ask for them, so a route that forgets to think
    about visibility leaks nothing — it just shows the published set.
    """

    def __init__(self, db: Session):
        self.db = db

    def _create_with_slug(self, model, payload, title_field: str = "title"):
        """Insert a slugged row, deriving the slug from its title if absent."""
        data = payload.model_dump()
        requested = data.pop("slug", None) or getattr(payload, title_field)
        data["slug"] = unique_slug(self.db, model, requested)

        record = model(**data)
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    @staticmethod
    def _apply_update(record, payload) -> None:
        # exclude_unset, not exclude_none: a PATCH-style body that explicitly
        # sends `"ended_on": null` means "clear this", and dropping nulls would
        # make an ongoing project impossible to mark ongoing again.
        for field, value in payload.model_dump(exclude_unset=True).items():
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
