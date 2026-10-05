"""API router for Learner Mastery — BKT state queries and adaptive recommendations."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.mastery_service import MasteryService
from app.schemas.mastery import (
    CourseMasteryResponse,
    ConceptMasteryResponse,
    AdaptiveRecommendationsResponse,
)

router = APIRouter(tags=["Mastery"])


@router.get(
    "/courses/{course_id}/mastery",
    response_model=CourseMasteryResponse,
    summary="Get full BKT mastery model for all concepts in a course",
)
def get_course_mastery(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the full BKT-estimated mastery probability for every concept
    encountered by this student in the specified course.
    """
    return MasteryService.get_course_mastery(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
    )


@router.get(
    "/courses/{course_id}/mastery/recommendations",
    response_model=AdaptiveRecommendationsResponse,
    summary="Get adaptive learning recommendations ordered by remediation priority",
)
def get_adaptive_recommendations(
    course_id: str,
    top_n: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the top-N adaptive study recommendations for the student's next session.
    Concepts are ranked by BKT priority score (weakest, most attempted = highest urgency).
    Each recommendation includes:
      - Current p_know estimate
      - Mastery status label
      - Recommended Bloom's levels (scaffolded to student level)
      - Estimated questions needed to reach mastery
      - Pedagogical rationale
    """
    return MasteryService.get_adaptive_recommendations(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        top_n=top_n,
    )


@router.get(
    "/courses/{course_id}/mastery/{concept_label}",
    response_model=ConceptMasteryResponse,
    summary="Get BKT state for a single concept",
)
def get_concept_mastery(
    course_id: str,
    concept_label: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the full BKT state for one specific concept (identified by its label).
    Useful for drilling into a concept's mastery history and sparkline data.
    """
    return MasteryService.get_concept_mastery(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        concept_label=concept_label,
    )
