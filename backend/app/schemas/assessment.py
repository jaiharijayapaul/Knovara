"""Pydantic schemas for Assessments, Bloom's Taxonomy questions, and generation requests."""

from datetime import datetime
from typing import List, Optional, Literal, Dict, Union, Any
from pydantic import BaseModel, Field, ConfigDict

BloomLevel = Literal[
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
]

QuestionType = Literal[
    "multiple_choice",
    "multiple_select",
    "true_false",
    "short_answer",
]

AssessmentDifficulty = Literal[
    "easy",
    "medium",
    "hard",
    "adaptive",
]


class QuestionOption(BaseModel):
    """Option for multiple choice or multi-select questions."""
    id: str = Field(..., description="Option identifier e.g. 'A', 'B', 'C', 'D'")
    text: str = Field(..., description="The option text content")
    is_correct: bool = Field(default=False, description="Whether this option is a correct answer")
    misconception: Optional[str] = Field(
        default=None,
        description="Diagnostic trap or misconception this distractor represents if chosen"
    )


class QuestionOptionStudent(BaseModel):
    """Sanitized option stripped of answer indicators for student test taking."""
    id: str
    text: str


class QuestionBase(BaseModel):
    topic: Optional[str] = None
    bloom_level: BloomLevel = "understand"
    difficulty: str = "medium"
    question_type: QuestionType = "multiple_choice"
    question_text: str
    options: List[QuestionOption] = Field(default_factory=list)
    correct_answers: List[str] = Field(default_factory=list)
    explanation: str
    points: float = 10.0
    citation_label: Optional[str] = None
    document_name: Optional[str] = None
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    source_snippet: Optional[str] = None


class QuestionCreate(QuestionBase):
    pass


class QuestionResponse(QuestionBase):
    id: str
    assessment_id: str
    course_id: str
    order_index: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuestionStudentView(BaseModel):
    """Redacted question view for active examination."""
    id: str
    assessment_id: str
    topic: Optional[str] = None
    bloom_level: BloomLevel
    difficulty: str
    question_type: QuestionType
    question_text: str
    options: List[QuestionOptionStudent] = Field(default_factory=list)
    points: float
    order_index: int
    citation_label: Optional[str] = None
    document_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AssessmentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    topic: Optional[str] = None
    difficulty: AssessmentDifficulty = "medium"
    time_limit_minutes: Optional[int] = Field(default=15, ge=1, le=180)
    pass_percentage: Optional[float] = Field(default=70.0, ge=0.0, le=100.0)


class AssessmentGenerateRequest(BaseModel):
    """Specification for AI-driven Bloom taxonomy assessment generation."""
    title: Optional[str] = Field(default=None, description="Custom title or auto-generated")
    topic: Optional[str] = Field(default=None, description="Focus topic or comprehensive course scope")
    num_questions: int = Field(default=5, ge=1, le=20, description="Number of questions to generate")
    difficulty: AssessmentDifficulty = Field(default="medium")
    bloom_levels: Optional[List[BloomLevel]] = Field(
        default=None,
        description="Explicit cognitive levels to target; if omitted, distributes evenly across Bloom's Taxonomy"
    )
    question_types: Optional[List[QuestionType]] = Field(
        default=None,
        description="Question formats to include (defaults to multiple_choice)"
    )
    adaptive_mode: bool = Field(
        default=False,
        description="When true, question topics and Bloom cognitive levels are dynamically prioritized based on the student's Bayesian Knowledge Tracing mastery model."
    )


class AssessmentResponse(BaseModel):
    id: str
    course_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    topic: Optional[str] = None
    difficulty: str
    is_adaptive: bool = Field(default=False)
    time_limit_minutes: Optional[int] = None
    total_points: float
    pass_percentage: float
    status: str
    questions_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssessmentDetailResponse(AssessmentResponse):
    questions: List[QuestionResponse] = Field(default_factory=list)


class AssessmentStudentDetailResponse(AssessmentResponse):
    """Assessment view for students taking the test without answers."""
    questions: List[QuestionStudentView] = Field(default_factory=list)


class AssessmentSubmitRequest(BaseModel):
    """Student submission payload containing answers and completion duration."""
    answers: Optional[Dict[str, Union[str, List[str]]]] = Field(
        default=None,
        description="Map of question_id to selected option id(s), e.g. {'q1': 'B'} or {'q2': ['A', 'C']}"
    )
    responses: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="List of question response objects [{'question_id': '...', 'selected_answers': [...]}]"
    )
    time_spent_seconds: int = Field(default=0, ge=0)


class QuestionResultResponse(BaseModel):
    """Diagnostic evaluation for an individual question response."""
    question_id: str
    order_index: int
    question_text: str
    bloom_level: str
    points_possible: float
    points_earned: float
    selected_answers: List[str]
    correct_answers: List[str]
    is_correct: bool
    error_category: str
    misconception_diagnosis: Optional[str] = None
    remediation_hint: Optional[str] = None
    explanation: str
    citation_label: Optional[str] = None
    document_name: Optional[str] = None
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    source_snippet: Optional[str] = None


class AssessmentAttemptResponse(BaseModel):
    """Summary of a completed assessment attempt."""
    id: str
    assessment_id: str
    course_id: str
    user_id: str
    score: float
    total_points: float
    percentage: float
    passed: bool
    time_spent_seconds: int
    error_summary: Dict[str, int] = Field(default_factory=dict)
    bloom_summary: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssessmentAttemptDetailResponse(AssessmentAttemptResponse):
    """Full diagnostic attempt report with question-level error classifications."""
    question_results: List[QuestionResultResponse] = Field(default_factory=list)

