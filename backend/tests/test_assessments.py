"""
Tests for Phase 7: Adaptive Assessment Engine & Bloom's Taxonomy Question Generator.
Verifies cognitive level progression, grounded multimodal citations, diagnostic distractors,
and workspace isolation.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_auth_course_and_materials(email: str, name: str):
    """Helper to register user, create course, seed materials, and return auth header."""
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword2026!", "name": name},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Decision Trees & Ensemble Learning", "description": "Curriculum for ML testing."},
        headers=headers,
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    seed_res = client.post(
        f"/api/v1/courses/{course_id}/documents/demo-seed",
        headers=headers,
    )
    assert seed_res.status_code == 201

    return headers, course_id


def test_generate_assessment_bloom_progression():
    """Verify assessment generation distributes questions across Bloom's Taxonomy with grounded citations."""
    headers, course_id = get_auth_course_and_materials("bloom_tester@knovara.edu", "Alice Bloom")

    # Generate 6 questions targeting all Bloom levels
    gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={
            "title": "Machine Learning Bloom Cognitive Diagnostic",
            "topic": "Decision Trees",
            "num_questions": 6,
            "difficulty": "medium",
            "bloom_levels": ["remember", "understand", "apply", "analyze", "evaluate", "create"],
        },
        headers=headers,
    )
    assert gen_res.status_code == 201
    data = gen_res.json()

    assert data["title"] == "Machine Learning Bloom Cognitive Diagnostic"
    assert data["topic"] == "Decision Trees"
    assert data["difficulty"] == "medium"
    assert data["questions_count"] == 6
    assert len(data["questions"]) == 6

    bloom_levels_observed = set()
    for q in data["questions"]:
        bloom_levels_observed.add(q["bloom_level"])
        assert len(q["options"]) == 4
        # Exactly one correct answer
        correct_opts = [opt for opt in q["options"] if opt["is_correct"]]
        assert len(correct_opts) == 1
        assert correct_opts[0]["id"] in q["correct_answers"]

        # Distractors must have diagnostic misconception explanations
        distractors = [opt for opt in q["options"] if not opt["is_correct"]]
        assert len(distractors) == 3
        for dist in distractors:
            assert dist["misconception"] is not None and len(dist["misconception"]) > 10

        # Grounding citation coordinates must exist
        assert q["citation_label"] is not None
        assert q["document_name"] is not None
        assert (
            q["page_number"] is not None
            or q["slide_number"] is not None
            or q["timestamp_start"] is not None
        )
        assert len(q["explanation"]) > 20

    # Ensure all 6 Bloom levels are present
    expected_levels = {"remember", "understand", "apply", "analyze", "evaluate", "create"}
    assert bloom_levels_observed == expected_levels


def test_get_assessment_student_mode():
    """Verify student mode redacts correct answers and diagnostic misconceptions."""
    headers, course_id = get_auth_course_and_materials("student_mode_tester@knovara.edu", "Bob Student")

    gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={"num_questions": 3, "difficulty": "hard"},
        headers=headers,
    )
    assert gen_res.status_code == 201
    assessment_id = gen_res.json()["id"]

    # Fetch in student mode
    student_res = client.get(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}?student_mode=true",
        headers=headers,
    )
    assert student_res.status_code == 200
    student_data = student_res.json()
    assert len(student_data["questions"]) == 3

    for q in student_data["questions"]:
        # Answer key fields must NOT be exposed in student view
        assert "correct_answers" not in q
        assert "explanation" not in q
        for opt in q["options"]:
            assert "is_correct" not in opt
            assert "misconception" not in opt
            assert "id" in opt
            assert "text" in opt


def test_list_and_delete_assessment():
    """Verify listing assessments and cascading deletion."""
    headers, course_id = get_auth_course_and_materials("list_del_tester@knovara.edu", "Charlie Del")

    # Generate assessment
    gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={"num_questions": 4, "difficulty": "easy"},
        headers=headers,
    )
    assert gen_res.status_code == 201
    assessment_id = gen_res.json()["id"]

    # List assessments
    list_res = client.get(f"/api/v1/courses/{course_id}/assessments", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["id"] == assessment_id
    assert items[0]["questions_count"] == 4

    # Delete assessment
    del_res = client.delete(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}",
        headers=headers,
    )
    assert del_res.status_code == 204

    # Verify empty
    list_res_after = client.get(f"/api/v1/courses/{course_id}/assessments", headers=headers)
    assert list_res_after.status_code == 200
    assert len(list_res_after.json()) == 0


def test_assessment_workspace_isolation():
    """Verify cross-tenant workspace isolation for assessments."""
    headers1, course1_id = get_auth_course_and_materials("user1_iso@knovara.edu", "User One")
    headers2, _ = get_auth_course_and_materials("user2_iso@knovara.edu", "User Two")

    # User 1 generates assessment
    gen_res = client.post(
        f"/api/v1/courses/{course1_id}/assessments/generate",
        json={"num_questions": 2},
        headers=headers1,
    )
    assert gen_res.status_code == 201
    assessment_id = gen_res.json()["id"]

    # User 2 tries to access User 1's assessment -> 403 Forbidden
    unauth_get = client.get(
        f"/api/v1/courses/{course1_id}/assessments/{assessment_id}",
        headers=headers2,
    )
    assert unauth_get.status_code == 403

    # User 2 tries to delete User 1's assessment -> 403 Forbidden
    unauth_del = client.delete(
        f"/api/v1/courses/{course1_id}/assessments/{assessment_id}",
        headers=headers2,
    )
    assert unauth_del.status_code == 403


def test_submit_assessment_perfect_score():
    """Verify submitting perfect answers achieves 100%, passed=True, and zero error classifications."""
    headers, course_id = get_auth_course_and_materials("perfect_scorer@knovara.edu", "Perfect Scorer")

    gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={"num_questions": 3, "difficulty": "medium"},
        headers=headers,
    )
    assert gen_res.status_code == 201
    assessment = gen_res.json()
    assessment_id = assessment["id"]

    # Select all correct answers
    answers = {}
    for q in assessment["questions"]:
        answers[q["id"]] = q["correct_answers"]

    submit_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}/submit",
        json={"answers": answers, "time_spent_seconds": 65},
        headers=headers,
    )
    assert submit_res.status_code == 201
    result = submit_res.json()

    assert result["score"] == result["total_points"]
    assert result["percentage"] == 100.0
    assert result["passed"] is True
    assert result["time_spent_seconds"] == 65
    assert len(result["question_results"]) == 3

    for qr in result["question_results"]:
        assert qr["is_correct"] is True
        assert qr["error_category"] == "none"
        assert qr["points_earned"] == qr["points_possible"]
        assert "✓ Correct" in qr["remediation_hint"]


def test_submit_assessment_error_taxonomy_classification():
    """Verify diagnostic error taxonomy accurately classifies failure modes and generates hints."""
    headers, course_id = get_auth_course_and_materials("taxonomy_tester@knovara.edu", "Taxonomy Tester")

    gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={
            "num_questions": 2,
            "bloom_levels": ["remember", "understand"],
            "difficulty": "medium",
        },
        headers=headers,
    )
    assert gen_res.status_code == 201
    assessment = gen_res.json()
    assessment_id = assessment["id"]

    # For Q1 (remember): pick option B which represents a procedural slip (sign error)
    # For Q2 (understand): pick option C which represents dimensionality confusion
    q1 = assessment["questions"][0]
    q2 = assessment["questions"][1]

    answers = {
        q1["id"]: "B",  # Sign error
        q2["id"]: "C",  # Dimensionality confusion
    }

    submit_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}/submit",
        json={"answers": answers, "time_spent_seconds": 120},
        headers=headers,
    )
    assert submit_res.status_code == 201
    result = submit_res.json()

    assert result["score"] == 0.0
    assert result["percentage"] == 0.0
    assert result["passed"] is False

    # Verify error summary breakdown
    error_summary = result["error_summary"]
    assert error_summary.get("procedural_slip", 0) >= 1
    assert error_summary.get("dimensionality_confusion", 0) >= 1

    # Verify diagnostic hints
    qr1 = next(q for q in result["question_results"] if q["question_id"] == q1["id"])
    assert qr1["is_correct"] is False
    assert qr1["error_category"] == "procedural_slip"
    assert "Procedural Slip" in qr1["remediation_hint"]

    qr2 = next(q for q in result["question_results"] if q["question_id"] == q2["id"])
    assert qr2["is_correct"] is False
    assert qr2["error_category"] == "dimensionality_confusion"
    assert "Dimensionality" in qr2["remediation_hint"]


def test_list_and_get_attempt_history():
    """Verify retrieving student attempt history and full diagnostic attempt report."""
    headers, course_id = get_auth_course_and_materials("history_tester@knovara.edu", "History Tester")

    gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={"num_questions": 2},
        headers=headers,
    )
    assert gen_res.status_code == 201
    assessment_id = gen_res.json()["id"]

    # Submit attempt
    submit_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}/submit",
        json={"answers": {}, "time_spent_seconds": 40},
        headers=headers,
    )
    assert submit_res.status_code == 201
    attempt_id = submit_res.json()["id"]

    # List attempts
    list_res = client.get(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}/attempts",
        headers=headers,
    )
    assert list_res.status_code == 200
    attempts = list_res.json()
    assert len(attempts) == 1
    assert attempts[0]["id"] == attempt_id

    # Get attempt detail
    get_res = client.get(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}/attempts/{attempt_id}",
        headers=headers,
    )
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["id"] == attempt_id
    assert len(detail["question_results"]) == 2

