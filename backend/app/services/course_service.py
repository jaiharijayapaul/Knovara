"""Course business logic and demo course seeding service."""

import logging
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.course_repository import CourseRepository
from app.schemas.course import (
    CourseCreate,
    CourseUpdate,
    CourseResponse,
    CourseDetailResponse,
    TopicCreate,
    TopicResponse,
)

logger = logging.getLogger(__name__)


class CourseService:
    """Manages course lifecycles, user access isolation, and topic structures."""

    @staticmethod
    def list_courses(db: Session, user_id: str) -> List[CourseResponse]:
        """List all courses created by the student."""
        courses = CourseRepository.list_by_user(db, user_id)
        results = []
        for course in courses:
            results.append(
                CourseResponse(
                    id=course.id,
                    user_id=course.user_id,
                    name=course.name,
                    description=course.description,
                    subject=course.subject,
                    created_at=course.created_at,
                    updated_at=course.updated_at,
                    topics_count=len(getattr(course, "topics", [])),
                    documents_count=len(getattr(course, "documents", [])),
                    study_notes=course.study_notes,
                )
            )
        return results

    @staticmethod
    def get_course_detail(db: Session, course_id: str, user_id: str) -> CourseDetailResponse:
        """Retrieve course details ensuring strict user workspace isolation."""
        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found or you do not have permission to access it.",
            )

        topics = [TopicResponse.model_validate(t) for t in course.topics]
        return CourseDetailResponse(
            id=course.id,
            user_id=course.user_id,
            name=course.name,
            description=course.description,
            subject=course.subject,
            created_at=course.created_at,
            updated_at=course.updated_at,
            topics_count=len(topics),
            documents_count=len(getattr(course, "documents", [])),
            study_notes=course.study_notes,
            topics=topics,
        )

    @staticmethod
    def create_course(db: Session, user_id: str, payload: CourseCreate) -> CourseDetailResponse:
        """Create a new course workspace for the student."""
        course = CourseRepository.create(
            db=db,
            user_id=user_id,
            name=payload.name,
            description=payload.description,
            subject=payload.subject,
        )
        logger.info(f"Created course workspace '{course.name}' for user {user_id}")
        return CourseDetailResponse(
            id=course.id,
            user_id=course.user_id,
            name=course.name,
            description=course.description,
            subject=course.subject,
            created_at=course.created_at,
            updated_at=course.updated_at,
            topics_count=0,
            documents_count=0,
            topics=[],
        )

    @staticmethod
    def update_course(
        db: Session, course_id: str, user_id: str, payload: CourseUpdate
    ) -> CourseResponse:
        """Update course workspace details with ownership verification."""
        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found.",
            )

        updated_course = CourseRepository.update(
            db=db,
            course=course,
            name=payload.name,
            description=payload.description,
            subject=payload.subject,
        )
        return CourseResponse(
            id=updated_course.id,
            user_id=updated_course.user_id,
            name=updated_course.name,
            description=updated_course.description,
            subject=updated_course.subject,
            created_at=updated_course.created_at,
            updated_at=updated_course.updated_at,
            topics_count=len(getattr(updated_course, "topics", [])),
            documents_count=len(getattr(updated_course, "documents", [])),
            study_notes=updated_course.study_notes,
        )

    @staticmethod
    def delete_course(db: Session, course_id: str, user_id: str) -> None:
        """Delete course workspace and all associated materials."""
        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found.",
            )

        CourseRepository.delete(db=db, course=course)
        logger.info(f"Deleted course workspace {course_id} for user {user_id}")

    @staticmethod
    def add_topic_to_course(
        db: Session, course_id: str, user_id: str, payload: TopicCreate
    ) -> TopicResponse:
        """Add a curriculum topic to an isolated course."""
        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found.",
            )

        topic = CourseRepository.create_topic(
            db=db,
            course_id=course.id,
            name=payload.name,
            description=payload.description,
            parent_topic_id=payload.parent_topic_id,
        )
        return TopicResponse.model_validate(topic)

    @staticmethod
    def seed_demo_course(db: Session, user_id: str) -> CourseDetailResponse:
        """
        Seed the standardized hackathon development course 'Machine Learning'
        with 6 foundational topics as specified in Track D Section 31.
        """
        course_name = "Machine Learning"
        # Check if already seeded
        existing_courses = CourseRepository.list_by_user(db, user_id)
        for c in existing_courses:
            if c.name.strip().lower() == course_name.lower():
                return CourseService.get_course_detail(db, c.id, user_id)

        course = CourseRepository.create(
            db=db,
            user_id=user_id,
            name=course_name,
            description="Foundations of statistical learning, supervised & unsupervised models, and algorithmic decision making. (Demo Course)",
            subject="Artificial Intelligence",
        )

        demo_topics = [
            ("Regression", "Linear & polynomial regression, cost functions, gradient descent optimization, and regularization (L1/L2)."),
            ("Classification", "Logistic regression, decision boundaries, ROC-AUC, precision, recall, and cross-entropy loss."),
            ("Decision Trees", "Entropy, Information Gain, Gini impurity, tree pruning, ID3/CART algorithms, and split criteria."),
            ("Random Forest", "Ensemble bagging techniques, feature bootstrap aggregation, out-of-bag error, and variance reduction."),
            ("Support Vector Machines (SVM)", "Maximum margin classifiers, slack variables, soft margins, and kernel tricks (RBF, Polynomial)."),
            ("Clustering", "Unsupervised K-Means clustering, centroid convergence, hierarchical dendrograms, and silhouette validation."),
        ]

        for topic_name, topic_desc in demo_topics:
            CourseRepository.create_topic(
                db=db,
                course_id=course.id,
                name=topic_name,
                description=topic_desc,
            )

        logger.info(f"Seeded demo course '{course.name}' with {len(demo_topics)} topics for user {user_id}")
        return CourseService.get_course_detail(db, course.id, user_id)

    @staticmethod
    def get_course_flow_map(db: Session, course_id: str, user_id: str):
        """
        Builds the prerequisite curriculum Directed Acyclic Graph (DAG) flow map
        incorporating live Bayesian Knowledge Tracing (BKT) concept mastery.
        """
        import math
        from app.schemas.course import (
            CourseFlowMapNode,
            CourseFlowMapEdge,
            CourseFlowMapResponse,
        )
        from app.repositories.mastery_repository import MasteryRepository

        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found.",
            )

        topics = course.topics or []
        mastery_records = MasteryRepository.get_all_for_course(db, user_id=user_id, course_id=course_id)
        mastery_by_topic = {m.concept_label.lower().strip(): m for m in mastery_records}

        nodes = []
        edges = []
        total_p_know = 0.0

        for idx, topic in enumerate(topics):
            m = mastery_by_topic.get(topic.name.lower().strip())
            p_know = m.p_know if m else 0.25
            is_mastered = m.is_mastered if m else False
            total_p_know += p_know

            # Determine prerequisites
            prereqs = []
            if topic.parent_topic_id:
                prereqs.append(topic.parent_topic_id)
            elif idx > 0:
                # Sequential curriculum prerequisite chain
                prereqs.append(topics[idx - 1].id)

            # Node status based on mastery and prerequisites
            if is_mastered or p_know >= 0.90:
                node_status = "mastered"
            elif p_know >= 0.50:
                node_status = "in_progress"
            elif idx == 0 or (idx > 0 and (mastery_by_topic.get(topics[idx - 1].name.lower().strip(), None) and mastery_by_topic[topics[idx - 1].name.lower().strip()].p_know >= 0.45)):
                node_status = "available"
            else:
                node_status = "locked"

            # Count chunks for this topic
            chunk_count = sum(
                1 for doc in course.documents
                for c in doc.chunks
                if (c.topic and topic.name.lower() in c.topic.lower()) or topic.name.lower() in c.content.lower()
            )

            nodes.append(
                CourseFlowMapNode(
                    id=topic.id,
                    name=topic.name,
                    description=topic.description,
                    order_index=idx,
                    prerequisites=prereqs,
                    p_know=round(p_know, 3),
                    mastery_percentage=round(p_know * 100, 1),
                    is_mastered=is_mastered,
                    status=node_status,
                    chunk_count=chunk_count,
                )
            )

            # Build edges
            if topic.parent_topic_id:
                edges.append(
                    CourseFlowMapEdge(
                        source=topic.parent_topic_id,
                        target=topic.id,
                        relationship="subtopic",
                    )
                )
            elif idx > 0:
                edges.append(
                    CourseFlowMapEdge(
                        source=topics[idx - 1].id,
                        target=topic.id,
                        relationship="prerequisite",
                    )
                )

        avg_progress = round((total_p_know / len(topics)) * 100, 1) if topics else 0.0

        return CourseFlowMapResponse(
            course_id=course.id,
            course_name=course.name,
            subject=course.subject,
            nodes=nodes,
            edges=edges,
            overall_progress_percentage=avg_progress,
        )

    @staticmethod
    def get_study_schedule(db: Session, course_id: str, user_id: str, target_exam_date: str = None):
        """
        Generates an adaptive spaced-repetition study schedule based on
        the Hermann Ebbinghaus forgetting curve R = e^(-t/S) and BKT mastery state.
        """
        import math
        from datetime import datetime, timezone, timedelta
        from app.schemas.course import StudyScheduleItem, StudyScheduleResponse
        from app.repositories.mastery_repository import MasteryRepository

        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found.",
            )

        now = datetime.now(timezone.utc)
        if target_exam_date:
            try:
                exam_dt = datetime.strptime(target_exam_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                exam_dt = now + timedelta(days=14)
        else:
            exam_dt = now + timedelta(days=14)

        days_until_exam = max(1, (exam_dt - now).days)
        topics = course.topics or []
        mastery_records = MasteryRepository.get_all_for_course(db, user_id=user_id, course_id=course_id)
        mastery_by_topic = {m.concept_label.lower().strip(): m for m in mastery_records}

        schedule_items = []

        # Sort topics by BKT priority: lowest mastery first
        def topic_sort_key(t):
            rec = mastery_by_topic.get(t.name.lower().strip())
            return rec.p_know if rec else 0.25

        sorted_topics = sorted(topics, key=topic_sort_key)

        for day in range(min(days_until_exam, 14)):
            sched_date = (now + timedelta(days=day)).strftime("%Y-%m-%d")
            # Select topic for day based on cycle and spaced interval
            target_topic = sorted_topics[day % len(sorted_topics)] if sorted_topics else None
            if not target_topic:
                continue

            rec = mastery_by_topic.get(target_topic.name.lower().strip())
            p_know = rec.p_know if rec else 0.25
            attempts = rec.total_attempts if rec else 1

            # Ebbinghaus stability S: increases with repetitions and knowledge probability
            stability_s = max(1.0, 1.5 * (1.0 + attempts * 0.8) * (0.4 + p_know * 1.2))
            # Retention R = e^(-t / S) where t is simulated days since initial exposure
            t_elapsed = float(day + 1)
            retention_r = math.exp(-t_elapsed / stability_s)
            retention_pct = round(retention_r * 100, 1)

            if p_know < 0.40:
                session_type = "initial_study" if day < 3 else "deep_practice"
                urgency = "high"
                duration = 45
                action = f"Socratic AI Tutor review on foundational definitions of {target_topic.name} and diagnostic practice."
            elif p_know < 0.70:
                session_type = "review_1" if day < 7 else "review_2"
                urgency = "medium"
                duration = 30
                action = f"Diagnostic quiz attempt to uncover procedural or sign slip misconceptions in {target_topic.name}."
            else:
                session_type = "review_2" if day < 10 else "final_cram"
                urgency = "low"
                duration = 20
                action = f"Rapid active recall flashcard session and high-yield formula check for {target_topic.name}."

            schedule_items.append(
                StudyScheduleItem(
                    date=sched_date,
                    day_offset=day,
                    topic=target_topic.name,
                    session_type=session_type,
                    retention_estimate=round(retention_r, 4),
                    retention_percentage=retention_pct,
                    urgency=urgency,
                    recommended_duration_mins=duration,
                    suggested_action=action,
                )
            )

        summary_text = (
            f"Personalized {days_until_exam}-day Ebbinghaus spaced revision plan for '{course.name}'. "
            f"Prioritizes lowest BKT mastery concepts first to counter memory decay before the target exam date."
        )

        return StudyScheduleResponse(
            course_id=course.id,
            course_name=course.name,
            target_exam_date=exam_dt.strftime("%Y-%m-%d"),
            days_until_exam=days_until_exam,
            daily_allocated_hours=round(sum(s.recommended_duration_mins for s in schedule_items) / (len(schedule_items) * 60.0), 1) if schedule_items else 0.5,
            schedule=schedule_items,
            summary=summary_text,
        )



