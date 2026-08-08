from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# NOTE: there is deliberately no create_tables() here any more. It used to be
# called at import time in app/main.py, so merely importing the app issued DDL
# against whatever DATABASE_URL happened to be set. Alembic owns the schema:
#   alembic revision --autogenerate -m "..."
#   alembic upgrade head
