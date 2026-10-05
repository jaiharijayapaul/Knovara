"""Pydantic schemas for Course and Topic management."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class TopicBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Topic name")
    description: Optional[str] = Field(None, description="Topic conceptual summary")
    parent_topic_id: Optional[str] = Field(None, description="Optional parent topic for hierarchy")


class TopicCreate(TopicBase):
    pass


class TopicResponse(TopicBase):
    id: str
    course_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CourseBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Course title")
    description: Optional[str] = Field(None, description="Course curriculum or syllabus description")
    subject: str = Field("Computer Science", min_length=2, max_length=100, description="Academic domain / discipline")


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, min_length=2, max_length=100)


class CourseResponse(CourseBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    topics_count: int = 0
    documents_count: int = 0
    study_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CourseDetailResponse(CourseResponse):
    topics: List[TopicResponse] = []

    model_config = ConfigDict(from_attributes=True)
