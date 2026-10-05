"""Pydantic schemas for Grounded Flashcards and Spaced Repetition (SRS)."""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class FlashcardBase(BaseModel):
    front: str = Field(..., min_length=1, description="Question, term, or prompt on front of card")
    back: str = Field(..., min_length=1, description="Answer, definition, or explanation on back of card")
    hint: Optional[str] = Field(default=None, description="Optional scaffold hint")
    topic: Optional[str] = Field(default=None, description="Topic or syllabus concept")
    bloom_level: str = Field(default="remember", description="Cognitive level (remember, understand, apply...)")

    # Grounding coordinates
    citation_label: Optional[str] = None
    document_name: Optional[str] = None
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    source_snippet: Optional[str] = None


class FlashcardCreate(FlashcardBase):
    deck_id: Optional[str] = None


class FlashcardUpdate(BaseModel):
    front: Optional[str] = None
    back: Optional[str] = None
    hint: Optional[str] = None
    topic: Optional[str] = None


class FlashcardResponse(FlashcardBase):
    id: str
    deck_id: Optional[str] = None
    course_id: str
    user_id: str

    # SRS state
    repetitions: int
    interval_days: float
    ease_factor: float
    next_review_at: datetime
    last_reviewed_at: Optional[datetime] = None
    total_reviews: int
    lapses: int
    is_due: bool = False

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FlashcardReviewRequest(BaseModel):
    """SM-2 review rating from student."""
    quality: int = Field(
        ...,
        ge=0,
        le=5,
        description="Recall rating: 0 (blackout), 1 (wrong), 2 (barely familiar), 3 (hard), 4 (good), 5 (easy/perfect)"
    )


class FlashcardReviewResponse(BaseModel):
    """Result of an SRS review step."""
    card_id: str
    repetitions: int
    interval_days: float
    ease_factor: float
    next_review_at: datetime
    quality: int
    is_successful: bool
    bkt_synced: bool = False
    card: FlashcardResponse


class FlashcardGenerateRequest(BaseModel):
    """Payload to synthesize grounded flashcards from course materials."""
    topic: Optional[str] = Field(default=None, description="Focus topic or comprehensive scope")
    num_cards: int = Field(default=6, ge=1, le=20, description="Number of flashcards to synthesize")
    target_weak_concepts: bool = Field(
        default=True,
        description="When true, synthesizes cards for concepts where student BKT mastery is lowest"
    )
    deck_title: Optional[str] = Field(default=None, description="Optional deck grouping name")


class FlashcardDeckCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class FlashcardDeckResponse(BaseModel):
    id: str
    course_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    cards_count: int = 0
    cards_due_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SRSStatsResponse(BaseModel):
    """Spaced Repetition progress telemetry."""
    total_cards: int
    cards_due_today: int
    cards_learning: int       # repetitions < 2
    cards_reviewing: int      # 2 <= repetitions < 4
    cards_mastered: int       # repetitions >= 4 or interval >= 14d
    average_ease_factor: float = 2.50
    retention_rate: float     # successful reviews / total reviews (0.0 - 100.0)
    total_reviews_completed: int
    streak_days: int = 1
    due_by_topic: Dict[str, int] = Field(default_factory=dict)
