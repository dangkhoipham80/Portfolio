#!/usr/bin/env python3
"""
Database initialization script for Portfolio API
"""

import os
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.core.database import create_tables
from app.models.portfolio import Project, Skill, Certificate

def init_database():
    """Initialize database with sample data"""
    print("🚀 Initializing Portfolio Database...")
    
    # Create database engine
    engine = create_engine(settings.DATABASE_URL)
    
    # Test database connection
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✅ Database connection successful")
            print(f"📊 Connected to Neon Database: {settings.DATABASE_URL.split('@')[1].split('/')[0]}")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("Please ensure Neon database credentials are correct")
        sys.exit(1)
    
    # Create tables
    print("📋 Creating database tables...")
    create_tables()
    print("✅ Tables created successfully")
    
    # Add sample data
    print("📝 Adding sample data...")
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Sample Projects
        sample_projects = [
            Project(
                title="Portfolio Website",
                description="A modern portfolio website built with React and FastAPI",
                image_url="https://via.placeholder.com/400x300",
                github_url="https://github.com/username/portfolio",
                live_url="https://portfolio.example.com",
                technologies=["React", "TypeScript", "FastAPI", "PostgreSQL"],
                featured=True,
                order=1
            ),
            Project(
                title="E-commerce Platform",
                description="Full-stack e-commerce solution with payment integration",
                image_url="https://via.placeholder.com/400x300",
                github_url="https://github.com/username/ecommerce",
                live_url="https://ecommerce.example.com",
                technologies=["React", "Node.js", "MongoDB", "Stripe"],
                featured=True,
                order=2
            ),
            Project(
                title="Task Management App",
                description="Collaborative task management application",
                image_url="https://via.placeholder.com/400x300",
                github_url="https://github.com/username/task-manager",
                technologies=["Vue.js", "Express.js", "PostgreSQL"],
                featured=False,
                order=3
            )
        ]
        
        # Sample Skills
        sample_skills = [
            Skill(name="React", category="frontend", level=5, icon="react", order=1),
            Skill(name="TypeScript", category="frontend", level=4, icon="typescript", order=2),
            Skill(name="Python", category="backend", level=5, icon="python", order=1),
            Skill(name="FastAPI", category="backend", level=4, icon="fastapi", order=2),
            Skill(name="PostgreSQL", category="database", level=4, icon="postgresql", order=1),
            Skill(name="Docker", category="devops", level=3, icon="docker", order=1),
            Skill(name="Git", category="tools", level=4, icon="git", order=1),
            Skill(name="TailwindCSS", category="frontend", level=4, icon="tailwind", order=3)
        ]
        
        # Sample Certificates
        sample_certificates = [
            Certificate(
                title="AWS Certified Developer",
                issuer="Amazon Web Services",
                issue_date="2024-01-15",
                credential_url="https://aws.amazon.com/certification/",
                description="AWS Certified Developer - Associate level certification"
            ),
            Certificate(
                title="React Developer Certification",
                issuer="Meta",
                issue_date="2023-12-01",
                credential_url="https://www.meta.com/",
                description="Meta React Developer Professional Certificate"
            )
        ]
        
        # Add projects
        for project in sample_projects:
            db.add(project)
        
        # Add skills
        for skill in sample_skills:
            db.add(skill)
        
        # Add certificates
        for certificate in sample_certificates:
            db.add(certificate)
        
        db.commit()
        print("✅ Sample data added successfully")
        
    except Exception as e:
        print(f"❌ Error adding sample data: {e}")
        db.rollback()
    finally:
        db.close()
    
    print("🎉 Database initialization completed!")
    print(f"📊 Database URL: {settings.DATABASE_URL}")
    print("🔗 API Documentation: http://localhost:8000/docs")

if __name__ == "__main__":
    init_database() 