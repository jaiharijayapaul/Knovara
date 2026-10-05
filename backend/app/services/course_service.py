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


