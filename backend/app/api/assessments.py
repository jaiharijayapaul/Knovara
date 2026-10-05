"""API Router for Assessments and Bloom's Taxonomy Question Generator."""

from typing import List
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.utils.rate_limit import limiter
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.assessment_service import AssessmentService
from app.schemas.assessment import (
    AssessmentGenerateRequest,
    AssessmentResponse,
    AssessmentDetailResponse,
    AssessmentSubmitRequest,
    AssessmentAttemptResponse,
    AssessmentAttemptDetailResponse,
)

router = APIRouter(prefix="/courses/{course_id}/assessments", tags=["Assessments"])


@router.post(
    "/generate",
    response_model=AssessmentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate psychometric assessment across Bloom's Taxonomy",
)
@limiter.limit(settings.LLM_RATE_LIMIT)
async def generate_assessment(
    request: Request,
    course_id: str,
    payload: AssessmentGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Synthesizes a diagnostic assessment from ingested multimodal course materials.
    Questions are systematically distributed across Bloom's cognitive taxonomy
    (Remember, Understand, Apply, Analyze, Evaluate, Create) with grounded citations.
    """
    return await AssessmentService.generate_assessment(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.get(
    "",
    response_model=List[AssessmentResponse],
    summary="List all assessments for course",
)
def list_assessments(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all created and generated assessments for this course workspace."""
    return AssessmentService.list_assessments(
        db=db, course_id=course_id, user_id=current_user.id
    )


@router.get(
    "/{assessment_id}",
    summary="Get assessment detail with questions",
)
def get_assessment(
    course_id: str,
    assessment_id: str,
    student_mode: bool = Query(
        default=False,
        description="If True, hides answers and misconceptions for active student testing",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve full assessment questions, Bloom levels, source citations,
    and diagnostic misconception explanations.
    """
    return AssessmentService.get_assessment(
        db=db,
        course_id=course_id,
        assessment_id=assessment_id,
        user_id=current_user.id,
        student_mode=student_mode,
    )


@router.delete(
    "/{assessment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete assessment",
)
def delete_assessment(
    course_id: str,
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an assessment and all associated questions."""
    AssessmentService.delete_assessment(
        db=db,
        course_id=course_id,
        assessment_id=assessment_id,
        user_id=current_user.id,
    )
    return None


@router.post(
    "/{assessment_id}/submit",
    response_model=AssessmentAttemptDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit assessment attempt with diagnostic error taxonomy classification",
)
def submit_assessment(
    course_id: str,
    assessment_id: str,
    payload: AssessmentSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submits student responses for scoring, automatic Bloom taxonomy evaluation,
    and diagnostic classification of misconceptions into the 5 error failure modes.
    """
    return AssessmentService.submit_assessment(
        db=db,
        course_id=course_id,
        assessment_id=assessment_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/{assessment_id}/attempts",
    response_model=List[AssessmentAttemptResponse],
    summary="List all student attempts for this assessment",
)
def list_attempts(
    course_id: str,
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List historical scores and error breakdowns for student attempts on this test."""
    return AssessmentService.list_attempts(
        db=db,
        course_id=course_id,
        assessment_id=assessment_id,
        user_id=current_user.id,
    )


@router.get(
    "/{assessment_id}/attempts/{attempt_id}",
    response_model=AssessmentAttemptDetailResponse,
    summary="Get full diagnostic report for an attempt",
)
def get_attempt(
    course_id: str,
    assessment_id: str,
    attempt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch comprehensive diagnostic performance report for a test attempt,
    including Bloom's Taxonomy breakdown, Error Taxonomy counts, and citation hints.
    """
    return AssessmentService.get_attempt(
        db=db,
        course_id=course_id,
        assessment_id=assessment_id,
        attempt_id=attempt_id,
        user_id=current_user.id,
    )

