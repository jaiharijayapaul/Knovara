"""SQLAlchemy models for Assessments and Bloom's Taxonomy Questions."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Assessment(Base):
    """
    Assessment containing grounded questions categorized by cognitive Bloom level and difficulty.
    """
    __tablename__ = "assessments"

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
    topic = Column(String(150), nullable=True)
    difficulty = Column(String(50), default="medium", nullable=False)  # easy, medium, hard, adaptive
    is_adaptive = Column(Boolean, default=False, nullable=True)
    time_limit_minutes = Column(Integer, default=15, nullable=True)
    total_points = Column(Float, default=100.0, nullable=False)
    pass_percentage = Column(Float, default=70.0, nullable=False)
    status = Column(String(50), default="published", nullable=False)  # draft, published, archived
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
    questions = relationship(
        "Question",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
        lazy="selectin",
    )
    attempts = relationship(
        "AssessmentAttempt",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="AssessmentAttempt.created_at.desc()",
        lazy="selectin",
    )


class Question(Base):
    """
    Individual assessment question mapped to Bloom's Taxonomy cognitive level,
    source document citation coordinate, and diagnostic misconception explanations.
    """
    __tablename__ = "questions"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    assessment_id = Column(
        String(36),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_id = Column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic = Column(String(150), nullable=True)
    bloom_level = Column(
        String(50),
        default="understand",
        nullable=False,
    )  # remember, understand, apply, analyze, evaluate, create
    difficulty = Column(String(50), default="medium", nullable=False)  # easy, medium, hard
    question_type = Column(
        String(50),
        default="multiple_choice",
        nullable=False,
    )  # multiple_choice, multiple_select, true_false, short_answer
    question_text = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)  # JSON serialized list of option dicts
    correct_answer_json = Column(Text, nullable=False)  # JSON serialized correct answer(s)
    explanation = Column(Text, nullable=False)  # Pedagogical explanation of the solution
    points = Column(Float, default=10.0, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)

    # Grounded multimodal coordinates
    citation_label = Column(String(50), nullable=True)  # e.g., "[Doc 1: Page 42]"
    document_name = Column(String(255), nullable=True)
    page_number = Column(Integer, nullable=True)
    slide_number = Column(Integer, nullable=True)
    timestamp_start = Column(String(20), nullable=True)
    timestamp_end = Column(String(20), nullable=True)
    source_snippet = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    assessment = relationship("Assessment", back_populates="questions")
    course = relationship("Course")


class AssessmentAttempt(Base):
    """
    Completed or submitted assessment attempt with aggregate psychometric scores,
    pass/fail outcomes, and diagnostic summaries.
    """
    __tablename__ = "assessment_attempts"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    assessment_id = Column(
        String(36),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
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
    score = Column(Float, nullable=False)
    total_points = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)
    passed = Column(Boolean, nullable=False)
    time_spent_seconds = Column(Integer, default=0, nullable=False)
    error_summary_json = Column(Text, nullable=True)  # Categorized error count breakdown
    bloom_summary_json = Column(Text, nullable=True)  # Bloom level accuracy metrics
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    assessment = relationship("Assessment", back_populates="attempts")
    course = relationship("Course")
    user = relationship("User")
    response_logs = relationship(
        "QuestionResponseLog",
        back_populates="attempt",
        cascade="all, delete-orphan",
        order_by="QuestionResponseLog.created_at",
        lazy="selectin",
    )


class QuestionResponseLog(Base):
    """
    Granular diagnostic log for a single question response within an attempt,
    paired with Error Taxonomy classification and remediation guidance.
    """
    __tablename__ = "question_response_logs"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    attempt_id = Column(
        String(36),
        ForeignKey("assessment_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id = Column(
        String(36),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    selected_answers_json = Column(Text, nullable=False)  # JSON array of selected options e.g. ["B"]
    is_correct = Column(Boolean, nullable=False)
    points_earned = Column(Float, nullable=False)
    points_possible = Column(Float, nullable=False)
    bloom_level = Column(String(50), nullable=False)
    error_category = Column(
        String(50),
        default="none",
        nullable=False,
    )  # factual_misconception, procedural_slip, formula_inversion, dimensionality_confusion, unchecked_assumption, none
    misconception_diagnosis = Column(Text, nullable=True)
    remediation_hint = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    attempt = relationship("AssessmentAttempt", back_populates="response_logs")
    question = relationship("Question")

