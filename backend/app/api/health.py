"""Health check router reporting service status and database connectivity."""

from datetime import datetime, timezone
from fastapi import APIRouter, status
from app.config import settings
from app.database import check_db_connection

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Service Health Check",
    description="Returns backend service telemetry, version info, and database status.",
)
@router.get(
    "/api/health",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def get_health():
    """Health check endpoint evaluating application and database liveness."""
    db_health = check_db_connection()
    is_healthy = db_health.get("status") == "connected"

    return {
        "status": "healthy" if is_healthy else "degraded",
        "service": settings.PROJECT_NAME,
        "description": settings.PROJECT_DESCRIPTION,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_health,
    }
