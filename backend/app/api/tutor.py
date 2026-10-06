"""AI Tutor and Multi-Turn Pedagogical Dialogue API router."""

from typing import List
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.utils.rate_limit import limiter
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.tutor import (
    TutorSessionCreate,
    RemediationSessionCreate,
    TutorSessionUpdateMode,
    TutorMessageCreate,
    TutorMessageResponse,
    TutorSessionResponse,
    TutorSessionDetailResponse,
)
from app.services.tutor_service import TutorService

router = APIRouter(prefix="/courses/{course_id}/tutor", tags=["AI Tutor"])


@router.post(
    "/remediate",
    response_model=TutorSessionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a targeted Socratic remediation session",
    description="Deep-links an assessment mistake or low BKT mastery concept directly into a dedicated pedagogical session.",
)
@limiter.limit(settings.LLM_RATE_LIMIT)
def create_remediation_session(
    request: Request,
    course_id: str,
    payload: RemediationSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initialize a targeted remediation tutoring session."""
    return TutorService.create_remediation_session(
        db=db, course_id=course_id, user_id=current_user.id, payload=payload
    )


@router.post(
    "/sessions",
    response_model=TutorSessionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new AI Tutor dialogue session",
    description="Initializes a multi-turn chat session configured with one of the 7 pedagogical modes.",
)
def create_session(
    course_id: str,
    payload: TutorSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new tutoring session."""
    return TutorService.create_session(
        db=db, course_id=course_id, user_id=current_user.id, payload=payload
    )


@router.get(
    "/sessions",
    response_model=List[TutorSessionResponse],
    status_code=status.HTTP_200_OK,
    summary="List tutoring sessions",
    description="Returns all active or archived dialogue sessions for this course workspace.",
)
def list_sessions(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List sessions."""
    return TutorService.list_sessions(db=db, course_id=course_id, user_id=current_user.id)


@router.get(
    "/sessions/{session_id}",
    response_model=TutorSessionDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get session dialogue history",
    description="Retrieves all turns in a tutoring session along with grounded citations.",
)
def get_session(
    course_id: str,
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full session detail."""
    return TutorService.get_session_detail(
        db=db, course_id=course_id, session_id=session_id, user_id=current_user.id
    )


@router.post(
    "/sessions/{session_id}/messages",
    response_model=TutorMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send student message turn",
    description="Submits a student question/turn, retrieves grounded citations, and returns tutor response.",
)
@limiter.limit(settings.LLM_RATE_LIMIT)
async def send_message(
    request: Request,
    course_id: str,
    session_id: str,
    payload: TutorMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send student message and generate next pedagogical tutor turn."""
    return await TutorService.send_message(
        db=db,
        course_id=course_id,
        session_id=session_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/sessions/{session_id}/messages/stream",
    summary="Send student message turn with SSE streaming",
    description="Submits a student question, emits citations immediately, and streams response tokens in real-time.",
)
@limiter.limit(settings.LLM_RATE_LIMIT)
async def send_message_stream(
    request: Request,
    course_id: str,
    session_id: str,
    payload: TutorMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream student turn and tutor response via Server-Sent Events."""
    generator = await TutorService.send_message_stream(
        db=db,
        course_id=course_id,
        session_id=session_id,
        user_id=current_user.id,
        payload=payload,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.patch(
    "/sessions/{session_id}/mode",
    response_model=TutorSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Switch pedagogical mode",
    description="Dynamically switch pedagogical mode (socratic, analogy, first_principles, misconception_buster, exam_prep, deep_dive, quick_review).",
)
def update_mode(
    course_id: str,
    session_id: str,
    payload: TutorSessionUpdateMode,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update active pedagogical mode."""
    return TutorService.update_mode(
        db=db,
        course_id=course_id,
        session_id=session_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete tutoring session",
    description="Deletes session and all sequential dialogue history.",
)
def delete_session(
    course_id: str,
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete session."""
    TutorService.delete_session(
        db=db, course_id=course_id, session_id=session_id, user_id=current_user.id
    )
    return None
