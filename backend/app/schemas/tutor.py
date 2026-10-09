"""Pydantic schemas for AI Tutor sessions, messages, and pedagogical mode configs."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.rag import SourceCitation


# Supported 7 Pedagogical Modes
VALID_PEDAGOGICAL_MODES = [
    "socratic",
    "analogy",
    "first_principles",
    "misconception_buster",
    "exam_prep",
    "deep_dive",
    "quick_review",
]


class TutorSessionCreate(BaseModel):
    """Payload to initialize a new multi-turn tutoring session."""
    title: Optional[str] = Field(None, max_length=255, description="Session title or focus concept")
    pedagogical_mode: str = Field(
        default="socratic",
        description="Active pedagogical mode: socratic, analogy, first_principles, misconception_buster, exam_prep, deep_dive, quick_review",
    )
    topic: Optional[str] = Field(None, description="Optional curriculum topic focus")


class RemediationSessionCreate(BaseModel):
    """Payload to initialize a targeted AI Tutor remediation session."""
    source_type: str = Field(
        default="assessment_mistake",
        description="Source type: 'assessment_mistake' or 'bkt_concept'",
    )
    attempt_id: Optional[str] = Field(None, description="Diagnostic test attempt ID")
    question_id: Optional[str] = Field(None, description="Target question ID from attempt")
    concept_label: Optional[str] = Field(None, description="Concept label for BKT mastery remediation")
    question_text: Optional[str] = Field(None, description="Failed question snippet")
    student_answer: Optional[str] = Field(None, description="Student's erroneous answer")
    correct_answer: Optional[str] = Field(None, description="Correct answer definition")
    error_category: Optional[str] = Field(None, description="Error taxonomy category")
    misconception_explanation: Optional[str] = Field(None, description="Explanation of error/trap")
    pedagogical_mode: str = Field(
        default="misconception_buster",
        description="Active pedagogical mode: socratic, analogy, first_principles, misconception_buster, exam_prep, deep_dive, quick_review",
    )


class TutorSessionUpdateMode(BaseModel):
    """Payload to dynamically adjust pedagogical mode mid-conversation."""
    pedagogical_mode: str = Field(
        ...,
        description="New pedagogical mode: socratic, analogy, first_principles, misconception_buster, exam_prep, deep_dive, quick_review",
    )


class TutorMessageCreate(BaseModel):
    """Student conversational turn message payload."""
    content: str = Field(..., min_length=1, description="Student question, answer, or thought")
    language: Optional[str] = Field("english", description="Preferred response language: 'english' or 'hinglish'")


class TutorMessageResponse(BaseModel):
    """Dialogue message turn with associated grounded citations."""
    id: str
    session_id: str
    sender: str  # "user" or "assistant"
    content: str
    pedagogical_mode: Optional[str] = None
    citations: List[SourceCitation] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TutorSessionResponse(BaseModel):
    """Summary of a tutoring dialogue session."""
    id: str
    course_id: str
    user_id: str
    title: str
    pedagogical_mode: str
    topic: Optional[str] = None
    messages_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TutorSessionDetailResponse(TutorSessionResponse):
    """Full session history including all sequential dialogue messages and citations."""
    messages: List[TutorMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)
