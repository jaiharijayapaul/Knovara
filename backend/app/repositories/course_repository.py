"""Repository for Course and Topic database operations with workspace isolation."""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.course import Course, Topic


class CourseRepository:
    """Encapsulates data access and isolation boundaries for Course and Topic entities."""

    @staticmethod
    def get_by_id(db: Session, course_id: str, user_id: Optional[str] = None) -> Optional[Course]:
        """
        Query a course by ID, optionally scoped to a user to guarantee isolation.
        """
        query = db.query(Course).filter(Course.id == course_id)
        if user_id:
            query = query.filter(Course.user_id == user_id)
        return query.first()

    @staticmethod
    def list_by_user(db: Session, user_id: str) -> List[Course]:
        """List all courses belonging to the given student."""
        return db.query(Course).filter(Course.user_id == user_id).order_by(Course.created_at.desc()).all()

    @staticmethod
    def create(
        db: Session,
        user_id: str,
        name: str,
        description: Optional[str] = None,
        subject: str = "Computer Science",
    ) -> Course:
        """Create a new course workspace for a user."""
        course = Course(
            user_id=user_id,
            name=name.strip(),
            description=description.strip() if description else None,
            subject=subject.strip(),
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def update(
        db: Session,
        course: Course,
        name: Optional[str] = None,
        description: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> Course:
        """Update course workspace details."""
        if name is not None:
            course.name = name.strip()
        if description is not None:
            course.description = description.strip()
        if subject is not None:
            course.subject = subject.strip()

        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def delete(db: Session, course: Course) -> None:
        """Delete course workspace and all cascading child entities."""
        db.delete(course)
        db.commit()

    @staticmethod
    def create_topic(
        db: Session,
        course_id: str,
        name: str,
        description: Optional[str] = None,
        parent_topic_id: Optional[str] = None,
    ) -> Topic:
        """Add a curriculum topic to a course."""
        topic = Topic(
            course_id=course_id,
            name=name.strip(),
            description=description.strip() if description else None,
            parent_topic_id=parent_topic_id,
        )
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    def list_topics(db: Session, course_id: str) -> List[Topic]:
        """List all topics associated with a course."""
        return db.query(Topic).filter(Topic.course_id == course_id).order_by(Topic.created_at.asc()).all()
