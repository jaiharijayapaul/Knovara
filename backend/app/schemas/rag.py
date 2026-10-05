"""Pydantic schemas for Grounded RAG queries, source citations, and index status."""

from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class RAGQueryRequest(BaseModel):
    """Student query payload for grounded RAG retrieval and synthesis."""
    query: str = Field(..., min_length=2, description="Student study question or concept prompt")
    topic: Optional[str] = Field(None, description="Optional curriculum topic filter")
    top_k: int = Field(default=4, ge=1, le=10, description="Maximum number of citation chunks to retrieve")


class SourceCitation(BaseModel):
    """Source citation metadata pointing to exact multimodal coordinates."""
    chunk_id: str
    document_id: str
    document_name: str
    file_type: str  # pdf, pptx, video, audio, text
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    topic: Optional[str] = None
    snippet: str
    score: float
    semantic_score: float
    keyword_score: float
    citation_label: str  # e.g. "[Doc 1: Page 42]" or "[Doc 2: Slide 18]" or "[Doc 3: 18:20-20:05]"

    model_config = ConfigDict(from_attributes=True)


class RAGResponse(BaseModel):
    """Synthesized grounded answer with inline citations and verified source list."""
    query: str
    answer: str
    course_id: str
    citations: List[SourceCitation] = []
    retrieved_count: int = 0
    grounded: bool = True
    model_used: str = "knovara-grounded-rag-v1"


class RAGIndexStatusResponse(BaseModel):
    """Status of the course's semantic vector index."""
    course_id: str
    total_chunks: int
    indexed_chunks: int
    embedding_dimension: int = 256
    embedding_model: str = "knovara-hybrid-embed-256"
