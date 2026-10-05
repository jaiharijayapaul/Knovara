"""SQLAlchemy model for Learner Concept Mastery state tracking (BKT)."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class LearnerConceptMastery(Base):
    """
    Persistent BKT mastery state for a specific (user, course, concept) triple.

    Each row represents the current estimated probability that student `user_id`
    has mastered `concept_label` within course `course_id`.

    BKT parameters (p_know, p_learn, p_guess, p_slip) are stored here so they
    can be fine-tuned per-student per-concept as more data accumulates.
    The `p_know` column is updated after every scored assessment attempt.
    """
    __tablename__ = "learner_concept_mastery"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_id = Column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Concept label — uses question.topic or question.bloom_level:concept if topic absent
    concept_label = Column(String(200), nullable=False, index=True)

    # ---- BKT State ----
    # P(L_0): Current probability that learner has mastered this concept
    p_know = Column(Float, default=0.30, nullable=False)

    # BKT model hyperparameters (can be tuned per student/concept)
    p_learn = Column(Float, default=0.25, nullable=False)  # P(T): transition to mastered
    p_guess = Column(Float, default=0.15, nullable=False)  # P(G): guess correctly
    p_slip  = Column(Float, default=0.10, nullable=False)  # P(S): slip despite knowing

    mastery_threshold = Column(Float, default=0.95, nullable=False)

    # ---- Evidence Counters ----
    total_attempts   = Column(Integer, default=0, nullable=False)
    correct_attempts = Column(Integer, default=0, nullable=False)
    is_mastered      = Column(Boolean, default=False, nullable=False)

    # ---- Adaptive Priority ----
    # Higher priority → surface this concept sooner in remediation
    priority_score = Column(Float, default=1.0, nullable=False)

    # Serialised history of p_know values (for sparkline charts)
    # JSON array: [0.30, 0.42, 0.55, ...]
    p_know_history_json = Column(Text, nullable=True)

    last_updated = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user   = relationship("User")
    course = relationship("Course")
