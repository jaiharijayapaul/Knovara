"""Repository layer for Learner Concept Mastery (BKT) persistence."""

import json
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.mastery import LearnerConceptMastery


class MasteryRepository:
    """CRUD operations for LearnerConceptMastery records."""

    @staticmethod
    def get_or_create(
        db: Session,
        user_id: str,
        course_id: str,
        concept_label: str,
    ) -> LearnerConceptMastery:
        """
        Fetch existing mastery record or create a fresh one with BKT priors.
        Uses normalized concept_label (lowercased, stripped) for consistency.
        """
        normalized = concept_label.strip().lower()
        record = (
            db.query(LearnerConceptMastery)
            .filter_by(user_id=user_id, course_id=course_id, concept_label=normalized)
            .first()
        )
        if record is None:
            record = LearnerConceptMastery(
                user_id=user_id,
                course_id=course_id,
                concept_label=normalized,
            )
            db.add(record)
            db.flush()
        return record

    @staticmethod
    def get_all_for_course(
        db: Session,
        user_id: str,
        course_id: str,
    ) -> List[LearnerConceptMastery]:
        """Return all mastery records for a user within a course, sorted by priority descending."""
        return (
            db.query(LearnerConceptMastery)
            .filter_by(user_id=user_id, course_id=course_id)
            .order_by(LearnerConceptMastery.priority_score.desc())
            .all()
        )

    @staticmethod
    def get_by_concept(
        db: Session,
        user_id: str,
        course_id: str,
        concept_label: str,
    ) -> Optional[LearnerConceptMastery]:
        """Fetch a specific concept mastery record, returns None if not found."""
        normalized = concept_label.strip().lower()
        return (
            db.query(LearnerConceptMastery)
            .filter_by(user_id=user_id, course_id=course_id, concept_label=normalized)
            .first()
        )

    @staticmethod
    def update_bkt_state(
        db: Session,
        record: LearnerConceptMastery,
        new_p_know: float,
        is_correct: bool,
    ) -> LearnerConceptMastery:
        """
        Persist updated BKT state and evidence counters.
        Appends the new p_know value to the history sparkline JSON.
        """
        # Update evidence counters
        record.total_attempts += 1
        if is_correct:
            record.correct_attempts += 1

        # Update mastery probability
        record.p_know = round(new_p_know, 6)
        record.is_mastered = record.p_know >= record.mastery_threshold

        # Append to p_know history (cap at last 30 observations for UI sparkline)
        history: List[float] = json.loads(record.p_know_history_json) if record.p_know_history_json else []
        history.append(round(new_p_know, 4))
        if len(history) > 30:
            history = history[-30:]
        record.p_know_history_json = json.dumps(history)

        # Recompute priority: lower mastery = higher urgency (remediation priority)
        # Concepts with some attempts but low mastery score highest priority
        if record.total_attempts > 0 and not record.is_mastered:
            record.priority_score = (1.0 - record.p_know) * (1.0 + record.total_attempts * 0.1)
        elif record.total_attempts == 0:
            record.priority_score = 1.0
        else:
            record.priority_score = 0.0  # Mastered — de-prioritize

        db.flush()
        return record
