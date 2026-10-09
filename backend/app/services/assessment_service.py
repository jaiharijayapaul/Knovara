"""Assessment Service managing AI-driven question generation and lifecycle."""

import json
import logging
from typing import List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.assessment import Assessment, Question, AssessmentAttempt, QuestionResponseLog
from app.repositories.course_repository import CourseRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.assessment_repository import AssessmentRepository
from app.assessment.generator import AssessmentGenerator
from app.assessment.error_taxonomy import ErrorTaxonomyClassifier
from app.services.mastery_service import MasteryService
from app.schemas.assessment import (
    AssessmentCreate,
    AssessmentGenerateRequest,
    AssessmentResponse,
    AssessmentDetailResponse,
    AssessmentStudentDetailResponse,
    AssessmentSubmitRequest,
    QuestionResponse,
    QuestionStudentView,
    QuestionOption,
    QuestionOptionStudent,
    QuestionResultResponse,
    AssessmentAttemptResponse,
    AssessmentAttemptDetailResponse,
)

logger = logging.getLogger("knovara.assessment_service")


class AssessmentService:
    """Orchestrates grounded question generation, psychometric Bloom alignment, and assessment persistence."""

    @classmethod
    def _verify_course_ownership(cls, db: Session, course_id: str, user_id: str) -> Course:
        course = CourseRepository.get_by_id(db, course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found.",
            )
        if course.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this course workspace.",
            )
        return course

    @classmethod
    async def generate_assessment(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        payload: AssessmentGenerateRequest,
    ) -> AssessmentDetailResponse:
        """
        Generate grounded assessment questions spanning Bloom's cognitive levels
        from course multimodal documents.
        """
        course = cls._verify_course_ownership(db, course_id, user_id)

        # Retrieve all ingested chunks for course
        docs = DocumentRepository.list_by_course(db, course_id)
        all_chunks = []
        for d in docs:
            all_chunks.extend(d.chunks)

        if not all_chunks:
            # Check if demo documents need to be seeded or inform student
            logger.warning(f"No document chunks found for course {course_id} during assessment generation.")

        # Check if adaptive mode is requested
        blueprint = None
        is_adaptive = getattr(payload, "adaptive_mode", False)
        if is_adaptive:
            # Query the student's Bayesian Knowledge Tracing mastery model
            try:
                from app.services.mastery_service import MasteryService
                mastery_recs = MasteryService.get_adaptive_recommendations(
                    db=db,
                    course_id=course_id,
                    user_id=user_id,
                    top_n=payload.num_questions,
                )
                if mastery_recs.recommendations:
                    blueprint = []
                    recs_list = mastery_recs.recommendations
                    for i in range(payload.num_questions):
                        rec = recs_list[i % len(recs_list)]
                        # Scaffold cognitive level according to BKT recommendation
                        bloom_options = rec.recommended_bloom_levels or ["understand"]
                        assigned_bloom = bloom_options[(i // len(recs_list)) % len(bloom_options)]
                        blueprint.append({
                            "topic": rec.concept_label,
                            "bloom_level": assigned_bloom,
                            "difficulty": payload.difficulty if payload.difficulty != "medium" else "adaptive",
                            "p_know": rec.p_know,
                            "reason": rec.reason,
                        })
                    logger.info(
                        f"Constructed BKT adaptive blueprint with {len(blueprint)} questions "
                        f"across concepts: {[b['topic'] for b in blueprint]}"
                    )
            except Exception as e:
                logger.warning(f"Failed to fetch adaptive mastery recommendations, falling back: {e}")

        if is_adaptive and blueprint:
            title = payload.title or f"Adaptive Mastery Assessment: {payload.topic or course.name}"
            unique_concepts = list(dict.fromkeys(b["topic"] for b in blueprint))
            desc = (
                f"Personalized assessment gated by Bayesian Knowledge Tracing testing {len(blueprint)} questions "
                f"tailored to priority concepts: {', '.join(unique_concepts[:3])}. Strictly grounded in course materials."
            )
        else:
            title = payload.title or f"{payload.topic or course.name} Cognitive Mastery Check"
            desc = (
                f"Psychometric assessment testing {payload.num_questions} questions across Bloom's Taxonomy "
                f"({payload.difficulty.capitalize()} level). Strictly grounded in verified course materials."
            )

        # Collect previously asked questions to ensure novelty & avoid repetition (Req 3b)
        previous_q_records = (
            db.query(Question.question_text)
            .join(Assessment, Question.assessment_id == Assessment.id)
            .filter(Assessment.course_id == course_id)
            .limit(30)
            .all()
        )
        previous_stems = [q[0] for q in previous_q_records if q[0]]

        # Run psychometric question generator
        generated_q_data = await AssessmentGenerator.generate_questions(
            chunks=all_chunks,
            num_questions=payload.num_questions,
            target_bloom_levels=payload.bloom_levels,
            difficulty="adaptive" if is_adaptive else payload.difficulty,
            question_types=payload.question_types,
            topic=payload.topic,
            course_name=course.name,
            adaptive_blueprint=blueprint,
            previous_stems=previous_stems,
        )

        total_pts = sum(float(q.get("points", 10.0)) for q in generated_q_data)

        # 1. Create Assessment record
        assessment = AssessmentRepository.create_assessment(
            db=db,
            course_id=course_id,
            user_id=user_id,
            title=title,
            description=desc,
            topic=payload.topic,
            difficulty="adaptive" if is_adaptive else payload.difficulty,
            is_adaptive=is_adaptive,
            time_limit_minutes=max(10, payload.num_questions * 3),
            total_points=total_pts,
            pass_percentage=70.0,
            status="published",
        )

        # 2. Persist Questions with citations and distractors
        created_questions = []
        for idx, q_dict in enumerate(generated_q_data):
            options_json_str = json.dumps(q_dict["options"])
            correct_json_str = json.dumps(q_dict["correct_answers"])

            q_obj = AssessmentRepository.add_question(
                db=db,
                assessment_id=assessment.id,
                course_id=course_id,
                topic=q_dict.get("topic", payload.topic),
                bloom_level=q_dict.get("bloom_level", "understand"),
                difficulty=q_dict.get("difficulty", payload.difficulty),
                question_type=q_dict.get("question_type", "multiple_choice"),
                question_text=q_dict["question_text"],
                options_json=options_json_str,
                correct_answer_json=correct_json_str,
                explanation=q_dict["explanation"],
                points=float(q_dict.get("points", 10.0)),
                order_index=idx,
                citation_label=q_dict.get("citation_label"),
                document_name=q_dict.get("document_name"),
                page_number=q_dict.get("page_number"),
                slide_number=q_dict.get("slide_number"),
                timestamp_start=q_dict.get("timestamp_start"),
                timestamp_end=q_dict.get("timestamp_end"),
                source_snippet=q_dict.get("source_snippet"),
            )
            created_questions.append(q_obj)

        return cls._to_detail_response(assessment, created_questions)

    @classmethod
    def list_assessments(
        cls, db: Session, course_id: str, user_id: str
    ) -> List[AssessmentResponse]:
        """List all assessments created for this course."""
        cls._verify_course_ownership(db, course_id, user_id)
        assessments = AssessmentRepository.list_assessments(db, course_id, user_id)
        return [
            AssessmentResponse(
                id=a.id,
                course_id=a.course_id,
                user_id=a.user_id,
                title=a.title,
                description=a.description,
                topic=a.topic,
                difficulty=a.difficulty,
                is_adaptive=getattr(a, "is_adaptive", False) or False,
                time_limit_minutes=a.time_limit_minutes,
                total_points=a.total_points,
                pass_percentage=a.pass_percentage,
                status=a.status,
                questions_count=len(a.questions),
                created_at=a.created_at,
                updated_at=a.updated_at,
            )
            for a in assessments
        ]

    @classmethod
    def get_assessment(
        cls,
        db: Session,
        course_id: str,
        assessment_id: str,
        user_id: str,
        student_mode: bool = False,
    ):
        """Retrieve assessment details. Supports redacted student view or instructor view."""
        cls._verify_course_ownership(db, course_id, user_id)
        assessment = AssessmentRepository.get_assessment(db, assessment_id, course_id, user_id)
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found.",
            )

        if student_mode:
            student_questions = []
            for q in assessment.questions:
                raw_options = json.loads(q.options_json) if q.options_json else []
                sanitized_options = [
                    QuestionOptionStudent(id=opt["id"], text=opt["text"])
                    for opt in raw_options
                ]
                student_questions.append(
                    QuestionStudentView(
                        id=q.id,
                        assessment_id=q.assessment_id,
                        topic=q.topic,
                        bloom_level=q.bloom_level,
                        difficulty=q.difficulty,
                        question_type=q.question_type,
                        question_text=q.question_text,
                        options=sanitized_options,
                        points=q.points,
                        order_index=q.order_index,
                        citation_label=q.citation_label,
                        document_name=q.document_name,
                    )
                )
            return AssessmentStudentDetailResponse(
                id=assessment.id,
                course_id=assessment.course_id,
                user_id=assessment.user_id,
                title=assessment.title,
                description=assessment.description,
                topic=assessment.topic,
                difficulty=assessment.difficulty,
                is_adaptive=getattr(assessment, "is_adaptive", False) or False,
                time_limit_minutes=assessment.time_limit_minutes,
                total_points=assessment.total_points,
                pass_percentage=assessment.pass_percentage,
                status=assessment.status,
                questions_count=len(assessment.questions),
                created_at=assessment.created_at,
                updated_at=assessment.updated_at,
                questions=student_questions,
            )

        return cls._to_detail_response(assessment, assessment.questions)

    @classmethod
    def delete_assessment(
        cls, db: Session, course_id: str, assessment_id: str, user_id: str
    ) -> None:
        """Purge an assessment and its questions."""
        cls._verify_course_ownership(db, course_id, user_id)
        assessment = AssessmentRepository.get_assessment(db, assessment_id, course_id, user_id)
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found.",
            )
        AssessmentRepository.delete_assessment(db, assessment)

    @classmethod
    def _to_detail_response(
        cls, assessment: Assessment, questions: List[Question]
    ) -> AssessmentDetailResponse:
        """Serializes DB models into typed detail response."""
        parsed_questions = []
        for q in questions:
            options_raw = json.loads(q.options_json) if q.options_json else []
            correct_raw = json.loads(q.correct_answer_json) if q.correct_answer_json else []
            if isinstance(correct_raw, str):
                correct_raw = [correct_raw]

            options_list = [
                QuestionOption(
                    id=opt["id"],
                    text=opt["text"],
                    is_correct=opt.get("is_correct", False),
                    misconception=opt.get("misconception"),
                )
                for opt in options_raw
            ]

            parsed_questions.append(
                QuestionResponse(
                    id=q.id,
                    assessment_id=q.assessment_id,
                    course_id=q.course_id,
                    topic=q.topic,
                    bloom_level=q.bloom_level,
                    difficulty=q.difficulty,
                    question_type=q.question_type,
                    question_text=q.question_text,
                    options=options_list,
                    correct_answers=correct_raw,
                    explanation=q.explanation,
                    points=q.points,
                    order_index=q.order_index,
                    citation_label=q.citation_label,
                    document_name=q.document_name,
                    page_number=q.page_number,
                    slide_number=q.slide_number,
                    timestamp_start=q.timestamp_start,
                    timestamp_end=q.timestamp_end,
                    source_snippet=q.source_snippet,
                    created_at=q.created_at,
                )
            )

        return AssessmentDetailResponse(
            id=assessment.id,
            course_id=assessment.course_id,
            user_id=assessment.user_id,
            title=assessment.title,
            description=assessment.description,
            topic=assessment.topic,
            difficulty=assessment.difficulty,
            is_adaptive=getattr(assessment, "is_adaptive", False) or False,
            time_limit_minutes=assessment.time_limit_minutes,
            total_points=assessment.total_points,
            pass_percentage=assessment.pass_percentage,
            status=assessment.status,
            questions_count=len(parsed_questions),
            created_at=assessment.created_at,
            updated_at=assessment.updated_at,
            questions=parsed_questions,
        )

    @classmethod
    def submit_assessment(
        cls,
        db: Session,
        course_id: str,
        assessment_id: str,
        user_id: str,
        payload: AssessmentSubmitRequest,
    ) -> AssessmentAttemptDetailResponse:
        """
        Score a student's assessment attempt, classify cognitive error taxonomy
        for every incorrect response, and persist the attempt and response logs.
        """
        cls._verify_course_ownership(db, course_id, user_id)
        assessment = AssessmentRepository.get_assessment(db, assessment_id, course_id, user_id)
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found.",
            )

        total_score = 0.0
        total_possible = 0.0
        error_summary: Dict[str, int] = {
            "factual_misconception": 0,
            "procedural_slip": 0,
            "formula_inversion": 0,
            "dimensionality_confusion": 0,
            "unchecked_assumption": 0,
        }
        bloom_summary: Dict[str, Dict[str, float]] = {}
        question_results: List[QuestionResultResponse] = []
        db_logs_to_create = []
        # Normalize submitted answers from either dict or list format
        answers_dict: Dict[str, Any] = {}
        if payload.answers:
            answers_dict.update(payload.answers)
        if payload.responses:
            for item in payload.responses:
                qid = item.get("question_id") if isinstance(item, dict) else getattr(item, "question_id", None)
                ans = item.get("selected_answers") if isinstance(item, dict) else getattr(item, "selected_answers", None)
                if qid is not None:
                    answers_dict[str(qid)] = ans

        for q in assessment.questions:
            total_possible += q.points
            bloom = q.bloom_level
            if bloom not in bloom_summary:
                bloom_summary[bloom] = {"earned": 0.0, "total": 0.0, "accuracy": 0.0}
            bloom_summary[bloom]["total"] += q.points

            raw_options = json.loads(q.options_json) if q.options_json else []
            correct_raw = json.loads(q.correct_answer_json) if q.correct_answer_json else []
            if isinstance(correct_raw, str):
                correct_raw = [correct_raw]

            user_ans = answers_dict.get(q.id)
            if user_ans is None:
                selected_list: List[str] = []
                first_selected = ""
            elif isinstance(user_ans, list):
                selected_list = [str(a) for a in user_ans]
                first_selected = selected_list[0] if selected_list else ""
            else:
                selected_list = [str(user_ans)]
                first_selected = str(user_ans)

            classification = ErrorTaxonomyClassifier.classify(
                selected_option_id=first_selected,
                correct_option_ids=correct_raw,
                options=raw_options,
                question_text=q.question_text,
                explanation=q.explanation,
                points=q.points,
                citation_label=q.citation_label,
                document_name=q.document_name,
            )

            total_score += classification.points_earned
            bloom_summary[bloom]["earned"] += classification.points_earned

            if not classification.is_correct:
                cat = classification.error_category
                if cat in error_summary:
                    error_summary[cat] += 1
                else:
                    error_summary[cat] = 1

            q_res = QuestionResultResponse(
                question_id=q.id,
                order_index=q.order_index,
                question_text=q.question_text,
                bloom_level=q.bloom_level,
                points_possible=q.points,
                points_earned=classification.points_earned,
                selected_answers=selected_list,
                correct_answers=correct_raw,
                is_correct=classification.is_correct,
                error_category=classification.error_category,
                misconception_diagnosis=classification.misconception_diagnosis,
                remediation_hint=classification.remediation_hint,
                explanation=q.explanation,
                citation_label=q.citation_label,
                document_name=q.document_name,
                page_number=q.page_number,
                slide_number=q.slide_number,
                timestamp_start=q.timestamp_start,
                timestamp_end=q.timestamp_end,
                source_snippet=q.source_snippet,
            )
            question_results.append(q_res)
            db_logs_to_create.append({
                "question_id": q.id,
                "selected_answers_json": json.dumps(selected_list),
                "is_correct": classification.is_correct,
                "points_earned": classification.points_earned,
                "points_possible": q.points,
                "bloom_level": q.bloom_level,
                "error_category": classification.error_category,
                "misconception_diagnosis": classification.misconception_diagnosis,
                "remediation_hint": classification.remediation_hint,
            })

        percentage = (total_score / total_possible * 100.0) if total_possible > 0 else 0.0
        passed = percentage >= assessment.pass_percentage

        for b_v in bloom_summary.values():
            b_v["accuracy"] = (b_v["earned"] / b_v["total"]) if b_v["total"] > 0 else 0.0

        attempt = AssessmentRepository.create_attempt(
            db=db,
            assessment_id=assessment.id,
            course_id=course_id,
            user_id=user_id,
            score=total_score,
            total_points=total_possible,
            percentage=round(percentage, 2),
            passed=passed,
            time_spent_seconds=payload.time_spent_seconds,
            error_summary_json=json.dumps(error_summary),
            bloom_summary_json=json.dumps(bloom_summary),
        )

        for log_data in db_logs_to_create:
            AssessmentRepository.add_response_log(
                db=db,
                attempt_id=attempt.id,
                **log_data,
            )

        # ── Phase 9: BKT Update ────────────────────────────────────────────
        # Reload the attempt with response logs populated so MasteryService
        # can iterate over questions and update per-concept mastery state.
        db.refresh(attempt)
        try:
            MasteryService.update_mastery_from_attempt(
                db=db,
                attempt=attempt,
                question_logs=attempt.response_logs,
            )
        except Exception as bkt_exc:
            # BKT failure must NEVER crash the scoring pipeline — log and continue
            logger.warning(f"BKT update non-fatal error: {bkt_exc}")
        # ─────────────────────────────────────────────────────────────────────

        return AssessmentAttemptDetailResponse(
            id=attempt.id,
            assessment_id=attempt.assessment_id,
            course_id=attempt.course_id,
            user_id=attempt.user_id,
            score=attempt.score,
            total_points=attempt.total_points,
            percentage=attempt.percentage,
            passed=attempt.passed,
            time_spent_seconds=attempt.time_spent_seconds,
            error_summary=error_summary,
            bloom_summary=bloom_summary,
            created_at=attempt.created_at,
            question_results=question_results,
        )

    @classmethod
    def get_attempt(
        cls,
        db: Session,
        course_id: str,
        assessment_id: str,
        attempt_id: str,
        user_id: str,
    ) -> AssessmentAttemptDetailResponse:
        """Fetch full diagnostic report for a specific attempt."""
        cls._verify_course_ownership(db, course_id, user_id)
        attempt = AssessmentRepository.get_attempt(
            db=db, attempt_id=attempt_id, course_id=course_id, user_id=user_id
        )
        if not attempt or attempt.assessment_id != assessment_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment attempt not found.",
            )

        error_summary = json.loads(attempt.error_summary_json) if attempt.error_summary_json else {}
        bloom_summary = json.loads(attempt.bloom_summary_json) if attempt.bloom_summary_json else {}

        question_results: List[QuestionResultResponse] = []
        for log in attempt.response_logs:
            q = log.question
            selected = json.loads(log.selected_answers_json) if log.selected_answers_json else []
            correct = json.loads(q.correct_answer_json) if q and q.correct_answer_json else []
            if isinstance(correct, str):
                correct = [correct]

            question_results.append(
                QuestionResultResponse(
                    question_id=log.question_id,
                    order_index=q.order_index if q else 0,
                    question_text=q.question_text if q else "Question",
                    bloom_level=log.bloom_level,
                    points_possible=log.points_possible,
                    points_earned=log.points_earned,
                    selected_answers=selected,
                    correct_answers=correct,
                    is_correct=log.is_correct,
                    error_category=log.error_category,
                    misconception_diagnosis=log.misconception_diagnosis,
                    remediation_hint=log.remediation_hint,
                    explanation=q.explanation if q else "",
                    citation_label=q.citation_label if q else None,
                    document_name=q.document_name if q else None,
                    page_number=q.page_number if q else None,
                    slide_number=q.slide_number if q else None,
                    timestamp_start=q.timestamp_start if q else None,
                    timestamp_end=q.timestamp_end if q else None,
                    source_snippet=q.source_snippet if q else None,
                )
            )

        return AssessmentAttemptDetailResponse(
            id=attempt.id,
            assessment_id=attempt.assessment_id,
            course_id=attempt.course_id,
            user_id=attempt.user_id,
            score=attempt.score,
            total_points=attempt.total_points,
            percentage=attempt.percentage,
            passed=attempt.passed,
            time_spent_seconds=attempt.time_spent_seconds,
            error_summary=error_summary,
            bloom_summary=bloom_summary,
            created_at=attempt.created_at,
            question_results=question_results,
        )

    @classmethod
    def list_attempts(
        cls,
        db: Session,
        course_id: str,
        assessment_id: str,
        user_id: str,
    ) -> List[AssessmentAttemptResponse]:
        """List all attempts submitted by the student for this assessment."""
        cls._verify_course_ownership(db, course_id, user_id)
        attempts = AssessmentRepository.list_attempts(
            db=db, assessment_id=assessment_id, user_id=user_id
        )
        return [
            AssessmentAttemptResponse(
                id=a.id,
                assessment_id=a.assessment_id,
                course_id=a.course_id,
                user_id=a.user_id,
                score=a.score,
                total_points=a.total_points,
                percentage=a.percentage,
                passed=a.passed,
                time_spent_seconds=a.time_spent_seconds,
                error_summary=json.loads(a.error_summary_json) if a.error_summary_json else {},
                bloom_summary=json.loads(a.bloom_summary_json) if a.bloom_summary_json else {},
                created_at=a.created_at,
            )
            for a in attempts
        ]

