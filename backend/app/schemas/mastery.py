"""Pydantic schemas for Bayesian Knowledge Tracing (BKT) and Learner Mastery."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ConceptMasteryResponse(BaseModel):
    """Mastery state for a single concept, returned by the API."""
    id: str
    user_id: str
    course_id: str
    concept_label: str

    # BKT State
    p_know: float = Field(description="Current P(L): probability of mastery (0.0–1.0)")
    p_learn: float
    p_guess: float
    p_slip: float
    mastery_threshold: float

    # Evidence
    total_attempts: int
    correct_attempts: int
    is_mastered: bool
    priority_score: float

    # Trend data (list of historical p_know values for sparkline)
    p_know_history: List[float] = Field(default_factory=list)

    # Derived fields
    mastery_percentage: float = Field(description="p_know * 100 for display")
    accuracy_rate: float = Field(description="correct_attempts / total_attempts (0–1)")
    mastery_status: str = Field(description="mastered | developing | needs_work | not_started")

    last_updated: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CourseMasteryResponse(BaseModel):
    """Full mastery summary for a course — all concepts sorted by priority."""
    course_id: str
    total_concepts: int
    mastered_concepts: int
    overall_mastery_percentage: float
    concepts: List[ConceptMasteryResponse]


class BKTUpdateRequest(BaseModel):
    """Manual BKT parameter override (for advanced users or admin tuning)."""
    concept_label: str
    p_know: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    p_learn: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    p_guess: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    p_slip: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class AdaptiveRecommendation(BaseModel):
    """A single adaptive topic recommendation for the next study session."""
    concept_label: str
    p_know: float
    mastery_status: str
    priority_score: float
    reason: str
    recommended_bloom_levels: List[str]
    estimated_questions_to_mastery: int


class AdaptiveRecommendationsResponse(BaseModel):
    """Ranked list of adaptive recommendations for student's next session."""
    course_id: str
    overall_mastery_percentage: float
    recommendations: List[AdaptiveRecommendation]
    mastered_count: int
    total_count: int
