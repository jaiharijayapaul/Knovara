"""Standalone database seed script for Knovara hackathon demonstration."""

import os
import sys

# Ensure backend package is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../backend"))
sys.path.insert(0, backend_dir)

from app.database import SessionLocal, init_db  # type: ignore
from app.repositories.user_repository import UserRepository  # type: ignore
from app.auth.security import hash_password  # type: ignore
from app.services.course_service import CourseService  # type: ignore


def seed_database():
    """Seed demo user and standardized Machine Learning course."""
    print("Initializing database tables...")
    init_db()

    db = SessionLocal()
    try:
        demo_email = "sarah@knovara.edu"
        demo_user = UserRepository.get_by_email(db, demo_email)
        if not demo_user:
            print(f"Creating demo student: {demo_email}")
            demo_user = UserRepository.create(
                db=db,
                name="Sarah Connor",
                email=demo_email,
                password_hash=hash_password("StrongPassword2026!"),
                education_level="Undergraduate",
            )
        else:
            print(f"Demo student already exists: {demo_email}")

        print(f"Seeding Track D 'Machine Learning' course for {demo_user.email}...")
        course = CourseService.seed_demo_course(db, demo_user.id)
        print(f"Successfully seeded '{course.name}' with {len(course.topics)} topics:")
        for idx, topic in enumerate(course.topics, 1):
            desc = (topic.description or "")[:60]
            print(f"  {idx}. {topic.name}: {desc}...")

        print("\nSeed completed successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
