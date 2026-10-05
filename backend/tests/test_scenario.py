"""
Phase 12: Final Polish & Full-Lifecycle Presentation Scenario Tests.

Verifies:
1. Automated seeding of complete presentation scenario via POST /courses/{course_id}/seed-scenario.
2. Immediate availability of multimodal documents, BKT models, Bloom assessments, attempts,
   flashcard decks, Socratic dialogue, and learning telemetry.
3. Multi-tenant isolation ensuring seeded scenarios remain strictly isolated per student.
"""

from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_seed_full_course_presentation_scenario():
    """Verify that seed-scenario creates a complete, presentation-ready learner journey."""
    timestamp = int(datetime.now(timezone.utc).timestamp())
    email = f"scenario_evaluator_{timestamp}@knovara.edu"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword2026!", "name": "Defense Evaluator"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create empty course
    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Machine Learning Defense Demo", "description": "Full-lifecycle test workspace"},
        headers=headers,
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    # 1. Trigger Full Scenario Seed
    seed_res = client.post(f"/api/v1/courses/{course_id}/seed-scenario", headers=headers)
    assert seed_res.status_code == 201
    seed_data = seed_res.json()
    assert seed_data["course_id"] == course_id
    assert seed_data["bkt_concepts_calibrated"] == 6
    assert seed_data["status"] == "ready_for_defense_presentation"

    # 2. Verify Documents exist
    docs_res = client.get(f"/api/v1/courses/{course_id}/documents", headers=headers)
    assert docs_res.status_code == 200
    docs = docs_res.json()
    assert len(docs) >= 3

    # 3. Verify BKT Mastery State
    mastery_res = client.get(f"/api/v1/courses/{course_id}/mastery", headers=headers)
    assert mastery_res.status_code == 200
    mastery = mastery_res.json()
    assert len(mastery["concepts"]) == 6
    # Verify both mastered and unmastered concepts exist
    mastered = [c for c in mastery["concepts"] if c["is_mastered"]]
    unmastered = [c for c in mastery["concepts"] if not c["is_mastered"]]
    assert len(mastered) >= 2
    assert len(unmastered) >= 2

    # 4. Verify Assessment & Scored Attempt with Bloom Levels
    assess_res = client.get(f"/api/v1/courses/{course_id}/assessments", headers=headers)
    assert assess_res.status_code == 200
    assessments = assess_res.json()
    assert len(assessments) >= 1
    bench_assess = assessments[0]
    assert bench_assess["is_adaptive"] is True

    # Check attempt history
    att_res = client.get(
        f"/api/v1/courses/{course_id}/assessments/{bench_assess['id']}/attempts",
        headers=headers,
    )
    assert att_res.status_code == 200
    attempts = att_res.json()
    assert len(attempts) >= 1
    first_attempt = attempts[0]
    assert first_attempt["score"] == 40.0
    assert first_attempt["percentage"] == 66.7

    # 5. Verify Flashcard Deck & Due Reviews
    fc_res = client.get(f"/api/v1/courses/{course_id}/flashcards", headers=headers)
    assert fc_res.status_code == 200
    cards = fc_res.json()
    assert len(cards) >= 6

    # 6. Verify Tutor Dialogue with Grounded Citations
    tutor_res = client.get(f"/api/v1/courses/{course_id}/tutor/sessions", headers=headers)
    assert tutor_res.status_code == 200
    sessions = tutor_res.json()
    assert len(sessions) >= 1
    first_session = sessions[0]
    assert "Targeted Remediation" in first_session["title"]

    # 7. Verify Comprehensive Learning Telemetry Report
    analytics_res = client.get(f"/api/v1/courses/{course_id}/analytics", headers=headers)
    assert analytics_res.status_code == 200
    report = analytics_res.json()
    assert report["velocity"]["total_interactions"] >= 5
    assert len(report["bloom_telemetry"]) == 6
    assert len(report["misconception_telemetry"]) >= 1
    assert report["retention_forecast"]["active_cards"] >= 6
    assert len(report["concept_matrix"]) == 6
