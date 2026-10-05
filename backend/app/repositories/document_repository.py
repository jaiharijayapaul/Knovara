"""Repository for Document and DocumentChunk database operations."""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentChunk


class DocumentRepository:
    """Encapsulates data access queries for documents and extracted semantic chunks."""

    @staticmethod
    def list_by_course(db: Session, course_id: str) -> List[Document]:
        """List all documents uploaded to a specific course workspace."""
        return db.query(Document).filter(Document.course_id == course_id).order_by(Document.created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, document_id: str, course_id: Optional[str] = None) -> Optional[Document]:
        """Retrieve a single document with optional course workspace boundary."""
        query = db.query(Document).filter(Document.id == document_id)
        if course_id:
            query = query.filter(Document.course_id == course_id)
        return query.first()

    @staticmethod
    def create(
        db: Session,
        course_id: str,
        filename: str,
        file_type: str,
        storage_url: str,
        file_size: int = 0,
    ) -> Document:
        """Create a new document record in UPLOADED status."""
        doc = Document(
            course_id=course_id,
            filename=filename,
            file_type=file_type,
            storage_url=storage_url,
            file_size=file_size,
            processing_status="UPLOADED",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    @staticmethod
    def delete(db: Session, document: Document) -> None:
        """Delete document and all associated chunks."""
        db.delete(document)
        db.commit()

    @staticmethod
    def list_chunks_by_document(db: Session, document_id: str) -> List[DocumentChunk]:
        """List all semantic chunks for a document."""
        return db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index.asc()).all()

    @staticmethod
    def count_by_course(db: Session, course_id: str) -> int:
        """Count total documents in a course workspace."""
        return db.query(Document).filter(Document.course_id == course_id).count()
