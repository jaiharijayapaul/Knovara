"""Pydantic schemas for Comprehensive Learning Analytics & Progress Telemetry."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class LearnerVelocity(BaseModel):
    """Aggregate learner velocity and study engagement metrics."""
    overall_mastery_pct: float = Field(..., description="Average BKT P(L) across all concepts, 0-100")
    mastered_concepts_count: int = Field(..., description="Number of concepts with P(L) >= 0.85")
    total_concepts_count: int = Field(..., description="Total concepts tracked in course")
    mastery_velocity: float = Field(..., description="Average P(L) change per assessment attempt / session")
    study_streak_days: int = Field(default=1, description="Consecutive active study days")
    total_study_time_minutes: int = Field(..., description="Estimated total study time in minutes")
    total_interactions: int = Field(..., description="Total attempts + reviews + tutor messages")
    assessment_attempts_count: int = Field(..., description="Total completed assessment attempts")
    flashcard_reviews_count: int = Field(..., description="Total completed flashcard reviews")
    tutor_messages_count: int = Field(..., description="Total student tutor dialogue turns")


class BloomCognitiveTelemetry(BaseModel):
    """Performance breakdown per Bloom's Revised Taxonomy level."""
    level: str = Field(..., description="remember | understand | apply | analyze | evaluate | create")
    display_name: str
    total_questions: int
    correct_questions: int
    accuracy_pct: float
    description: str


class MisconceptionTelemetry(BaseModel):
    """Diagnostic frequency and impact of cognitive error categories."""
    error_category: str
    display_name: str
    count: int
    percentage: float
    remediation_advice: str
    affected_concepts: List[str] = Field(default_factory=list)


class RetentionForecastDay(BaseModel):
    """Daily projected retention and upcoming review workload."""
    day_offset: int
    date_str: str
    projected_retention_pct: float
    cards_due: int


class RetentionForecast(BaseModel):
    """Spaced Repetition retention decay model and upcoming review forecast."""
    active_cards: int
    mature_cards: int
    learning_cards: int
    average_ease_factor: float
    predicted_retention_pct: float
    due_today: int
    due_in_3_days: int
    due_in_7_days: int
    due_in_14_days: int
    forecast_days: List[RetentionForecastDay] = Field(default_factory=list)


class ActivityTimelinePoint(BaseModel):
    """Daily activity volume and aggregate mastery snapshot."""
    date: str
    assessments_count: int
    reviews_count: int
    tutor_messages_count: int
    mastery_snapshot: float


class ConceptMatrixItem(BaseModel):
    """Concept-level mastery status row for analytics matrix."""
    concept_label: str
    p_know: float
    is_mastered: bool
    status: str  # 'Mastered' | 'In Progress' | 'Needs Attention' | 'Unassessed'
    priority_score: float
    history: List[float] = Field(default_factory=list)


class CourseAnalyticsReport(BaseModel):
    """Comprehensive course analytics telemetry report."""
    course_id: str
    course_name: str
    generated_at: datetime
    velocity: LearnerVelocity
    bloom_telemetry: List[BloomCognitiveTelemetry]
    misconception_telemetry: List[MisconceptionTelemetry]
    retention_forecast: RetentionForecast
    activity_timeline: List[ActivityTimelinePoint]
    concept_matrix: List[ConceptMatrixItem]
    executive_summary: str
