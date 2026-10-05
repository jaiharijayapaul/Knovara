"""Complete document processing pipeline execution."""

import json
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentChunk
from app.processing.extractor import MultimodalExtractor
from app.processing.chunker import SemanticChunker

logger = logging.getLogger(__name__)


class ProcessingPipeline:
    """Orchestrates upload extraction, semantic chunking, and persistence."""

    @classmethod
    def execute(
        cls,
        db: Session,
        document: Document,
        file_bytes: bytes,
        course_topics: Optional[List[str]] = None,
    ) -> Document:
        """
        Execute full lifecycle pipeline for an uploaded document.
        Transitions state: UPLOADED -> PROCESSING -> COMPLETED | FAILED.
        """
        document.processing_status = "PROCESSING"
        document.processing_error = None
        db.commit()
        db.refresh(document)

        try:
            # 1. Extraction Phase
            file_type = document.file_type.lower()
            if file_type == "pdf":
                extracted_units = MultimodalExtractor.extract_pdf(file_bytes, document.filename)
            elif file_type == "pptx":
                extracted_units = MultimodalExtractor.extract_pptx(file_bytes, document.filename)
            elif file_type in ["video", "audio", "mp4", "mp3", "wav", "webm"]:
                extracted_units = MultimodalExtractor.extract_video_or_audio(file_bytes, document.filename)
            else:
                extracted_units = MultimodalExtractor.extract_text(file_bytes, document.filename)

            if not extracted_units:
                raise ValueError("No readable text or content could be extracted from this file.")

            # If course has no curriculum topics yet, automatically discover them from the uploaded content
            if not course_topics:
                try:
                    from app.models.course import Topic, Course
                    course = db.query(Course).filter(Course.id == document.course_id).first()
                    course_name = course.name if course else "Course Study"
                    from app.processing.topic_extractor import TopicExtractor
                    sample_texts = [u.get("content", "") for u in extracted_units[:8]]
                    auto_topics = TopicExtractor._extract_local_topics("\n\n".join(sample_texts), course_name)
                    if auto_topics:
                        existing_names = {t.name.lower() for t in (course.topics if course else [])}
                        added_names = []
                        for at in auto_topics:
                            if at["name"].lower() not in existing_names:
                                new_t = Topic(course_id=document.course_id, name=at["name"], description=at.get("description"))
                                db.add(new_t)
                                added_names.append(at["name"])
                        db.commit()
                        if course:
                            db.refresh(course)
                            course_topics = [t.name for t in course.topics]
                            if course.user_id:
                                from app.repositories.mastery_repository import MasteryRepository
                                for t_name in course_topics:
                                    MasteryRepository.get_or_create(db, course.user_id, document.course_id, t_name)
                                db.commit()
                        logger.info(f"Auto-extracted {len(added_names)} curriculum topics for course {document.course_id} on file upload.")
                except Exception as ex:
                    logger.warning(f"Auto topic discovery during upload note: {ex}")

            # 2. Semantic Chunking & Citation Alignment Phase
            chunks_data = SemanticChunker.chunk_extracted_units(
                extracted_units=extracted_units,
                course_topics=course_topics,
            )

            # 3. Persistence Phase
            from app.rag.embeddings import EmbeddingEngine
            for c_data in chunks_data:
                vector = EmbeddingEngine.embed_text(c_data["content"])
                meta = {
                    "filename": document.filename,
                    "file_type": document.file_type,
                    "page": c_data.get("page_number"),
                    "slide": c_data.get("slide_number"),
                    "timestamp": f"{c_data.get('timestamp_start', '')} - {c_data.get('timestamp_end', '')}".strip(" -"),
                    "embedding": vector,
                }
                chunk = DocumentChunk(
                    document_id=document.id,
                    course_id=document.course_id,
                    content=c_data["content"],
                    chunk_index=c_data["chunk_index"],
                    page_number=c_data.get("page_number"),
                    slide_number=c_data.get("slide_number"),
                    timestamp_start=c_data.get("timestamp_start"),
                    timestamp_end=c_data.get("timestamp_end"),
                    topic=c_data.get("topic"),
                    embedding=vector,
                    metadata_json=json.dumps(meta),
                )
                db.add(chunk)

            document.processing_status = "COMPLETED"
            document.processing_error = None
            db.commit()
            db.refresh(document)
            logger.info(f"Pipeline completed for '{document.filename}': generated {len(chunks_data)} citation chunks.")

            # Auto-generate AI Study Notes for the student
            try:
                from app.services.notes_service import NotesService
                course_name = document.course.name if document.course else "Course Study"
                document.ai_notes = NotesService._synthesize_local_notes(document, document.chunks, course_name)
                db.commit()
                db.refresh(document)
                logger.info(f"Auto-generated AI Study Notes for '{document.filename}'")
            except Exception as notes_err:
                logger.warning(f"AI Study Notes generation note: {notes_err}")

            return document

        except Exception as e:
            logger.exception(f"Pipeline failure for document {document.id} ({document.filename}): {e}")
            db.rollback()
            document.processing_status = "FAILED"
            document.processing_error = str(e)
            db.commit()
            db.refresh(document)
            return document
