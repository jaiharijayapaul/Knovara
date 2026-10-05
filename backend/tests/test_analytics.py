"""
Phase 11: Comprehensive Learning Analytics & Progress Telemetry Tests.

Verifies:
1. Telemetry generation across BKT mastery, assessment attempts, error taxonomy, and flashcards.
2. Cognitive Bloom distribution accuracy and volume calculation.
3. Diagnostic misconception category distribution and remediation mapping.
4. Spaced Repetition (SM-2) Ebbinghaus retention decay curve and review queue forecasts.
5. 14-day study activity timeline and engagement velocity tracking.
6. Exportable report generation in Markdown and JSON formats.
7. Multi-tenant workspace isolation.
"""

from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_comprehensive_learning_analytics_and_telemetry():
    """End-to-end verification of learning analytics engine and progress reports."""
    # 1. Setup User and Course
    timestamp = int(datetime.now(timezone.utc).timestamp())
    email = f"analytics_student_{timestamp}@knovara.edu"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword2026!", "name": "Telemetry Analyst"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Data Analytics & Machine Learning", "description": "Phase 11 verification course"},
        headers=headers,
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    # Seed demo materials
    seed_res = client.post(f"/api/v1/courses/{course_id}/documents/demo-seed", headers=headers)
    assert seed_res.status_code == 201

    # 2. Check baseline analytics for fresh course
    initial_res = client.get(f"/api/v1/courses/{course_id}/analytics", headers=headers)
    assert initial_res.status_code == 200
    init_data = initial_res.json()
    assert init_data["course_id"] == course_id
    assert "velocity" in init_data
    assert "bloom_telemetry" in init_data
    assert len(init_data["bloom_telemetry"]) == 6
    assert "retention_forecast" in init_data
    assert len(init_data["retention_forecast"]["forecast_days"]) == 15
    assert "executive_summary" in init_data

    # 3. Generate and complete an Assessment to seed Bloom telemetry and error taxonomy
    gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={
            "num_questions": 4,
            "topic": "Neural Networks",
            "difficulty": "medium",
            "bloom_levels": ["remember", "understand", "apply", "analyze"]
        },
        headers=headers,
    )
    assert gen_res.status_code == 201
    assessment_id = gen_res.json()["id"]

    det_res = client.get(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}?student_mode=false",
        headers=headers,
    )
    questions = det_res.json()["questions"]
    assert len(questions) >= 2

    # Submit 1 correct and 1 incorrect answer
    sub_answers = {}
    # Question 0 correct
    sub_answers[questions[0]["id"]] = questions[0]["correct_answers"]
    # Question 1 incorrect (pick wrong option)
    wrong_opts = [o["id"] for o in questions[1]["options"] if o["id"] not in questions[1]["correct_answers"]]
    sub_answers[questions[1]["id"]] = [wrong_opts[0] if wrong_opts else "A"]

    sub_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}/submit",
        json={"answers": sub_answers, "time_spent_seconds": 120},
        headers=headers,
    )
    assert sub_res.status_code == 201

    # 4. Generate flashcards and complete a review
    fc_gen_res = client.post(
        f"/api/v1/courses/{course_id}/flashcards/generate",
        json={"num_cards": 3, "topic": "Gradient Descent"},
        headers=headers,
    )
    assert fc_gen_res.status_code == 201
    cards = fc_gen_res.json()
    assert len(cards) > 0

    # Review one card with high quality
    card_id = cards[0]["id"]
    rev_res = client.post(
        f"/api/v1/courses/{course_id}/flashcards/{card_id}/review",
        json={"quality": 5},
        headers=headers,
    )
    assert rev_res.status_code == 200

    # 5. Create a Socratic tutor session and send a message
    tut_res = client.post(
        f"/api/v1/courses/{course_id}/tutor/sessions",
        json={"title": "Analytics Exploration", "pedagogical_mode": "socratic"},
        headers=headers,
    )
    assert tut_res.status_code == 201
    session_id = tut_res.json()["id"]

    msg_res = client.post(
        f"/api/v1/courses/{course_id}/tutor/sessions/{session_id}/messages",
        json={"content": "Can you explain how loss curves indicate overfitting?"},
        headers=headers,
    )
    assert msg_res.status_code == 201

    # 6. Fetch Comprehensive Analytics Telemetry
    analytics_res = client.get(f"/api/v1/courses/{course_id}/analytics", headers=headers)
    assert analytics_res.status_code == 200
    report = analytics_res.json()

    # Verify Learner Velocity
    velocity = report["velocity"]
    assert velocity["assessment_attempts_count"] >= 1
    assert velocity["flashcard_reviews_count"] >= 1
    assert velocity["tutor_messages_count"] >= 1
    assert velocity["total_interactions"] >= 3
    assert velocity["total_study_time_minutes"] >= 2
    assert velocity["study_streak_days"] >= 1

    # Verify Bloom distribution
    bloom_list = report["bloom_telemetry"]
    assert len(bloom_list) == 6
    tested_levels = [b for b in bloom_list if b["total_questions"] > 0]
    assert len(tested_levels) >= 1

    # Verify Misconception distribution
    misconceptions = report["misconception_telemetry"]
    assert len(misconceptions) >= 1
    assert misconceptions[0]["count"] >= 1
    assert misconceptions[0]["percentage"] > 0
    assert len(misconceptions[0]["remediation_advice"]) > 0

    # Verify Spaced Repetition (SM-2) Retention Forecast
    forecast = report["retention_forecast"]
    assert forecast["active_cards"] >= 3
    assert forecast["average_ease_factor"] >= 1.3
    assert len(forecast["forecast_days"]) == 15
    for day in forecast["forecast_days"]:
        assert 0.0 <= day["projected_retention_pct"] <= 100.0

    # Verify Activity Timeline
    timeline = report["activity_timeline"]
    assert len(timeline) == 14
    today_point = timeline[-1]
    assert today_point["assessments_count"] >= 1 or today_point["reviews_count"] >= 1 or today_point["tutor_messages_count"] >= 1

    # Verify Curricular Concept Matrix
    matrix = report["concept_matrix"]
    assert isinstance(matrix, list)
    if matrix:
        assert "concept_label" in matrix[0]
        assert "p_know" in matrix[0]
        assert "status" in matrix[0]

    # Verify Executive Summary
    assert len(report["executive_summary"]) > 50

    # 7. Test Export Report (Markdown format)
    export_md_res = client.get(f"/api/v1/courses/{course_id}/analytics/export?format=markdown", headers=headers)
    assert export_md_res.status_code == 200
    assert "text/markdown" in export_md_res.headers["content-type"]
    assert "Learning Analytics & Progress Telemetry Report" in export_md_res.text
    assert "Cognitive Bloom's Taxonomy Performance" in export_md_res.text
    assert "Spaced Repetition (SM-2) Retention" in export_md_res.text

    # 8. Test Export Report (JSON format)
    export_json_res = client.get(f"/api/v1/courses/{course_id}/analytics/export?format=json", headers=headers)
    assert export_json_res.status_code == 200
    assert export_json_res.json()["course_id"] == course_id

    # 9. Verify Workspace Isolation
    other_email = f"other_user_{timestamp}@knovara.edu"
    other_reg = client.post(
        "/api/v1/auth/register",
        json={"email": other_email, "password": "StrongPassword2026!", "name": "Other User"},
    )
    other_token = other_reg.json()["access_token"]
    unauth_res = client.get(f"/api/v1/courses/{course_id}/analytics", headers={"Authorization": f"Bearer {other_token}"})
    assert unauth_res.status_code == 404
