"""Pydantic schemas for the Knovara Admin Command Center."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class AdminStatsResponse(BaseModel):
    """Platform-wide metric summary for the admin KPI dashboard."""
    total_users: int
    total_students: int
    total_instructors: int
    total_admins: int
    total_courses: int
    total_documents: int
    total_chunks: int
    total_topics: int
    total_flashcards: int
    total_assessments: int
    total_tutor_sessions: int
    total_storage_bytes: int
    database_status: str
    database_dialect: str
    model_config = ConfigDict(from_attributes=True)


class AdminUserItem(BaseModel):
    """User summary item for administrative management."""
    id: str
    name: str
    email: str
    role: str
    education_level: str
    courses_count: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AdminRoleUpdateRequest(BaseModel):
    """Payload to promote/demote or update a user's role."""
    role: str = Field(..., pattern="^(student|instructor|admin)$", description="Target role: student, instructor, or admin")


class AdminCourseItem(BaseModel):
    """Course summary item for administrative fleet oversight."""
    id: str
    name: str
    subject: str
    description: Optional[str] = None
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    documents_count: int = 0
    topics_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AdminActivityItem(BaseModel):
    """Audit log activity event."""
    id: str
    type: str  # "document_upload", "tutor_session", "assessment_attempt", "course_created"
    title: str
    detail: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    timestamp: datetime
