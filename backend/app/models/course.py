"""Course and Topic model definitions for isolated learning workspaces."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Course(Base):
    """
    Isolated course learning workspace.
    Every course isolates documents, chunks, topics, chats, and mastery models.
    """
    __tablename__ = "courses"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(100), nullable=False, default="General")
    study_notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="courses")
    topics = relationship("Topic", back_populates="course", cascade="all, delete-orphan", order_by="Topic.created_at")
    documents = relationship("Document", back_populates="course", cascade="all, delete-orphan", order_by="Document.created_at")

    def __repr__(self) -> str:
        return f"<Course {self.name} (user_id={self.user_id})>"


class Topic(Base):
    """Topic hierarchy belonging to a specific course."""
    __tablename__ = "topics"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    course_id = Column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    parent_topic_id = Column(
        String(36),
        ForeignKey("topics.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    course = relationship("Course", back_populates="topics")
    subtopics = relationship("Topic", backref="parent_topic", remote_side=[id])

    def __repr__(self) -> str:
        return f"<Topic {self.name} (course_id={self.course_id})>"
