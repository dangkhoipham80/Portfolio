from sqlalchemy import Column, String, Text, Boolean, JSON, Integer, DateTime
from .base import BaseModel

class Project(BaseModel):
    __tablename__ = "projects"
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    image_url = Column(String(500))
    github_url = Column(String(500))
    live_url = Column(String(500))
    technologies = Column(JSON)  # Store as JSON array
    featured = Column(Boolean, default=False)
    order = Column(Integer, default=0)

class Skill(BaseModel):
    __tablename__ = "skills"
    
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # frontend, backend, tools, etc.
    level = Column(Integer, default=1)  # 1-5 scale
    icon = Column(String(100))
    order = Column(Integer, default=0)

class Certificate(BaseModel):
    __tablename__ = "certificates"
    
    title = Column(String(255), nullable=False)
    issuer = Column(String(255), nullable=False)
    issue_date = Column(DateTime, nullable=False)
    credential_url = Column(String(500))
    image_url = Column(String(500))
    description = Column(Text)

class Contact(BaseModel):
    __tablename__ = "contacts"
    
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False) 