"""API endpoints router package."""

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.courses import router as courses_router
from app.api.documents import router as documents_router
from app.api.rag import router as rag_router
from app.api.tutor import router as tutor_router

__all__ = [
    "health_router",
    "auth_router",
    "courses_router",
    "documents_router",
    "rag_router",
    "tutor_router",
]
