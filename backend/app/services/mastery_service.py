"""
Mastery Service — orchestrates BKT updates, concept mastery queries,
and adaptive recommendation generation.
"""

import json
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.bkt import (
    BKTEngine,
    BKTParams,
    DEFAULT_P_KNOW,
    DEFAULT_P_LEARN,
    DEFAULT_P_GUESS,
    DEFAULT_P_SLIP,
    MASTERY_THRESHOLD,
)
from app.models.assessment import AssessmentAttempt, QuestionResponseLog
from app.models.mastery import LearnerConceptMastery
from app.models.course import Course
from app.repositories.mastery_repository import MasteryRepository
from app.schemas.mastery import (
    ConceptMasteryResponse,
    CourseMasteryResponse,
    AdaptiveRecommendation,
    AdaptiveRecommendationsResponse,
)

logger = logging.getLogger(__name__)

# Bloom levels from low to high cognitive complexity
BLOOM_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"]

# Map: mastery status labels by p_know range
def _mastery_status(p_know: float, is_mastered: bool) -> str:
    if is_mastered:
        return "mastered"
    if p_know >= 0.65:
        return "developing"
    if p_know >= 0.35:
        return "needs_work"
    return "not_started"


def _serialize_record(record: LearnerConceptMastery) -> ConceptMasteryResponse:
    """Convert DB model to Pydantic schema."""
    history = json.loads(record.p_know_history_json) if record.p_know_history_json else []
    total = record.total_attempts
    correct = record.correct_attempts
    accuracy = (correct / total) if total > 0 else 0.0

    return ConceptMasteryResponse(
        id=record.id,
        user_id=record.user_id,
        course_id=record.course_id,
        concept_label=record.concept_label,
        p_know=record.p_know,
        p_learn=record.p_learn,
        p_guess=record.p_guess,
        p_slip=record.p_slip,
        mastery_threshold=record.mastery_threshold,
        total_attempts=total,
        correct_attempts=correct,
        is_mastered=record.is_mastered,
        priority_score=record.priority_score,
        p_know_history=history,
        mastery_percentage=round(record.p_know * 100, 1),
        accuracy_rate=round(accuracy, 4),
        mastery_status=_mastery_status(record.p_know, record.is_mastered),
        last_updated=record.last_updated,
        created_at=record.created_at,
    )


