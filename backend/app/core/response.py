"""
Unified response format wrapper, compliant with API documentation requirements
"""
import uuid
from typing import Any, Optional
from fastapi import Response
from fastapi.responses import JSONResponse


def success_response(
    data: Any = None, 
    message: str = "ok", 
    code: int = 0
) -> dict:
    """Success response"""
    return {
        "code": code,
        "message": message,
        "data": data,
        "request_id": str(uuid.uuid4())
    }


def error_response(
    message: str, 
    code: int, 
    data: Any = None,
    status_code: int = 400
) -> JSONResponse:
    """Error response"""
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "data": data,
            "request_id": str(uuid.uuid4())
        }
    )


# Error code constants
class ErrorCode:
    UNAUTHENTICATED = 1001      # Not logged in/Token expired
    FORBIDDEN = 1002            # Insufficient permissions
    VALIDATION_ERROR = 2001     # Parameter validation failed
    NOT_FOUND = 3001           # Resource not found
    CONFLICT = 4001            # Business conflict
    RATE_LIMITED = 8001        # Rate limiting triggered
    INTERNAL_ERROR = 9001      # Server error
