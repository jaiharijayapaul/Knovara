"""API router for Comprehensive Learning Analytics, Progress Telemetry & Reports."""

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.analytics import CourseAnalyticsReport
from app.services.analytics_service import (
    get_course_analytics,
    export_course_analytics_markdown,
)

router = APIRouter(tags=["Analytics & Progress Telemetry"])


@router.get(
    "/courses/{course_id}/analytics",
    response_model=CourseAnalyticsReport,
    summary="Get comprehensive learning analytics, velocity, Bloom breakdown, and retention forecast",
)
def get_course_analytics_endpoint(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns high-fidelity multi-source learning telemetry:
      - Overall course mastery & learning velocity (BKT Hidden Markov Model)
      - Bloom's Revised Taxonomy cognitive level accuracy distribution
      - Diagnostic misconception & error taxonomy classification breakdown
      - Spaced Repetition (SM-2) Ebbinghaus retention decay and due load forecast
      - Study time, streak, and 14-day activity timeline
      - Curricular concept mastery matrix
      - Synthesized pedagogical executive summary
    """
    return get_course_analytics(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
    )


@router.get(
    "/courses/{course_id}/analytics/export",
    summary="Export comprehensive course analytics telemetry report as Markdown or JSON",
)
def export_course_analytics_endpoint(
    course_id: str,
    format: str = Query("markdown", pattern="^(markdown|json)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exports a printable learning portfolio report in Markdown format or raw JSON telemetry.
    """
    report = get_course_analytics(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
    )

    if format == "markdown":
        md_content = export_course_analytics_markdown(report)
        filename = f"knovara_analytics_{course_id[:8]}.md"
        return Response(
            content=md_content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            },
        )

    return report
