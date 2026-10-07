"""Admin service for platform KPI aggregation, fleet management, and governance."""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from fastapi import HTTPException, status

from app.models.user import User
from app.models.course import Course, Topic
from app.models.document import Document, DocumentChunk
from app.models.tutor import TutorSession
from app.models.assessment import Assessment, AssessmentAttempt
from app.models.flashcard import Flashcard
from app.database import check_db_connection
from app.schemas.admin import (
    AdminStatsResponse,
    AdminUserItem,
    AdminCourseItem,
    AdminActivityItem,
)

logger = logging.getLogger(__name__)


class AdminService:
    """Central administrative operations service."""

    @classmethod
    def get_platform_stats(cls, db: Session) -> AdminStatsResponse:
        """Aggregate platform-wide KPIs, asset counts, and health telemetry."""
        total_users = db.query(func.count(User.id)).scalar() or 0
        total_students = db.query(func.count(User.id)).filter(or_(User.role == "student", User.role.is_(None))).scalar() or 0
        total_instructors = db.query(func.count(User.id)).filter(User.role == "instructor").scalar() or 0
        total_admins = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0

        total_courses = db.query(func.count(Course.id)).scalar() or 0
        total_documents = db.query(func.count(Document.id)).scalar() or 0
        total_chunks = db.query(func.count(DocumentChunk.id)).scalar() or 0
        total_topics = db.query(func.count(Topic.id)).scalar() or 0
        total_flashcards = db.query(func.count(Flashcard.id)).scalar() or 0
        total_assessments = db.query(func.count(Assessment.id)).scalar() or 0
        total_tutor_sessions = db.query(func.count(TutorSession.id)).scalar() or 0

        total_storage_bytes = db.query(func.sum(Document.file_size)).scalar() or 0

        db_health = check_db_connection()

        return AdminStatsResponse(
            total_users=total_users,
            total_students=total_students,
            total_instructors=total_instructors,
            total_admins=total_admins,
            total_courses=total_courses,
            total_documents=total_documents,
            total_chunks=total_chunks,
            total_topics=total_topics,
            total_flashcards=total_flashcards,
            total_assessments=total_assessments,
            total_tutor_sessions=total_tutor_sessions,
            total_storage_bytes=int(total_storage_bytes),
            database_status=db_health.get("status", "connected"),
            database_dialect=db_health.get("dialect", "sqlite"),
        )

    @classmethod
    def list_users(cls, db: Session, search: Optional[str] = None) -> List[AdminUserItem]:
        """List registered users with course counts and roles."""
        query = db.query(User)
        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    User.name.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                    User.role.ilike(search_pattern),
                )
            )

        users = query.order_by(desc(User.created_at)).all()
        result = []
        for u in users:
            courses_count = len(u.courses) if hasattr(u, "courses") and u.courses else 0
            result.append(
                AdminUserItem(
                    id=u.id,
                    name=u.name,
                    email=u.email,
                    role=getattr(u, "role", "student") or "student",
                    education_level=u.education_level or "Undergraduate",
                    courses_count=courses_count,
                    created_at=u.created_at,
                    updated_at=u.updated_at,
                )
            )
        return result

    @classmethod
    def update_user_role(cls, db: Session, user_id: str, new_role: str) -> AdminUserItem:
        """Promote, demote, or change a user's role."""
        valid_roles = {"student", "instructor", "admin"}
        if new_role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role '{new_role}'. Must be one of: {', '.join(valid_roles)}",
            )

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        user.role = new_role
        db.commit()
        db.refresh(user)
        logger.info(f"Admin updated role for user {user.email} (id={user.id}) to '{new_role}'")

        courses_count = len(user.courses) if hasattr(user, "courses") and user.courses else 0
        return AdminUserItem(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            education_level=user.education_level or "Undergraduate",
            courses_count=courses_count,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    @classmethod
    def list_courses(cls, db: Session, search: Optional[str] = None) -> List[AdminCourseItem]:
        """List all courses created across the platform with owner details."""
        query = db.query(Course)
        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Course.name.ilike(search_pattern),
                    Course.subject.ilike(search_pattern),
                )
            )

        courses = query.order_by(desc(Course.created_at)).all()
        result = []
        for c in courses:
            owner = c.user
            docs_count = len(c.documents) if hasattr(c, "documents") and c.documents else 0
            topics_count = len(c.topics) if hasattr(c, "topics") and c.topics else 0
            result.append(
                AdminCourseItem(
                    id=c.id,
                    name=c.name,
                    subject=c.subject,
                    description=c.description,
                    user_id=c.user_id,
                    user_name=owner.name if owner else None,
                    user_email=owner.email if owner else None,
                    documents_count=docs_count,
                    topics_count=topics_count,
                    created_at=c.created_at,
                    updated_at=c.updated_at,
                )
            )
        return result

    @classmethod
    def delete_course(cls, db: Session, course_id: str) -> None:
        """Administrative course purge across all relational cascades."""
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found.",
            )
        db.delete(course)
        db.commit()
        logger.info(f"Admin deleted course {course.id} ({course.name})")

    @classmethod
    def get_audit_activity(cls, db: Session, limit: int = 25) -> List[AdminActivityItem]:
        """Compile a combined chronological audit stream of platform events."""
        events = []

        # 1. Recent documents
        recent_docs = db.query(Document).order_by(desc(Document.created_at)).limit(limit).all()
        for d in recent_docs:
            course = d.course
            owner = course.user if course else None
            events.append(
                AdminActivityItem(
                    id=f"doc_{d.id}",
                    type="document_upload",
                    title=f"Material Added: {d.filename[:50]}",
                    detail=f"Format: {d.file_type.upper()} | Chunks: {len(d.chunks)} | Course: {course.name if course else 'Unknown'}",
                    user_name=owner.name if owner else None,
                    user_email=owner.email if owner else None,
                    timestamp=d.created_at,
                )
            )

        # 2. Recent courses
        recent_courses = db.query(Course).order_by(desc(Course.created_at)).limit(limit).all()
        for c in recent_courses:
            owner = c.user
            events.append(
                AdminActivityItem(
                    id=f"course_{c.id}",
                    type="course_created",
                    title=f"Course Created: {c.name[:50]}",
                    detail=f"Subject: {c.subject} | Description: {(c.description or 'None')[:60]}",
                    user_name=owner.name if owner else None,
                    user_email=owner.email if owner else None,
                    timestamp=c.created_at,
                )
            )

        # 3. Recent tutor sessions
        recent_sessions = db.query(TutorSession).order_by(desc(TutorSession.created_at)).limit(limit).all()
        for s in recent_sessions:
            course = s.course
            owner = course.user if course else None
            events.append(
                AdminActivityItem(
                    id=f"tutor_{s.id}",
                    type="tutor_session",
                    title=f"Socratic AI Chat ({s.mode.upper()})",
                    detail=f"Messages: {len(s.messages)} | Course: {course.name if course else 'Unknown'}",
                    user_name=owner.name if owner else None,
                    user_email=owner.email if owner else None,
                    timestamp=s.created_at,
                )
            )

        # Sort all events chronologically descending
        events.sort(key=lambda x: x.timestamp, reverse=True)
        return events[:limit]
