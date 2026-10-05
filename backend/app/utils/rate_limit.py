"""Rate limiting configuration and utilities using slowapi."""

import logging
from typing import Optional
from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings

logger = logging.getLogger(__name__)


def get_user_or_ip_identifier(request: Request) -> str:
    """
    Generate rate limit tracking key.
    Prioritizes authenticated user ID from Authorization header payload if present,
    otherwise falls back to client IP address.
    """
    auth_header: Optional[str] = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        from app.auth.security import decode_access_token
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            return f"user:{payload['sub']}"

    return f"ip:{get_remote_address(request)}"


# Configure storage backend: Redis if configured, otherwise high-performance in-memory
storage_uri = settings.REDIS_URL.strip() if settings.REDIS_URL else "memory://"

limiter = Limiter(
    key_func=get_user_or_ip_identifier,
    default_limits=[settings.DEFAULT_RATE_LIMIT],
    storage_uri=storage_uri,
    enabled=settings.RATE_LIMIT_ENABLED,
)
