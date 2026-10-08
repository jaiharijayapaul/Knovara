"""Pydantic schemas for Document and DocumentChunk entities."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class DocumentChunkResponse(BaseModel):
    id: str
    document_id: str
    course_id: str
    content: str
    chunk_index: int
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    topic: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    id: str
    course_id: str
    filename: str
    file_type: str
    file_size: int
    processing_status: str
    processing_error: Optional[str] = None
    chunks_count: int = 0
    ai_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDetailResponse(DocumentResponse):
    chunks: List[DocumentChunkResponse] = []

    model_config = ConfigDict(from_attributes=True)


class YouTubeIngestRequest(BaseModel):
    """Payload for ingesting a YouTube video into course knowledge base."""
    url: str = Field(..., min_length=5, description="YouTube video or lecture URL")
    title: Optional[str] = Field(None, description="Optional custom lecture title override")
    manual_transcript: Optional[str] = Field(
        None, description="Optional raw or timestamped transcript text pasted directly by user as a fallback"
    )
