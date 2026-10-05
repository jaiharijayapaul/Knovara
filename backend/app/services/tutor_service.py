"""AI Tutor service coordinating sessions, multi-turn dialogue, and pedagogical modes."""

import json
import logging
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.course_repository import CourseRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.tutor_repository import TutorRepository
from app.tutor.pedagogical_engine import PedagogicalEngine, PEDAGOGICAL_PROMPTS
from app.rag.retriever import HybridRetriever
from app.schemas.rag import SourceCitation
from app.schemas.tutor import (
    VALID_PEDAGOGICAL_MODES,
    TutorSessionCreate,
    RemediationSessionCreate,
    TutorSessionUpdateMode,
    TutorMessageCreate,
    TutorMessageResponse,
    TutorSessionResponse,
    TutorSessionDetailResponse,
)

logger = logging.getLogger(__name__)


class TutorService:
    """Orchestrates interactive Socratic AI tutoring sessions, message handling, and mode switching."""

    @staticmethod
    def _verify_course_ownership(db: Session, course_id: str, user_id: str):
        """Ensure course workspace belongs to the authenticated user."""
        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found or permission denied.",
            )
        return course

    @classmethod
    def _deserialize_message(cls, msg) -> TutorMessageResponse:
        """Parse raw TutorMessage into schema with deserialized citations."""
        citations = []
        if msg.citations_json:
            try:
                raw_cites = json.loads(msg.citations_json)
                citations = [SourceCitation.model_validate(c) for c in raw_cites]
            except Exception:
                citations = []

        return TutorMessageResponse(
            id=msg.id,
            session_id=msg.session_id,
            sender=msg.sender,
            content=msg.content,
            pedagogical_mode=msg.pedagogical_mode,
            citations=citations,
            created_at=msg.created_at,
        )

    @classmethod
    def create_session(
        cls, db: Session, course_id: str, user_id: str, payload: TutorSessionCreate
    ) -> TutorSessionDetailResponse:
        """Initialize a new tutoring session with default introductory greeting."""
        course = cls._verify_course_ownership(db, course_id, user_id)

        mode = (payload.pedagogical_mode or "socratic").lower()
        if mode not in VALID_PEDAGOGICAL_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid pedagogical mode '{mode}'. Allowed modes: {', '.join(VALID_PEDAGOGICAL_MODES)}",
            )

        title = payload.title or f"{mode.replace('_', ' ').title()} Session on {course.name}"

        session = TutorRepository.create_session(
            db=db,
            course_id=course_id,
            user_id=user_id,
            title=title,
            pedagogical_mode=mode,
            topic=payload.topic,
        )

        # Introductory welcome turn
        mode_descriptions = {
            "socratic": "I'll guide you step-by-step using probing questions so you discover principles yourself.",
            "analogy": "I'll translate abstract algorithms into intuitive real-world analogies.",
            "first_principles": "We'll build up concepts from fundamental axioms and mathematical definitions.",
            "misconception_buster": "We'll actively target common student traps and contrast them with true formulas.",
            "exam_prep": "We'll focus on high-yield formulas, typical exam questions, and rapid memory checks.",
            "deep_dive": "We'll explore rigorous mathematical equations, complexities, and algorithmic proofs.",
            "quick_review": "We'll keep things brief with rapid 3-to-5 bullet point essential summaries.",
        }

        intro_text = (
            f"Hello! I'm your AI Study Companion for **{course.name}**.\n\n"
            f"🎯 **Active Mode**: `{mode.upper()}` — {mode_descriptions.get(mode, '')}\n\n"
            f"All our discussions are strictly grounded in your course slides, textbooks, and lecture transcripts with exact source citations. "
            f"What concept or question would you like to explore today?"
        )

        intro_msg = TutorRepository.add_message(
            db=db,
            session_id=session.id,
            sender="assistant",
            content=intro_text,
            pedagogical_mode=mode,
            citations_json=None,
        )

        return TutorSessionDetailResponse(
            id=session.id,
            course_id=session.course_id,
            user_id=session.user_id,
            title=session.title,
            pedagogical_mode=session.pedagogical_mode,
            topic=session.topic,
            messages_count=1,
            created_at=session.created_at,
            updated_at=session.updated_at,
            messages=[cls._deserialize_message(intro_msg)],
        )

    @classmethod
    def create_remediation_session(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        payload: RemediationSessionCreate,
    ) -> TutorSessionDetailResponse:
        """
        Create a targeted AI Tutor remediation session deep-linked to an assessment error
        or a weak concept identified by Bayesian Knowledge Tracing (BKT).
        """
        course = cls._verify_course_ownership(db, course_id, user_id)

        mode = (payload.pedagogical_mode or "misconception_buster").lower()
        if mode not in VALID_PEDAGOGICAL_MODES:
            mode = "misconception_buster"

        citations: List[SourceCitation] = []
        topic_focus: str | None = None
        session_title: str
        intro_content: str

        if payload.source_type == "assessment_mistake":
            question_text = payload.question_text
            student_ans = payload.student_answer
            error_cat = payload.error_category or "misconception"
            explanation = payload.misconception_explanation
            topic = None

            # Look up Attempt Log if IDs provided
            if payload.attempt_id and payload.question_id:
                from app.models.assessment import QuestionResponseLog
                log = (
                    db.query(QuestionResponseLog)
                    .filter_by(attempt_id=payload.attempt_id, question_id=payload.question_id)
                    .first()
                )
                if log:
                    q = log.question
                    if q:
                        question_text = q.question_text
                        topic = q.topic
                        topic_focus = q.topic
                        if not explanation:
                            explanation = q.explanation
                        # Extract chosen answer text
                        if log.selected_answers_json and not student_ans:
                            try:
                                sel_ids = json.loads(log.selected_answers_json)
                                opts = json.loads(q.options_json) if q.options_json else []
                                chosen_texts = [o.get("text", "") for o in opts if o.get("id") in sel_ids]
                                student_ans = ", ".join(chosen_texts) if chosen_texts else str(sel_ids)
                            except Exception:
                                pass
                    if log.error_category and log.error_category != "none":
                        error_cat = log.error_category
                    if log.misconception_diagnosis:
                        explanation = log.misconception_diagnosis
                    if q and q.citation_label:
                        citations.append(
                            SourceCitation(
                                chunk_id=f"q-{q.id}",
                                document_id=q.course_id,
                                document_name=q.document_name or "Course Document",
                                file_type="pdf",
                                page_number=q.page_number,
                                slide_number=q.slide_number,
                                timestamp_start=q.timestamp_start,
                                timestamp_end=q.timestamp_end,
                                snippet=q.source_snippet or q.explanation or "",
                                score=1.0,
                                semantic_score=1.0,
                                keyword_score=1.0,
                                citation_label=q.citation_label or f"[{q.document_name or 'Course'}]",
                            )
                        )

            topic_display = topic or payload.concept_label or "Core Concept"
            formatted_error = error_cat.replace("_", " ").title()
            session_title = f"Remediation: {topic_display} ({formatted_error})"
            topic_focus = topic_display

            intro_content = (
                f"Hello! I'm your AI Socratic Tutor for **{course.name}**.\n\n"
                f"I noticed you encountered a challenging problem on **{topic_display}**.\n\n"
                f"> **Question:** {question_text or 'Selected problem'}\n\n"
            )
            if student_ans:
                intro_content += f"- **Your Selected Answer:** `{student_ans}`\n"
            if error_cat and error_cat != "none":
                intro_content += f"- **Diagnostic Trap Category:** `{formatted_error}`\n"
            if explanation:
                intro_content += f"- **Diagnostic Insight:** {explanation}\n\n"

            intro_content += (
                "🎯 **Our Objective:** Let's trace through the underlying principles together "
                "so this trap never catches you again.\n\n"
                "To start: **In your own words, what was your initial intuition or line of reasoning "
                "when you tackled this question?**"
            )

        elif payload.source_type == "bkt_concept":
            concept = payload.concept_label or "General Concept"
            topic_focus = concept
            session_title = f"Mastery Remediation: {concept}"

            # Fetch BKT state
            from app.repositories.mastery_repository import MasteryRepository
            mastery_record = MasteryRepository.get_by_concept(
                db, user_id=user_id, course_id=course_id, concept_label=concept
            )
            p_know = mastery_record.p_know if mastery_record else 0.35
            pct = round(p_know * 100, 1)

            # Retrieve grounding materials for the concept
            docs = DocumentRepository.list_by_course(db, course_id)
            if docs:
                try:
                    retriever = HybridRetriever(db, course_id)
                    rag_cites = retriever.retrieve(concept, top_k=2)
                    citations.extend(rag_cites)
                except Exception as e:
                    logger.warning(f"RAG citation retrieval for remediation concept failed: {e}")

            intro_content = (
                f"Hello! I'm your AI Tutor for **{course.name}**.\n\n"
                f"According to your Bayesian Knowledge Tracing (BKT) learner model, "
                f"your current estimated mastery probability in **{concept}** is **{pct}%**.\n\n"
                f"🎯 **Targeted Scaffolding:** We'll start from first principles and scaffold "
                f"step-by-step through procedural application until this concept is fully mastered.\n\n"
                f"To begin: **How would you define or explain '{concept}' in your own words?**"
            )
        else:
            session_title = f"Remediation on {course.name}"
            intro_content = (
                "Hello! Let's do some targeted practice. "
                "Which concept or recent assessment question would you like to review first?"
            )

        # Create session in DB
        session = TutorRepository.create_session(
            db=db,
            course_id=course_id,
            user_id=user_id,
            title=session_title,
            pedagogical_mode=mode,
            topic=topic_focus,
        )

        # Record introductory message turn
        cites_json = json.dumps([c.model_dump() for c in citations]) if citations else None
        TutorRepository.add_message(
            db=db,
            session_id=session.id,
            sender="assistant",
            content=intro_content,
            pedagogical_mode=mode,
            citations_json=cites_json,
        )

        return cls.get_session_detail(
            db=db, course_id=course_id, session_id=session.id, user_id=user_id
        )


    @classmethod
    def list_sessions(
        cls, db: Session, course_id: str, user_id: str
    ) -> List[TutorSessionResponse]:
        """List student's tutoring sessions for the course."""
        cls._verify_course_ownership(db, course_id, user_id)
        sessions = TutorRepository.list_sessions(db=db, course_id=course_id, user_id=user_id)
        return [
            TutorSessionResponse(
                id=s.id,
                course_id=s.course_id,
                user_id=s.user_id,
                title=s.title,
                pedagogical_mode=s.pedagogical_mode,
                topic=s.topic,
                messages_count=len(s.messages),
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
            for s in sessions
        ]

    @classmethod
    def get_session_detail(
        cls, db: Session, course_id: str, session_id: str, user_id: str
    ) -> TutorSessionDetailResponse:
        """Retrieve complete session history with citations."""
        cls._verify_course_ownership(db, course_id, user_id)
        session = TutorRepository.get_session(db, session_id, course_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tutoring session not found.",
            )

        messages = [cls._deserialize_message(m) for m in session.messages]
        return TutorSessionDetailResponse(
            id=session.id,
            course_id=session.course_id,
            user_id=session.user_id,
            title=session.title,
            pedagogical_mode=session.pedagogical_mode,
            topic=session.topic,
            messages_count=len(messages),
            created_at=session.created_at,
            updated_at=session.updated_at,
            messages=messages,
        )

    @classmethod
    async def send_message(
        cls,
        db: Session,
        course_id: str,
        session_id: str,
        user_id: str,
        payload: TutorMessageCreate,
    ) -> TutorMessageResponse:
        """
        Process student turn, retrieve grounded knowledge citations,
        and generate tutor turn in the active pedagogical mode.
        """
        course = cls._verify_course_ownership(db, course_id, user_id)
        session = TutorRepository.get_session(db, session_id, course_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tutoring session not found.",
            )

        # 1. Record student turn
        user_msg = TutorRepository.add_message(
            db=db,
            session_id=session.id,
            sender="user",
            content=payload.content.strip(),
            pedagogical_mode=session.pedagogical_mode,
            citations_json=None,
        )

        # 2. Retrieve grounded course citations
        docs = DocumentRepository.list_by_course(db, course_id)
        all_chunks = []
        for d in docs:
            all_chunks.extend(d.chunks)

        citations = []
        if all_chunks:
            citations = HybridRetriever.retrieve(
                query=payload.content.strip(),
                chunks=all_chunks,
                topic_filter=session.topic,
                top_k=3,
            )

        # 3. Build dialogue history
        history = [
            {"sender": m.sender, "content": m.content}
            for m in session.messages[-8:]
        ]

        # 4. Generate next pedagogical response
        reply_text, citations_used = await PedagogicalEngine.generate_turn(
            user_message=payload.content.strip(),
            pedagogical_mode=session.pedagogical_mode,
            citations=citations,
            history=history,
            course_name=course.name,
            topic=session.topic,
        )

        # 5. Persist assistant turn with serialized citations
        citations_json = json.dumps([c.model_dump() for c in citations_used]) if citations_used else None
        assistant_msg = TutorRepository.add_message(
            db=db,
            session_id=session.id,
            sender="assistant",
            content=reply_text,
            pedagogical_mode=session.pedagogical_mode,
            citations_json=citations_json,
        )

        return cls._deserialize_message(assistant_msg)

    @classmethod
    def update_mode(
        cls,
        db: Session,
        course_id: str,
        session_id: str,
        user_id: str,
        payload: TutorSessionUpdateMode,
    ) -> TutorSessionResponse:
        """Switch pedagogical mode dynamically mid-conversation."""
        cls._verify_course_ownership(db, course_id, user_id)
        session = TutorRepository.get_session(db, session_id, course_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tutoring session not found.",
            )

        new_mode = payload.pedagogical_mode.lower()
        if new_mode not in VALID_PEDAGOGICAL_MODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid pedagogical mode '{new_mode}'. Allowed modes: {', '.join(VALID_PEDAGOGICAL_MODES)}",
            )

        updated_session = TutorRepository.update_mode(db, session, new_mode)

        # Append system mode transition notice in chat stream
        TutorRepository.add_message(
            db=db,
            session_id=session.id,
            sender="assistant",
            content=f"🔄 *Pedagogical mode updated to **{new_mode.upper()}**.* Subsequent responses will adapt to this teaching style.",
            pedagogical_mode=new_mode,
            citations_json=None,
        )

        return TutorSessionResponse(
            id=updated_session.id,
            course_id=updated_session.course_id,
            user_id=updated_session.user_id,
            title=updated_session.title,
            pedagogical_mode=updated_session.pedagogical_mode,
            topic=updated_session.topic,
            messages_count=len(updated_session.messages),
            created_at=updated_session.created_at,
            updated_at=updated_session.updated_at,
        )

    @classmethod
    def delete_session(
        cls, db: Session, course_id: str, session_id: str, user_id: str
    ) -> None:
        """Delete chat session and message history."""
        cls._verify_course_ownership(db, course_id, user_id)
        session = TutorRepository.get_session(db, session_id, course_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tutoring session not found.",
            )
        TutorRepository.delete_session(db, session)
