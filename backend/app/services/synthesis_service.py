"""
Study Workspace Synthesis Service.
Automatically extracts curriculum topics, initializes BKT mastery models,
synthesizes grounded flashcards, and generates diagnostic assessments
strictly from live uploaded course documents.
"""

import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.course import Course, Topic
from app.repositories.course_repository import CourseRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.mastery_repository import MasteryRepository
from app.processing.topic_extractor import TopicExtractor
from app.services.flashcard_service import FlashcardService
from app.services.assessment_service import AssessmentService
from app.schemas.flashcard import FlashcardGenerateRequest
from app.schemas.assessment import AssessmentGenerateRequest

logger = logging.getLogger("knovara.synthesis_service")


class SynthesisService:
    """Orchestrates comprehensive study workspace generation from live uploaded materials."""

    @classmethod
    async def synthesize_workspace(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Synthesize a complete learning environment from the student's uploaded documents.
        """
        # 1. Verify Course Ownership
        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found or you do not have permission.",
            )

        # 2. Check for uploaded materials
        docs = DocumentRepository.list_by_course(db, course_id)
        if not docs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No documents found in this course workspace. Please upload your textbook (PDF), slides (PPTX), or transcripts first.",
            )

        all_chunks = []
        for d in docs:
            all_chunks.extend(d.chunks)

        if not all_chunks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded documents have not produced any processed chunks yet. Please wait for processing to complete.",
            )

        # 3. Curriculum Topic Extraction
        existing_topic_names = {t.name.strip().lower() for t in course.topics}
        extracted_topics: List[Dict[str, str]] = []

        if len(course.topics) < 2:
            chunk_texts = [c.content for c in all_chunks[:12]]
            extracted_topics = await TopicExtractor.extract_topics(
                text_samples=chunk_texts,
                course_name=course.name,
                subject=course.subject,
            )

            for t_dict in extracted_topics:
                t_name = t_dict["name"].strip()
                if t_name.lower() not in existing_topic_names:
                    new_topic = Topic(
                        course_id=course.id,
                        name=t_name,
                        description=t_dict.get("description"),
                    )
                    db.add(new_topic)
                    existing_topic_names.add(t_name.lower())

            db.commit()
            db.refresh(course)
            logger.info(f"Extracted {len(extracted_topics)} topics for course '{course.name}'")

        # 4. Align chunks to topics
        current_topics = [t.name for t in course.topics]
        tagged_count = 0
        for chunk in all_chunks:
            if not chunk.topic or chunk.topic.strip().lower() in ["general", "none", ""]:
                content_lower = chunk.content.lower()
                for t_name in current_topics:
                    if t_name.lower() in content_lower:
                        chunk.topic = t_name
                        tagged_count += 1
                        break
        db.commit()

        # 5. Initialize Calibrated Bayesian Knowledge Tracing Mastery
        for t_name in current_topics:
            MasteryRepository.get_or_create(
                db=db,
                user_id=user_id,
                course_id=course_id,
                concept_label=t_name,
            )
        db.commit()

        # 6. Generate Grounded Flashcards from Live Chunks
        generated_cards = []
        try:
            generated_cards = await FlashcardService.generate_cards(
                db=db,
                course_id=course_id,
                user_id=user_id,
                payload=FlashcardGenerateRequest(
                    num_cards=min(8, max(4, len(all_chunks))),
                    deck_title=f"Core Concepts — {course.name}",
                ),
            )
            logger.info(f"Synthesized {len(generated_cards)} grounded flashcards for course '{course.name}'")
        except Exception as e:
            logger.warning(f"Flashcard synthesis note: {e}")

        # 7. Generate Grounded Baseline Assessment from Live Chunks
        assessment_id = None
        try:
            assessment_detail = await AssessmentService.generate_assessment(
                db=db,
                course_id=course_id,
                user_id=user_id,
                payload=AssessmentGenerateRequest(
                    title=f"Diagnostic Mastery: {course.name}",
                    num_questions=min(6, max(3, len(all_chunks))),
                    difficulty="medium",
                ),
            )
            assessment_id = assessment_detail.id
            logger.info(f"Synthesized baseline diagnostic assessment {assessment_id} for course '{course.name}'")
        except Exception as e:
            logger.warning(f"Assessment synthesis note: {e}")

        # 8. Generate AI Study Notes for documents and course workspace
        notes_generated = False
        try:
            from app.services.notes_service import NotesService
            for doc in docs:
                if not doc.ai_notes:
                    await NotesService.generate_notes_for_document(db, doc, course.name)
            await NotesService.generate_course_study_notes(db, course_id, user_id)
            notes_generated = True
            logger.info(f"Synthesized comprehensive AI study notes for course '{course.name}'")
        except Exception as e:
            logger.warning(f"AI Study Notes synthesis note: {e}")

        return {
            "message": f"Successfully synthesized study workspace from {len(docs)} uploaded materials.",
            "course_id": course_id,
            "documents_count": len(docs),
            "chunks_count": len(all_chunks),
            "topics": [t.name for t in course.topics],
            "topics_count": len(course.topics),
            "flashcards_count": len(generated_cards),
            "assessment_id": assessment_id,
            "study_notes_ready": notes_generated,
        }
