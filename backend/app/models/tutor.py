"""SQLAlchemy models for multi-turn AI Tutor sessions and message dialogues."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class TutorSession(Base):
    """
    Interactive dialogue tutoring session with dynamic pedagogical mode selection
    and multi-turn context tracking.
    """
    __tablename__ = "tutor_sessions"

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
    title = Column(String(255), default="New Study Session", nullable=False)
    pedagogical_mode = Column(
        String(50),
        default="socratic",
        nullable=False,
    )  # socratic, analogy, first_principles, misconception_buster, exam_prep, deep_dive, quick_review
    topic = Column(String(150), nullable=True)
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
    messages = relationship(
        "TutorMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="TutorMessage.created_at",
    )

    def __repr__(self) -> str:
        return f"<TutorSession {self.id[:8]} ({self.pedagogical_mode})>"


class TutorMessage(Base):
    """
    Individual turn in a tutoring conversation with full source citation metadata.
    """
    __tablename__ = "tutor_messages"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    session_id = Column(
        String(36),
        ForeignKey("tutor_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    pedagogical_mode = Column(String(50), nullable=True)
    citations_json = Column(Text, nullable=True)  # JSON-encoded List[SourceCitation]
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    session = relationship("TutorSession", back_populates="messages")

    def __repr__(self) -> str:
        return f"<TutorMessage {self.sender} in {self.session_id[:8]}>"
