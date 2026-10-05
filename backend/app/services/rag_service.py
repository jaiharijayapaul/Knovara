"""RAG Orchestration service coordinating semantic retrieval, grounded synthesis, and index management."""

import json
import logging
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.course_repository import CourseRepository
from app.repositories.document_repository import DocumentRepository
from app.rag.embeddings import EmbeddingEngine, EMBEDDING_DIM
from app.rag.retriever import HybridRetriever
from app.rag.generator import GroundedGenerator
from app.schemas.rag import (
    RAGQueryRequest,
    RAGResponse,
    RAGIndexStatusResponse,
)

logger = logging.getLogger(__name__)


class RAGService:
    """Manages course knowledge base indexing and grounded citation query processing."""

    @staticmethod
    def _verify_course_ownership(db: Session, course_id: str, user_id: str):
        """Ensure course workspace belongs to the authenticated student."""
        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found or you do not have permission.",
            )
        return course

    @classmethod
    async def query(
        cls, db: Session, course_id: str, user_id: str, request: RAGQueryRequest
    ) -> RAGResponse:
        """
        Execute grounded RAG query across course knowledge base and return source-cited answer.
        """
        course = cls._verify_course_ownership(db, course_id, user_id)

        # Retrieve all chunks belonging to this course
        docs = DocumentRepository.list_by_course(db, course_id)
        all_chunks = []
        for doc in docs:
            all_chunks.extend(doc.chunks)

        if not all_chunks:
            return RAGResponse(
                query=request.query,
                answer=(
                    f"No study materials have been uploaded or seeded to the **{course.name}** workspace yet. "
                    f"Please upload course textbooks, slides, or lecture videos to enable grounded tutoring."
                ),
                course_id=course_id,
                citations=[],
                retrieved_count=0,
                grounded=False,
                model_used="knovara-empty-kb",
            )

        # 1. Retrieve top matching citations using Hybrid Retriever
        citations = HybridRetriever.retrieve(
            query=request.query,
            chunks=all_chunks,
            topic_filter=request.topic,
            top_k=request.top_k,
        )

        # 2. Synthesize grounded answer
        answer, is_grounded, model_used = await GroundedGenerator.generate_answer(
            query=request.query,
            citations=citations,
            course_name=course.name,
        )

        return RAGResponse(
            query=request.query,
            answer=answer,
            course_id=course_id,
            citations=citations,
            retrieved_count=len(citations),
            grounded=is_grounded,
            model_used=model_used,
        )

    @classmethod
    def index_course_chunks(
        cls, db: Session, course_id: str, user_id: str
    ) -> RAGIndexStatusResponse:
        """
        Compute and cache semantic vector embeddings for all course document chunks.
        """
        cls._verify_course_ownership(db, course_id, user_id)
        docs = DocumentRepository.list_by_course(db, course_id)

        total_chunks = 0
        indexed_count = 0

        for doc in docs:
            for chunk in doc.chunks:
                total_chunks += 1
                meta = {}
                if chunk.metadata_json:
                    try:
                        meta = json.loads(chunk.metadata_json)
                    except Exception:
                        meta = {}

                if "embedding" not in meta or len(meta["embedding"]) != EMBEDDING_DIM:
                    vector = EmbeddingEngine.embed_text(chunk.content)
                    meta["embedding"] = vector
                    chunk.metadata_json = json.dumps(meta)
                    indexed_count += 1
                else:
                    indexed_count += 1

        db.commit()
        logger.info(f"Indexed {indexed_count}/{total_chunks} chunks for course {course_id}")

        return RAGIndexStatusResponse(
            course_id=course_id,
            total_chunks=total_chunks,
            indexed_chunks=indexed_count,
            embedding_dimension=EMBEDDING_DIM,
            embedding_model="knovara-hybrid-embed-256",
        )

    @classmethod
    def get_index_status(
        cls, db: Session, course_id: str, user_id: str
    ) -> RAGIndexStatusResponse:
        """
        Check vector indexing readiness for course knowledge base.
        """
        cls._verify_course_ownership(db, course_id, user_id)
        docs = DocumentRepository.list_by_course(db, course_id)

        total_chunks = 0
        indexed_chunks = 0

        for doc in docs:
            for chunk in doc.chunks:
                total_chunks += 1
                if chunk.metadata_json:
                    try:
                        meta = json.loads(chunk.metadata_json)
                        if "embedding" in meta and len(meta["embedding"]) == EMBEDDING_DIM:
                            indexed_chunks += 1
                    except Exception:
                        pass

        return RAGIndexStatusResponse(
            course_id=course_id,
            total_chunks=total_chunks,
            indexed_chunks=indexed_chunks,
            embedding_dimension=EMBEDDING_DIM,
            embedding_model="knovara-hybrid-embed-256",
        )
