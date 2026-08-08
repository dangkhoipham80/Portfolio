from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.portfolio import Project, Skill, Certificate, Contact
from app.schemas.portfolio import ProjectCreate, ProjectUpdate, SkillCreate, SkillUpdate, CertificateCreate, CertificateUpdate, ContactCreate

class PortfolioService:
    def __init__(self, db: Session):
        self.db = db

    # Project methods
    def get_projects(self, featured_only: bool = False) -> List[Project]:
        query = self.db.query(Project)
        if featured_only:
            query = query.filter(Project.featured == True)
        return query.order_by(Project.order).all()

    def get_project(self, project_id: int) -> Optional[Project]:
        return self.db.query(Project).filter(Project.id == project_id).first()

    def create_project(self, project: ProjectCreate) -> Project:
        db_project = Project(**project.dict())
        self.db.add(db_project)
        self.db.commit()
        self.db.refresh(db_project)
        return db_project

    def update_project(self, project_id: int, project: ProjectUpdate) -> Optional[Project]:
        db_project = self.get_project(project_id)
        if not db_project:
            return None
        
        update_data = project.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_project, field, value)
        
        self.db.commit()
        self.db.refresh(db_project)
        return db_project

    def delete_project(self, project_id: int) -> bool:
        db_project = self.get_project(project_id)
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
        return query.order_by(Skill.order).all()

    def get_skill(self, skill_id: int) -> Optional[Skill]:
        return self.db.query(Skill).filter(Skill.id == skill_id).first()

    def create_skill(self, skill: SkillCreate) -> Skill:
        db_skill = Skill(**skill.dict())
        self.db.add(db_skill)
        self.db.commit()
        self.db.refresh(db_skill)
        return db_skill

    def update_skill(self, skill_id: int, skill: SkillUpdate) -> Optional[Skill]:
        db_skill = self.get_skill(skill_id)
        if not db_skill:
            return None
        
        update_data = skill.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_skill, field, value)
        
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
    def get_certificates(self) -> List[Certificate]:
        return self.db.query(Certificate).order_by(Certificate.issue_date.desc()).all()

    def get_certificate(self, certificate_id: int) -> Optional[Certificate]:
        return self.db.query(Certificate).filter(Certificate.id == certificate_id).first()

    def create_certificate(self, certificate: CertificateCreate) -> Certificate:
        db_certificate = Certificate(**certificate.dict())
        self.db.add(db_certificate)
        self.db.commit()
        self.db.refresh(db_certificate)
        return db_certificate

    def update_certificate(self, certificate_id: int, certificate: CertificateUpdate) -> Optional[Certificate]:
        db_certificate = self.get_certificate(certificate_id)
        if not db_certificate:
            return None
        
        update_data = certificate.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_certificate, field, value)
        
        self.db.commit()
        self.db.refresh(db_certificate)
        return db_certificate

    def delete_certificate(self, certificate_id: int) -> bool:
        db_certificate = self.get_certificate(certificate_id)
        if not db_certificate:
            return False
        
        self.db.delete(db_certificate)
        self.db.commit()
        return True

    # Contact methods
    def get_contacts(self, unread_only: bool = False) -> List[Contact]:
        query = self.db.query(Contact)
        if unread_only:
            query = query.filter(Contact.read == False)
        return query.order_by(Contact.created_at.desc()).all()

    def get_contact(self, contact_id: int) -> Optional[Contact]:
        return self.db.query(Contact).filter(Contact.id == contact_id).first()

    def create_contact(self, contact: ContactCreate) -> Contact:
        db_contact = Contact(**contact.dict())
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