"""Document and DocumentChunk models for multimodal knowledge base storage."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator
from app.database import Base

try:
    from pgvector.sqlalchemy import Vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False


class VectorType(TypeDecorator):
    """Platform-independent vector type that stores native vectors on PostgreSQL and text on SQLite."""
    impl = Text
    cache_ok = True

    def __init__(self, dim: int = 768, *args, **kwargs):
        self.dim = dim
        super().__init__(*args, **kwargs)

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql" and HAS_PGVECTOR:
            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql" and HAS_PGVECTOR:
            if isinstance(value, (list, tuple)):
                if len(value) < self.dim:
                    value = list(value) + [0.0] * (self.dim - len(value))
                elif len(value) > self.dim:
                    value = list(value)[:self.dim]
            return value
        if isinstance(value, (list, tuple)):
            import json
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql" and HAS_PGVECTOR:
            return value
        if isinstance(value, str):
            import json
            try:
                return json.loads(value)
            except Exception:
                return value
        return value


class Document(Base):
    """
    Uploaded course learning material (PDF textbook, PPTX slides, lecture video/audio).
    Tracks extraction status lifecycle: UPLOADED -> PROCESSING -> COMPLETED | FAILED.
    """
    __tablename__ = "documents"

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
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, pptx, video, audio, text
    storage_url = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0, nullable=False)
    processing_status = Column(String(50), default="UPLOADED", nullable=False)  # UPLOADED, PROCESSING, COMPLETED, FAILED
    processing_error = Column(Text, nullable=True)
    ai_notes = Column(Text, nullable=True)
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
    course = relationship("Course", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan", order_by="DocumentChunk.chunk_index")

    def __repr__(self) -> str:
        return f"<Document {self.filename} ({self.processing_status})>"


class DocumentChunk(Base):
    """
    Semantic chunk extracted from learning material.
    Preserves exact source citations: page number, slide number, or video timestamp range.
    """
    __tablename__ = "document_chunks"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    document_id = Column(
        String(36),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_id = Column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)          # For PDF citations
    slide_number = Column(Integer, nullable=True)         # For PPTX citations
    timestamp_start = Column(String(20), nullable=True)   # For Video start timestamp, e.g. "18:20"
    timestamp_end = Column(String(20), nullable=True)     # For Video end timestamp, e.g. "20:05"
    topic = Column(String(150), nullable=True)
    metadata_json = Column(Text, nullable=True)
    embedding = Column(VectorType(dim=768), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    document = relationship("Document", back_populates="chunks")

    def __repr__(self) -> str:
        return f"<DocumentChunk doc={self.document_id} idx={self.chunk_index}>"
