#!/usr/bin/env python3
"""
Test script to verify Neon database connection
"""
import asyncio
from sqlalchemy import text
from app.core.database import get_async_session
from app.core.config import settings

async def test_database_connection():
    """Test the database connection"""
    print("🔍 Testing Neon Database Connection...")
    print(f"📊 Database URL: {settings.DATABASE_URL}")
    
    try:
        async with get_async_session() as session:
            # Test basic connection
            result = await session.execute(text("SELECT 1 as test"))
            test_value = result.scalar()
            
            if test_value == 1:
                print("✅ Database connection successful!")
                
                # Test database version
                result = await session.execute(text("SELECT version()"))
                version = result.scalar()
                print(f"📋 PostgreSQL Version: {version}")
                
                # Test if tables exist
                result = await session.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """))
                tables = [row[0] for row in result.fetchall()]
                
                if tables:
                    print(f"📋 Existing tables: {', '.join(tables)}")
                else:
                    print("📋 No tables found - database is empty")
                    
            else:
                print("❌ Database connection test failed")
                
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(test_database_connection()) 