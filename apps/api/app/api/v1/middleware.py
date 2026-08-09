import logging
import time

from fastapi import Request

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


# setup_middleware() lived here and was never called — app/main.py wires CORS
# itself. It has been removed rather than left lying around: it allowed
# methods=["*"], headers=["*"] and TrustedHostMiddleware(allowed_hosts=["*"]),
# so wiring it in "to add logging" would have quietly widened CORS.
