"""
Standalone CLI script to seed a presentation-ready evaluation scenario.

Usage:
    python backend/scripts/seed_demo_scenario.py
"""

import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal, init_db
from app.models.user import User
from app.auth.security import hash_password
from app.services.course_service import CourseService
from app.services.scenario_service import seed_full_course_scenario


def main():
    print("=" * 65)
    print("   🎓 KNOVARA — PRESENTATION & DEFENSE SCENARIO SEEDER 🎓   ")
    print("=" * 65)
    print("\n[1/4] Initializing database schema...")
    init_db()

    db = SessionLocal()
    try:
        # Step 1: Default Presentation Student Account
        email = "sarah@knovara.edu"
        password = "StrongPassword2026!"
        name = "Sarah Connor (Demo Student)"

        print(f"[2/4] Verifying presentation user account ({email})...")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                name=name,
                hashed_password=hash_password(password),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"      ✓ Created presentation account: {email}")
        else:
            print(f"      ✓ Existing presentation account ready: {email}")

        # Step 2: Seed / Retrieve Demo Course
        print("[3/4] Ensuring 'Machine Learning' course workspace exists...")
        course_detail = CourseService.seed_demo_course(db, user.id)
        course_id = course_detail.id
        print(f"      ✓ Course workspace established: '{course_detail.name}' ({course_id})")

        # Step 3: Populate Full Presentation Scenario
        print("[4/4] Populating full multi-source learner telemetry scenario...")
        summary = seed_full_course_scenario(db, course_id, user.id)

        print("\n" + "=" * 65)
        print("   ✅ PRESENTATION SCENARIO SUCCESSFULLY SEEDED! ✅   ")
        print("=" * 65)
        print(f"• Student Account : {email}")
        print(f"• Password        : {password}")
        print(f"• Course Name     : {summary['course_name']}")
        print(f"• Topics Count    : {summary['topics_count']} topics")
        print(f"• BKT Calibration : {summary['bkt_concepts_calibrated']} concepts with sparkline histories")
        print(f"• Assessment Title: {summary['assessment_title']} (6 Bloom levels)")
        print(f"• Flashcards Deck : {summary['flashcards_count']} cards (with mature & due cards)")
        print(f"• Socratic Dialogue: Targeted remediation session with citations")
        print(f"• Progress Report : Real-time telemetry, Bloom radar & retention curve ready")
        print("=" * 65)
        print("\nReady for live presentation! Launch the frontend and login.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
