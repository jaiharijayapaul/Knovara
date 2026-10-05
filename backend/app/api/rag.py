"""Grounded RAG and Source Citations API router."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.utils.rate_limit import limiter
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.rag import (
    RAGQueryRequest,
    RAGResponse,
    RAGIndexStatusResponse,
)
from app.services.rag_service import RAGService

router = APIRouter(prefix="/courses/{course_id}/rag", tags=["Grounded RAG"])


@router.post(
    "/query",
    response_model=RAGResponse,
    status_code=status.HTTP_200_OK,
    summary="Query Grounded RAG with exact source citations",
    description=(
        "Executes hybrid retrieval (dense semantic search + sparse keyword overlap + topic alignment) "
        "across the course knowledge base and synthesizes a verified answer with exact multimodal citations "
        "(page number, slide number, or video timestamp range)."
    ),
)
@limiter.limit(settings.LLM_RATE_LIMIT)
async def query_rag(
    request: Request,
    course_id: str,
    payload: RAGQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run grounded RAG query against course knowledge base."""
    return await RAGService.query(
        db=db, course_id=course_id, user_id=current_user.id, request=payload
    )


@router.post(
    "/index",
    response_model=RAGIndexStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Index course knowledge base chunks",
    description="Computes and persists 256-dimensional semantic vector embeddings for all unindexed chunks.",
)
def index_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Index or re-index course semantic vectors."""
    return RAGService.index_course_chunks(db=db, course_id=course_id, user_id=current_user.id)


@router.get(
    "/status",
    response_model=RAGIndexStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get knowledge base vector index status",
    description="Returns total extracted chunks vs indexed vector embeddings for the course workspace.",
)
def get_index_status(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check index status."""
    return RAGService.get_index_status(db=db, course_id=course_id, user_id=current_user.id)
