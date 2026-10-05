"""Main entry point for the Knovara FastAPI backend application."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import check_db_connection, init_db
from app.utils.rate_limit import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.courses import router as courses_router
from app.api.documents import router as documents_router
from app.api.rag import router as rag_router
from app.api.tutor import router as tutor_router
from app.api.assessments import router as assessments_router
from app.api.mastery import router as mastery_router
from app.api.flashcards import router as flashcards_router
from app.api.analytics import router as analytics_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("knovara")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle events."""
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]")
    # Enforce production security invariants
    settings.validate_production_security()
    db_status = check_db_connection()
    logger.info(f"Initial Database Status: {db_status}")
    init_db()
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME} application")


app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    description=settings.PROJECT_DESCRIPTION,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Attach SlowAPI Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api", include_in_schema=False)
app.include_router(courses_router, prefix="/api/v1")
app.include_router(courses_router, prefix="/api", include_in_schema=False)
app.include_router(documents_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api", include_in_schema=False)
app.include_router(rag_router, prefix="/api/v1")
app.include_router(rag_router, prefix="/api", include_in_schema=False)
app.include_router(tutor_router, prefix="/api/v1")
app.include_router(tutor_router, prefix="/api", include_in_schema=False)
app.include_router(assessments_router, prefix="/api/v1")
app.include_router(assessments_router, prefix="/api", include_in_schema=False)
app.include_router(mastery_router, prefix="/api/v1")
app.include_router(mastery_router, prefix="/api", include_in_schema=False)
app.include_router(flashcards_router, prefix="/api/v1")
app.include_router(flashcards_router, prefix="/api", include_in_schema=False)
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api", include_in_schema=False)


@app.get("/", tags=["Root"])
def root():
    """Welcome endpoint providing service metadata."""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API — Personalized AI Tutoring & Adaptive Learning Platform",
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_check": "/health",
        "endpoints": {
            "auth": "/api/v1/auth",
            "courses": "/api/v1/courses",
            "documents": "/api/v1/courses/{course_id}/documents",
            "rag": "/api/v1/courses/{course_id}/rag",
            "tutor": "/api/v1/courses/{course_id}/tutor",
            "assessments": "/api/v1/courses/{course_id}/assessments",
            "mastery": "/api/v1/courses/{course_id}/mastery",
            "flashcards": "/api/v1/courses/{course_id}/flashcards",
            "analytics": "/api/v1/courses/{course_id}/analytics",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
