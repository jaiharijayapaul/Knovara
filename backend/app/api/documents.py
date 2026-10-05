"""Document and Knowledge Base Material Ingestion API endpoints."""

from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.document import (
    DocumentResponse,
    DocumentDetailResponse,
)
from app.services.document_service import DocumentService

router = APIRouter(prefix="/courses/{course_id}/documents", tags=["Documents"])


@router.get(
    "",
    response_model=List[DocumentResponse],
    status_code=status.HTTP_200_OK,
    summary="List course documents",
    description="Returns all uploaded multimodal materials and processing statuses for the specified course workspace.",
)
def list_documents(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List documents for a course."""
    return DocumentService.list_documents(db=db, course_id=course_id, user_id=current_user.id)


@router.post(
    "",
    response_model=DocumentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest course document",
    description="Accepts PDF, PPTX, MP4, WebM, MP3, WAV, TXT, VTT, or SRT files and runs the processing pipeline.",
)
async def upload_document(
    course_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    run_async: bool = Query(default=False, description="Process document ingestion asynchronously in background"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload and process a multimodal document with optional background task queue."""
    return DocumentService.process_upload(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        file=file,
        background_tasks=background_tasks if run_async else None,
    )


@router.post(
    "/batch",
    response_model=List[DocumentDetailResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload multiple course documents at once",
    description="Accepts multiple files (PDF, PPTX, MP4, WebM, MP3, WAV, TXT, VTT, SRT) and processes each into citation chunks and AI study notes.",
)
async def upload_multiple_documents(
    course_id: str,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    run_async: bool = Query(default=False, description="Process document ingestion asynchronously in background"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload and process multiple documents simultaneously with optional background task queue."""
    results = []
    for f in files:
        doc = DocumentService.process_upload(
            db=db,
            course_id=course_id,
            user_id=current_user.id,
            file=f,
            background_tasks=background_tasks if run_async else None,
        )
        results.append(doc)
    return results


@router.post(
    "/demo-seed",
    response_model=List[DocumentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Seed canonical multimodal demo materials",
    description="Seeds PDF textbook (Ch 4, Page 42), PPTX slides (Lecture 5, Slide 18), and Video transcript (18:20-20:05).",
)
def seed_demo_materials(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seed sample multimodal materials with verified citations into the course workspace."""
    return DocumentService.seed_demo_materials(
        db=db, course_id=course_id, user_id=current_user.id
    )


@router.post(
    "/synthesize",
    status_code=status.HTTP_200_OK,
    summary="Synthesize study workspace from uploaded live materials",
    description="Extracts curriculum syllabus topics, initializes BKT mastery states, and generates grounded flashcards and diagnostic assessments strictly from the uploaded course materials.",
)
async def synthesize_materials(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Synthesize learning assets directly from live uploaded documents."""
    return await DocumentService.synthesize_live_materials(
        db=db, course_id=course_id, user_id=current_user.id
    )


@router.get(
    "/{document_id}",
    response_model=DocumentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get document details and extracted chunks",
    description="Retrieves document metadata along with all extracted semantic chunks and citations.",
)
def get_document(
    course_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single document with chunks."""
    return DocumentService.get_document_detail(
        db=db, course_id=course_id, document_id=document_id, user_id=current_user.id
    )


@router.get(
    "/{document_id}/notes",
    status_code=status.HTTP_200_OK,
    summary="Get or generate AI Study Notes for a specific uploaded document",
)
async def get_document_notes(
    course_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve or dynamically synthesize AI Study Notes for an uploaded material."""
    from fastapi import HTTPException
    from app.services.notes_service import NotesService
    from app.repositories.document_repository import DocumentRepository
    from app.repositories.course_repository import CourseRepository

    course = CourseRepository.get_by_id(db, course_id, user_id=current_user.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    doc = DocumentRepository.get_by_id(db, document_id, course_id=course_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if not doc.ai_notes:
        doc.ai_notes = await NotesService.generate_notes_for_document(db, doc, course.name)

    return {
        "document_id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "ai_notes": doc.ai_notes,
    }


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete course document",
    description="Deletes document record, cascading extracted chunks, and associated citations.",
)
def delete_document(
    course_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document."""
    DocumentService.delete_document(
        db=db, course_id=course_id, document_id=document_id, user_id=current_user.id
    )
    return None
