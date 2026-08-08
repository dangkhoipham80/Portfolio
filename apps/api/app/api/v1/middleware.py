import time
import logging
from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.core.config import settings

logger = logging.getLogger(__name__)

class LoggingMiddleware:
    """Middleware to log all requests and responses"""
    
    async def __call__(self, request: Request, call_next):
        start_time = time.time()
        
        # Log request
        logger.info(f"Request: {request.method} {request.url}")
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log response
        logger.info(f"Response: {response.status_code} - {process_time:.4f}s")
        
        # Add processing time to response headers
        response.headers["X-Process-Time"] = str(process_time)
        
        return response

class ErrorHandlingMiddleware:
    """Middleware to handle and log errors"""
    
    async def __call__(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"Unhandled error: {str(e)}")
            raise

def setup_middleware(app):
    """Setup all middleware for the application"""
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure based on your needs
    )
    
    # Custom middleware
    app.middleware("http")(LoggingMiddleware())
    app.middleware("http")(ErrorHandlingMiddleware()) 