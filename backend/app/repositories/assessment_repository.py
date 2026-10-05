"""Repository for Assessments and Bloom's Taxonomy Questions."""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.assessment import Assessment, Question, AssessmentAttempt, QuestionResponseLog


class AssessmentRepository:
    """Database access operations for assessments and questions."""

    @staticmethod
    def create_assessment(
        db: Session,
        course_id: str,
        user_id: str,
        title: str,
        description: Optional[str] = None,
        topic: Optional[str] = None,
        difficulty: str = "medium",
        is_adaptive: bool = False,
        time_limit_minutes: Optional[int] = 15,
        total_points: float = 100.0,
        pass_percentage: float = 70.0,
        status: str = "published",
    ) -> Assessment:
        assessment = Assessment(
            course_id=course_id,
            user_id=user_id,
            title=title,
            description=description,
            topic=topic,
            difficulty=difficulty,
            is_adaptive=is_adaptive,
            time_limit_minutes=time_limit_minutes,
            total_points=total_points,
            pass_percentage=pass_percentage,
            status=status,
        )
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
        return assessment

    @staticmethod
    def add_question(
        db: Session,
        assessment_id: str,
        course_id: str,
        bloom_level: str,
        question_text: str,
        options_json: str,
        correct_answer_json: str,
        explanation: str,
        topic: Optional[str] = None,
        difficulty: str = "medium",
        question_type: str = "multiple_choice",
        points: float = 10.0,
        order_index: int = 0,
        citation_label: Optional[str] = None,
        document_name: Optional[str] = None,
        page_number: Optional[int] = None,
        slide_number: Optional[int] = None,
        timestamp_start: Optional[str] = None,
        timestamp_end: Optional[str] = None,
        source_snippet: Optional[str] = None,
    ) -> Question:
        question = Question(
            assessment_id=assessment_id,
            course_id=course_id,
            topic=topic,
            bloom_level=bloom_level,
            difficulty=difficulty,
            question_type=question_type,
            question_text=question_text,
            options_json=options_json,
            correct_answer_json=correct_answer_json,
            explanation=explanation,
            points=points,
            order_index=order_index,
            citation_label=citation_label,
            document_name=document_name,
            page_number=page_number,
            slide_number=slide_number,
            timestamp_start=timestamp_start,
            timestamp_end=timestamp_end,
            source_snippet=source_snippet,
        )
        db.add(question)
        db.commit()
        db.refresh(question)
        return question

    @staticmethod
    def get_assessment(
        db: Session,
        assessment_id: str,
        course_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[Assessment]:
        query = db.query(Assessment).filter(Assessment.id == assessment_id)
        if course_id:
            query = query.filter(Assessment.course_id == course_id)
        if user_id:
            query = query.filter(Assessment.user_id == user_id)
        return query.first()

    @staticmethod
    def list_assessments(
        db: Session, course_id: str, user_id: str
    ) -> List[Assessment]:
        return (
            db.query(Assessment)
            .filter(
                Assessment.course_id == course_id,
                Assessment.user_id == user_id,
            )
            .order_by(Assessment.created_at.desc())
            .all()
        )

    @staticmethod
    def delete_assessment(db: Session, assessment: Assessment) -> None:
        db.delete(assessment)
        db.commit()

    @staticmethod
    def get_question(db: Session, question_id: str) -> Optional[Question]:
        return db.query(Question).filter(Question.id == question_id).first()

    @staticmethod
    def create_attempt(
        db: Session,
        assessment_id: str,
        course_id: str,
        user_id: str,
        score: float,
        total_points: float,
        percentage: float,
        passed: bool,
        time_spent_seconds: int = 0,
        error_summary_json: Optional[str] = None,
        bloom_summary_json: Optional[str] = None,
    ) -> AssessmentAttempt:
        attempt = AssessmentAttempt(
            assessment_id=assessment_id,
            course_id=course_id,
            user_id=user_id,
            score=score,
            total_points=total_points,
            percentage=percentage,
            passed=passed,
            time_spent_seconds=time_spent_seconds,
            error_summary_json=error_summary_json,
            bloom_summary_json=bloom_summary_json,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt

    @staticmethod
    def add_response_log(
        db: Session,
        attempt_id: str,
        question_id: str,
        selected_answers_json: str,
        is_correct: bool,
        points_earned: float,
        points_possible: float,
        bloom_level: str,
        error_category: str = "none",
        misconception_diagnosis: Optional[str] = None,
        remediation_hint: Optional[str] = None,
    ) -> QuestionResponseLog:
        log_entry = QuestionResponseLog(
            attempt_id=attempt_id,
            question_id=question_id,
            selected_answers_json=selected_answers_json,
            is_correct=is_correct,
            points_earned=points_earned,
            points_possible=points_possible,
            bloom_level=bloom_level,
            error_category=error_category,
            misconception_diagnosis=misconception_diagnosis,
            remediation_hint=remediation_hint,
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry

    @staticmethod
    def get_attempt(
        db: Session,
        attempt_id: str,
        course_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[AssessmentAttempt]:
        query = db.query(AssessmentAttempt).filter(AssessmentAttempt.id == attempt_id)
        if course_id:
            query = query.filter(AssessmentAttempt.course_id == course_id)
        if user_id:
            query = query.filter(AssessmentAttempt.user_id == user_id)
        return query.first()

    @staticmethod
    def list_attempts(
        db: Session, assessment_id: str, user_id: str
    ) -> List[AssessmentAttempt]:
        return (
            db.query(AssessmentAttempt)
            .filter(
                AssessmentAttempt.assessment_id == assessment_id,
                AssessmentAttempt.user_id == user_id,
            )
            .order_by(AssessmentAttempt.created_at.desc())
            .all()
        )

