"""Repository for User database operations."""

from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User


class UserRepository:
    """Encapsulates data access queries for the User model."""

    @staticmethod
    def get_by_id(db: Session, user_id: str) -> Optional[User]:
        """Query user record by unique identifier."""
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        """Query user record by unique email address (case-insensitive)."""
        return db.query(User).filter(User.email == email.strip().lower()).first()

    @staticmethod
    def create(
        db: Session,
        name: str,
        email: str,
        password_hash: str,
        education_level: str = "Undergraduate",
    ) -> User:
        """Persist a new user record."""
        user = User(
            name=name.strip(),
            email=email.strip().lower(),
            password_hash=password_hash,
            education_level=education_level.strip(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
