#!/usr/bin/env python3
"""
FastAPI Application Runner
Usage: python run.py
"""
import uvicorn
from app.main import app
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="localhost",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        log_level="info",
        access_log=True
    )