class MasteryService:
    """
    Phase 9 — Bayesian Knowledge Tracing & Learner Mastery Model.
    
    Responsibilities:
      1. After every scored attempt, extract concept evidence and run BKT updates.
      2. Expose per-course mastery summaries.
      3. Generate adaptive recommendations (sorted by priority, tailored Bloom scaffolding).
    """

    @classmethod
    def _verify_course_ownership(cls, db: Session, course_id: str, user_id: str) -> None:
        course = db.query(Course).filter_by(id=course_id, user_id=user_id).first()
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found or access denied.",
            )

    @classmethod
    def update_mastery_from_attempt(
        cls,
        db: Session,
        attempt: AssessmentAttempt,
        question_logs: List[QuestionResponseLog],
    ) -> None:
        """
        Called immediately after an assessment attempt is scored.
        Iterates over response logs and updates BKT state for each distinct concept.

        Concept labelling strategy:
          - If question.topic is set → use that as concept label
          - Otherwise → use f"{bloom_level}:{question_text[:50]}" as concept proxy
        """
        if not question_logs:
            return

        user_id = attempt.user_id
        course_id = attempt.course_id

        # Group observations by concept label
        from collections import defaultdict
        concept_observations: dict = defaultdict(list)

        for log in question_logs:
            q = log.question
            # Derive concept label
            if q and q.topic:
                concept = q.topic.strip()
            elif q and q.question_text:
                concept = f"{log.bloom_level}:{q.question_text[:60].strip()}"
            else:
                concept = f"concept:{log.bloom_level}"

            concept_observations[concept].append({
                "is_correct": log.is_correct,
                "bloom_level": log.bloom_level,
                "error_category": log.error_category,
            })

        # Apply BKT update per concept
        for concept_label, observations in concept_observations.items():
            try:
                record = MasteryRepository.get_or_create(
                    db=db,
                    user_id=user_id,
                    course_id=course_id,
                    concept_label=concept_label,
                )

                params = BKTParams(
                    p_know=record.p_know,
                    p_learn=record.p_learn,
                    p_guess=record.p_guess,
                    p_slip=record.p_slip,
                    mastery_threshold=record.mastery_threshold,
                )

                current_p_know = record.p_know
                for obs in observations:
                    result = BKTEngine.update(
                        p_know=current_p_know,
                        is_correct=obs["is_correct"],
                        params=params,
                    )
                    current_p_know = result.p_know_next

                # Persist the final updated mastery state for this concept
                # Use the last observation's correctness for evidence counter
                last_correct = observations[-1]["is_correct"]
                MasteryRepository.update_bkt_state(
                    db=db,
                    record=record,
                    new_p_know=current_p_know,
                    is_correct=last_correct,
                )

            except Exception as exc:
                logger.warning(f"BKT update failed for concept '{concept_label}': {exc}")
                # Non-fatal: continue with other concepts

        db.commit()
        logger.info(
            f"BKT updated for user={user_id}, course={course_id}: "
            f"{len(concept_observations)} concepts updated."
        )

    @classmethod
    def get_course_mastery(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
    ) -> CourseMasteryResponse:
        """Return full mastery model for a course — all concepts with BKT state."""
        cls._verify_course_ownership(db, course_id, user_id)

        records = MasteryRepository.get_all_for_course(
            db=db, user_id=user_id, course_id=course_id
        )

        concepts = [_serialize_record(r) for r in records]
        existing_labels = {c.concept_label.lower().strip() for c in concepts}

        # Seamlessly include course topics that have not yet had assessment attempts
        course = db.query(Course).filter_by(id=course_id, user_id=user_id).first()
        if course and course.topics:
            for t in course.topics:
                norm = t.name.strip().lower()
                if norm not in existing_labels:
                    concepts.append(
                        ConceptMasteryResponse(
                            id=f"topic-{t.id}",
                            user_id=user_id,
                            course_id=course_id,
                            concept_label=t.name.strip(),
                            p_know=DEFAULT_P_KNOW,
                            p_learn=DEFAULT_P_LEARN,
                            p_guess=DEFAULT_P_GUESS,
                            p_slip=DEFAULT_P_SLIP,
                            mastery_threshold=MASTERY_THRESHOLD,
                            total_attempts=0,
                            correct_attempts=0,
                            is_mastered=False,
                            priority_score=0.30,
                            p_know_history=[DEFAULT_P_KNOW],
                            mastery_percentage=round(DEFAULT_P_KNOW * 100, 1),
                            accuracy_rate=0.0,
                            mastery_status="not_started",
                            last_updated=t.created_at,
                            created_at=t.created_at,
                        )
                    )
                    existing_labels.add(norm)

        total = len(concepts)
        mastered = sum(1 for c in concepts if c.is_mastered)

        if total > 0:
            avg_p_know = sum(c.p_know for c in concepts) / total
            overall_pct = round(avg_p_know * 100, 1)
        else:
            overall_pct = 0.0

        return CourseMasteryResponse(
            course_id=course_id,
            total_concepts=total,
            mastered_concepts=mastered,
            overall_mastery_percentage=overall_pct,
            concepts=concepts,
        )

    @classmethod
    def get_concept_mastery(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        concept_label: str,
    ) -> ConceptMasteryResponse:
        """Return BKT state for a single concept."""
        cls._verify_course_ownership(db, course_id, user_id)

        record = MasteryRepository.get_by_concept(
            db=db, user_id=user_id, course_id=course_id, concept_label=concept_label
        )
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No mastery record found for concept '{concept_label}'.",
            )
        return _serialize_record(record)

    @classmethod
    def get_adaptive_recommendations(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        top_n: int = 5,
    ) -> AdaptiveRecommendationsResponse:
        """
        Generate ranked adaptive recommendations for the student's next study session.

        Sorting:
          1. Not mastered, highest priority_score (needs most work, most attempted)
          2. Developing concepts get mid-tier Bloom scaffolding
          3. Mastered concepts excluded unless all concepts are mastered
        """
        cls._verify_course_ownership(db, course_id, user_id)

        records = MasteryRepository.get_all_for_course(
            db=db, user_id=user_id, course_id=course_id
        )

        total = len(records)
        mastered_count = sum(1 for r in records if r.is_mastered)
        avg_p_know = (sum(r.p_know for r in records) / total) if total > 0 else 0.0
        overall_pct = round(avg_p_know * 100, 1)

        recommendations: List[AdaptiveRecommendation] = []

        # Sort: unmastered first by priority, then mastered last
        sorted_records = sorted(
            records,
            key=lambda r: (-r.priority_score if not r.is_mastered else 0.0),
            reverse=False,
        )
        # Reverse to get highest priority first
        sorted_records.sort(key=lambda r: r.priority_score if not r.is_mastered else -1.0, reverse=True)

        for record in sorted_records[:top_n]:
            params = BKTParams(
                p_know=record.p_know,
                p_learn=record.p_learn,
                p_guess=record.p_guess,
                p_slip=record.p_slip,
                mastery_threshold=record.mastery_threshold,
            )

            est_questions = BKTEngine.questions_to_mastery(record.p_know, params)
            ms = _mastery_status(record.p_know, record.is_mastered)

            # Tailor Bloom levels based on current mastery
            if record.p_know < 0.35:
                bloom_recs = ["remember", "understand"]
                reason = "Foundation building: Student has not yet established core factual recall on this concept."
            elif record.p_know < 0.65:
                bloom_recs = ["understand", "apply", "analyze"]
                reason = "Procedural development: Student understands basics but needs practice applying the concept."
            elif not record.is_mastered:
                bloom_recs = ["analyze", "evaluate", "create"]
                reason = "Mastery consolidation: Student is close to mastery — challenge with higher-order synthesis."
            else:
                bloom_recs = ["create", "evaluate"]
                reason = "Mastery maintenance: Concept is mastered — maintain with advanced synthesis challenges."

            recommendations.append(
                AdaptiveRecommendation(
                    concept_label=record.concept_label,
                    p_know=round(record.p_know, 4),
                    mastery_status=ms,
                    priority_score=round(record.priority_score, 4),
                    reason=reason,
                    recommended_bloom_levels=bloom_recs,
                    estimated_questions_to_mastery=est_questions if est_questions >= 0 else 0,
                )
            )

        return AdaptiveRecommendationsResponse(
            course_id=course_id,
            overall_mastery_percentage=overall_pct,
            recommendations=recommendations,
            mastered_count=mastered_count,
            total_count=total,
        )

    @classmethod
    def update_mastery_from_conversation(
        cls,
        db: Session,
        user_id: str,
        course_id: str,
        topic: Optional[str],
        user_message: str,
        tutor_response: str,
    ) -> None:
        """
        Updates Bayesian Knowledge Tracing (BKT) learner mastery from an active
        conversational tutoring dialogue turn.
        
        Evaluates conversational signal:
          - Evidence of understanding / confirmation / correct answering -> is_correct=True
          - Evidence of confusion / help-seeking / struggle -> is_correct=False, with learning transit P(T) applied
          - Concept resolution: uses session.topic or extracts relevant concept keyword
        """
        concept_label = (topic or "").strip()
        if not concept_label:
            concept_label = "General Fundamentals"

        msg_lower = user_message.lower().strip()
        
        confusion_signals = [
            "don't understand", "dont understand", "confused", "what does that mean",
            "why is that", "help me", "not sure", "lost", "explain again", "hard to follow",
            "why does", "i don't get it", "i dont get"
        ]
        is_confusion = any(sig in msg_lower for sig in confusion_signals)
        
        is_correct = not is_confusion if is_confusion else True

        try:
            record = MasteryRepository.get_or_create(
                db=db,
                user_id=user_id,
                course_id=course_id,
                concept_label=concept_label,
            )

            params = BKTParams(
                p_know=record.p_know,
                p_learn=record.p_learn,
                p_guess=record.p_guess,
                p_slip=record.p_slip,
                mastery_threshold=record.mastery_threshold,
            )

            result = BKTEngine.update(
                p_know=record.p_know,
                is_correct=is_correct,
                params=params,
            )

            MasteryRepository.update_bkt_state(
                db=db,
                record=record,
                new_p_know=result.p_know_next,
                is_correct=is_correct,
            )
            db.commit()
            logger.info(
                f"Conversational BKT update: user={user_id}, concept='{concept_label}', "
                f"prior={round(result.p_know_prior, 3)} -> next={round(result.p_know_next, 3)}"
            )
        except Exception as exc:
            logger.warning(f"Conversational BKT update failed for '{concept_label}': {exc}")
