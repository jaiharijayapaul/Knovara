"""API router for Grounded Flashcards and Spaced Repetition (SRS)."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.utils.rate_limit import limiter
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.flashcard_service import FlashcardService
from app.schemas.flashcard import (
    FlashcardCreate,
    FlashcardResponse,
    FlashcardReviewRequest,
    FlashcardReviewResponse,
    FlashcardGenerateRequest,
    FlashcardDeckCreate,
    FlashcardDeckResponse,
    SRSStatsResponse,
)

router = APIRouter(tags=["Flashcards & Spaced Repetition"])


@router.get(
    "/courses/{course_id}/flashcards",
    response_model=List[FlashcardResponse],
    summary="List flashcards for a course workspace",
)
def list_flashcards(
    course_id: str,
    deck_id: Optional[str] = None,
    topic: Optional[str] = None,
    due_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List flashcards in this course workspace.
    Supports filtering by topic, deck_id, or due_only (for active spaced repetition study queue).
    """
    return FlashcardService.list_cards(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        deck_id=deck_id,
        topic=topic,
        due_only=due_only,
    )


@router.post(
    "/courses/{course_id}/flashcards",
    response_model=FlashcardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually create a grounded flashcard",
)
def create_flashcard(
    course_id: str,
    payload: FlashcardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an individual study card with multimodal citations."""
    return FlashcardService.create_card(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/courses/{course_id}/flashcards/generate",
    response_model=List[FlashcardResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Synthesize grounded flashcards from course materials",
)
@limiter.limit(settings.LLM_RATE_LIMIT)
async def generate_flashcards(
    request: Request,
    course_id: str,
    payload: FlashcardGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Synthesize high-yield study flashcards grounded in indexed course documents.
    If target_weak_concepts is True, queries the Bayesian Knowledge Tracing model
    to focus cards on concepts where student mastery is lowest.
    """
    return await FlashcardService.generate_cards(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/courses/{course_id}/flashcards/{card_id}/review",
    response_model=FlashcardReviewResponse,
    summary="Submit an SM-2 spaced repetition review rating",
)
def review_flashcard(
    course_id: str,
    card_id: str,
    payload: FlashcardReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a quality rating (0-5) on a flashcard review.
    Calculates next review interval using SuperMemo SM-2 and automatically
    synchronizes retention evidence with the student's Bayesian Knowledge Tracing model.
    """
    return FlashcardService.review_card(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        card_id=card_id,
        payload=payload,
    )


@router.get(
    "/courses/{course_id}/flashcards/stats",
    response_model=SRSStatsResponse,
    summary="Get Spaced Repetition study queue telemetry and retention analytics",
)
def get_srs_stats(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns total cards, cards due today, retention rate, and breakdown by topic."""
    return FlashcardService.get_stats(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
    )


@router.delete(
    "/courses/{course_id}/flashcards/{card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a flashcard",
)
def delete_flashcard(
    course_id: str,
    card_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a flashcard."""
    FlashcardService.delete_card(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        card_id=card_id,
    )


@router.get(
    "/courses/{course_id}/flashcards/decks",
    response_model=List[FlashcardDeckResponse],
    summary="List flashcard decks for a course",
)
def list_decks(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List decks with card counts and due counts."""
    return FlashcardService.list_decks(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
    )


@router.post(
    "/courses/{course_id}/flashcards/decks",
    response_model=FlashcardDeckResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new flashcard deck",
)
def create_deck(
    course_id: str,
    payload: FlashcardDeckCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new deck for organizing flashcards."""
    return FlashcardService.create_deck(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        payload=payload,
    )
