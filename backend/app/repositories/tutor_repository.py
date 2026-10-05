"""Repository layer for TutorSession and TutorMessage persistence."""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.tutor import TutorSession, TutorMessage


class TutorRepository:
    """Manages database CRUD operations for multi-turn AI Tutor sessions and message dialogues."""

    @staticmethod
    def create_session(
        db: Session,
        course_id: str,
        user_id: str,
        title: str,
        pedagogical_mode: str = "socratic",
        topic: Optional[str] = None,
    ) -> TutorSession:
        """Create and persist a new tutoring session."""
        session = TutorSession(
            course_id=course_id,
            user_id=user_id,
            title=title or "New Study Session",
            pedagogical_mode=pedagogical_mode or "socratic",
            topic=topic,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def list_sessions(db: Session, course_id: str, user_id: str) -> List[TutorSession]:
        """List all tutoring sessions for a student's course workspace."""
        return (
            db.query(TutorSession)
            .filter(
                TutorSession.course_id == course_id,
                TutorSession.user_id == user_id,
            )
            .order_by(TutorSession.updated_at.desc())
            .all()
        )

    @staticmethod
    def get_session(
        db: Session, session_id: str, course_id: str, user_id: str
    ) -> Optional[TutorSession]:
        """Retrieve a specific tutoring session ensuring workspace and user isolation."""
        return (
            db.query(TutorSession)
            .filter(
                TutorSession.id == session_id,
                TutorSession.course_id == course_id,
                TutorSession.user_id == user_id,
            )
            .first()
        )

    @staticmethod
    def update_mode(db: Session, session: TutorSession, new_mode: str) -> TutorSession:
        """Dynamically switch the pedagogical mode of an active session."""
        session.pedagogical_mode = new_mode
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def delete_session(db: Session, session: TutorSession) -> None:
        """Delete tutoring session and cascade all dialogue messages."""
        db.delete(session)
        db.commit()

    @staticmethod
    def add_message(
        db: Session,
        session_id: str,
        sender: str,
        content: str,
        pedagogical_mode: Optional[str] = None,
        citations_json: Optional[str] = None,
    ) -> TutorMessage:
        """Record a single dialogue turn in the session."""
        msg = TutorMessage(
            session_id=session_id,
            sender=sender,
            content=content,
            pedagogical_mode=pedagogical_mode,
            citations_json=citations_json,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg
