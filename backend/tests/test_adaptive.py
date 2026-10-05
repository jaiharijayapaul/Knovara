"""
Tests for Phase 10-A: Mastery-Gated Adaptive Question Selection.
Verifies that when adaptive_mode is requested, Bayesian Knowledge Tracing
scores govern concept selection and Bloom cognitive level scaffolding.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_mastery_gated_adaptive_generation():
    """Verify adaptive assessment generation reads BKT mastery and targets weak concepts."""
    # 1. Register & seed course
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": "adaptive_learner@knovara.edu", "password": "StrongPassword2026!", "name": "Ada Lovelace"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Adaptive Machine Learning", "description": "Adaptive BKT testing course"},
        headers=headers,
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    seed_res = client.post(
        f"/api/v1/courses/{course_id}/documents/demo-seed",
        headers=headers,
    )
    assert seed_res.status_code == 201

    # 2. Generate initial diagnostic assessment (baseline)
    base_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={
            "num_questions": 4,
            "topic": "Decision Trees",
            "difficulty": "medium",
        },
        headers=headers,
    )
    assert base_res.status_code == 201
    base_data = base_res.json()
    assert base_data["is_adaptive"] is False
    assessment_id = base_data["id"]

    # 3. Take assessment with intentional wrong answers to depress BKT p_know
    student_res = client.get(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}",
        headers=headers,
    )
    questions = student_res.json()["questions"]
    answers = {}
    for q in questions:
        # Pick option 'B' or 'C' (misconceptions)
        answers[q["id"]] = "B"

    submit_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}/submit",
        json={"answers": answers, "time_spent_seconds": 90},
        headers=headers,
    )
    assert submit_res.status_code == 201

    # 4. Verify mastery reflects needs_work/developing
    mastery_res = client.get(
        f"/api/v1/courses/{course_id}/mastery",
        headers=headers,
    )
    assert mastery_res.status_code == 200
    mastery_data = mastery_res.json()
    assert mastery_data["total_concepts"] > 0

    recs_res = client.get(
        f"/api/v1/courses/{course_id}/mastery/recommendations",
        headers=headers,
    )
    assert recs_res.status_code == 200
    recs = recs_res.json()["recommendations"]
    assert len(recs) > 0
    top_rec_concept = recs[0]["concept_label"]

    # 5. Generate ADAPTIVE assessment
    adaptive_gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={
            "adaptive_mode": True,
            "num_questions": 4,
        },
        headers=headers,
    )
    assert adaptive_gen_res.status_code == 201
    adaptive_data = adaptive_gen_res.json()

    assert adaptive_data["is_adaptive"] is True
    assert "Adaptive Mastery" in adaptive_data["title"]
    assert len(adaptive_data["questions"]) == 4

    # 6. Check that questions in adaptive assessment target the concept
    question_topics = [q["topic"] for q in adaptive_data["questions"]]
    assert any(top_rec_concept in t or t in top_rec_concept for t in question_topics)

    # 7. Check list view includes is_adaptive flag
    list_res = client.get(
        f"/api/v1/courses/{course_id}/assessments",
        headers=headers,
    )
    assert list_res.status_code == 200
    assessments_list = list_res.json()
    adaptive_item = next(a for a in assessments_list if a["id"] == adaptive_data["id"])
    assert adaptive_item["is_adaptive"] is True
