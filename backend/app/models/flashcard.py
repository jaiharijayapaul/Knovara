"""SQLAlchemy models for Grounded Flashcards and Spaced Repetition (SRS)."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class FlashcardDeck(Base):
    """Deck grouping flashcards for a course."""
    __tablename__ = "flashcard_decks"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    course_id = Column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    course = relationship("Course")
    user = relationship("User")
    cards = relationship(
        "Flashcard",
        back_populates="deck",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Flashcard(Base):
    """
    Grounded flashcard with multimodal citation coordinates and
    SuperMemo-2 (SM-2) spaced repetition tracking state.
    """
    __tablename__ = "flashcards"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    deck_id = Column(
        String(36),
        ForeignKey("flashcard_decks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    course_id = Column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic = Column(String(150), nullable=True, index=True)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    hint = Column(Text, nullable=True)
    bloom_level = Column(String(50), default="remember", nullable=False)

    # Grounding coordinates
    citation_label = Column(String(100), nullable=True)
    document_name = Column(String(255), nullable=True)
    page_number = Column(Integer, nullable=True)
    slide_number = Column(Integer, nullable=True)
    timestamp_start = Column(String(50), nullable=True)
    timestamp_end = Column(String(50), nullable=True)
    source_snippet = Column(Text, nullable=True)

    # SRS SM-2 state
    repetitions = Column(Integer, default=0, nullable=False)
    interval_days = Column(Float, default=0.0, nullable=False)
    ease_factor = Column(Float, default=2.5, nullable=False)
    next_review_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    total_reviews = Column(Integer, default=0, nullable=False)
    lapses = Column(Integer, default=0, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    deck = relationship("FlashcardDeck", back_populates="cards")
    course = relationship("Course")
    user = relationship("User")
