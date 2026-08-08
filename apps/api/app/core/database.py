from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import logging

# Set up logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# Create database engine
# logger.info(f"Connecting to database: {settings.DATABASE_URL}")
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    # echo=True  # Enable SQL logging
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create all tables
def create_tables():
    """Create all database tables with debug logging"""
    try:
        # logger.info("Testing database connection...")
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            # logger.info("✅ Database connection successful")
        
        # logger.info("Creating database tables...")
        # logger.info(f"Available tables in metadata: {list(Base.metadata.tables.keys())}")
        
        Base.metadata.create_all(bind=engine)
        # logger.info("✅ Tables created successfully")
        
        # Verify tables were created
        # with engine.connect() as conn:
        #     result = conn.execute(text("""
        #         SELECT table_name 
        #         FROM information_schema.tables 
        #         WHERE table_schema = 'public'
        #         ORDER BY table_name
        #     """))
        #     tables = [row[0] for row in result]
        #     logger.info(f"📋 Tables in database: {tables}")
            
    except Exception as e:
        # logger.error(f"❌ Database error: {e}")
        raise 