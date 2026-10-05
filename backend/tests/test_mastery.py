"""
Phase 9 — Bayesian Knowledge Tracing (BKT) & Learner Mastery Model Tests

Tests:
  1. BKT engine unit tests (pure math, no DB)
  2. Live API: mastery populated after assessment submission
  3. Live API: GET /mastery returns course-level summary
  4. Live API: GET /mastery/recommendations returns ranked adaptive recs
  5. Live API: GET /mastery/{concept_label} returns per-concept state
  6. Verify p_know updates across multiple attempts (mastery convergence)
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

BASE_URL = "/api/v1"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def auth_headers(client):
    email = f"bkt_learner_{uuid.uuid4().hex[:6]}@knovara.edu"
    reg = client.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": "StrongPassword2026!",
        "name": "Sarah Connor",
    })
    assert reg.status_code == 201, f"Register failed: {reg.text}"
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def course_id(client, auth_headers):
    c_res = client.post(f"{BASE_URL}/courses", json={
        "name": "Adaptive Machine Learning BKT",
        "description": "BKT testing course",
        "subject": "AI",
    }, headers=auth_headers)
    if c_res.status_code == 201:
        c_id = c_res.json()["id"]
    else:
        courses = client.get(f"{BASE_URL}/courses", headers=auth_headers).json()
        c_id = courses[0]["id"]

    # Seed demo documents
    client.post(f"{BASE_URL}/courses/{c_id}/documents/demo-seed", headers=auth_headers)
    return c_id


@pytest.fixture(scope="module")
def assessment_id(client, auth_headers, course_id):
    gen = client.post(
        f"{BASE_URL}/courses/{course_id}/assessments/generate",
        json={"num_questions": 3, "topic": "Decision Trees", "difficulty": "medium"},
        headers=auth_headers,
    )
    if gen.status_code == 201:
        return gen.json()["id"]
    assessments = client.get(
        f"{BASE_URL}/courses/{course_id}/assessments", headers=auth_headers
    ).json()
    return assessments[0]["id"]


@pytest.fixture(scope="module")
def submitted_attempt(client, auth_headers, course_id, assessment_id):
    """Submit a test attempt (answers: Q0 correct, rest incorrect)."""
    det = client.get(
        f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}?student_mode=false",
        headers=auth_headers,
    ).json()
    questions = det["questions"]

    responses = []
    for idx, q in enumerate(questions):
        opts = q["options"]
        if idx == 0:
            corr = [o["id"] for o in opts if o.get("is_correct")]
            chosen = corr if corr else [opts[0]["id"]]
        else:
            wrong = [o["id"] for o in opts if not o.get("is_correct")]
            chosen = [wrong[0]] if wrong else [opts[0]["id"]]
        responses.append({"question_id": q["id"], "selected_answers": chosen})

    res = client.post(
        f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/submit",
        headers=auth_headers,
        json={"time_spent_seconds": 90, "responses": responses},
    )
    assert res.status_code == 201, f"Submit failed: {res.text}"
    return res.json()


# ─────────────────────────────────────────────────────────────────────────────
# Unit Tests — BKT Engine (no DB, pure math)
# ─────────────────────────────────────────────────────────────────────────────

class TestBKTEngine:
    """Unit tests for the BKT HMM update equations."""

    def test_import_bkt(self):
        from app.bkt import BKTEngine, BKTParams
        assert BKTEngine is not None
        assert BKTParams is not None

    def test_correct_observation_increases_p_know(self):
        from app.bkt import BKTEngine, BKTParams
        params = BKTParams(p_know=0.30, p_learn=0.25, p_guess=0.15, p_slip=0.10)
        result = BKTEngine.update(p_know=0.30, is_correct=True, params=params)
        assert result.p_know_next > 0.30, "Correct answer must increase p_know"
        assert 0.0 <= result.p_know_next <= 1.0

    def test_incorrect_observation_decreases_p_know(self):
        from app.bkt import BKTEngine, BKTParams
        params = BKTParams(p_know=0.70, p_learn=0.25, p_guess=0.15, p_slip=0.10)
        result = BKTEngine.update(p_know=0.70, is_correct=False, params=params)
        # Posterior drops after slip, but learning opportunity partially offsets
        # The posterior (before learning) must be lower:
        assert result.p_know_posterior < 0.70

    def test_mastery_declared_at_threshold(self):
        from app.bkt import BKTEngine, BKTParams
        params = BKTParams(p_know=0.98, p_learn=0.25, p_guess=0.15, p_slip=0.10, mastery_threshold=0.95)
        result = BKTEngine.update(p_know=0.98, is_correct=True, params=params)
        assert result.is_mastered is True

    def test_not_mastered_below_threshold(self):
        from app.bkt import BKTEngine, BKTParams
        params = BKTParams(p_know=0.50, p_learn=0.20, p_guess=0.15, p_slip=0.10, mastery_threshold=0.95)
        result = BKTEngine.update(p_know=0.50, is_correct=True, params=params)
        assert result.is_mastered is False

    def test_sequence_convergence(self):
        """Repeated correct answers should monotonically increase p_know."""
        from app.bkt import BKTEngine, BKTParams
        params = BKTParams()
        p, results = BKTEngine.update_sequence(0.30, [True] * 10, params)
        # Each step's p_know_next should be >= prior
        for i in range(1, len(results)):
            assert results[i].p_know_next >= results[i-1].p_know_next - 0.001
        assert p > 0.30

    def test_predict_performance(self):
        from app.bkt import BKTEngine, BKTParams
        params = BKTParams(p_know=0.80, p_guess=0.15, p_slip=0.10)
        prob = BKTEngine.predict_performance(0.80, params)
        expected = 0.80 * (1 - 0.10) + (1 - 0.80) * 0.15
        assert abs(prob - expected) < 1e-6

    def test_questions_to_mastery_estimate(self):
        from app.bkt import BKTEngine, BKTParams
        params = BKTParams(p_know=0.30, p_learn=0.30, p_guess=0.15, p_slip=0.10, mastery_threshold=0.95)
        n = BKTEngine.questions_to_mastery(0.30, params)
        assert n > 0, "Should require at least 1 correct answer"
        assert n < 50, "Should converge within 50 steps"

    def test_boundary_conditions(self):
        """p_know = 0.0 and p_know = 1.0 should not crash or go out of bounds."""
        from app.bkt import BKTEngine, BKTParams
        params = BKTParams()
        r1 = BKTEngine.update(p_know=0.0, is_correct=True, params=params)
        r2 = BKTEngine.update(p_know=1.0, is_correct=False, params=params)
        assert 0.0 <= r1.p_know_next <= 1.0
        assert 0.0 <= r2.p_know_next <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# Integration Tests — Live API
# ─────────────────────────────────────────────────────────────────────────────

class TestMasteryAPI:
    """Live API integration tests for Phase 9 mastery endpoints."""

    def test_mastery_auto_updated_after_submission(self, submitted_attempt, client, auth_headers, course_id):
        """After a scored attempt, mastery records must exist in DB."""
        res = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery",
            headers=auth_headers,
        )
        assert res.status_code == 200, f"Mastery endpoint failed: {res.text}"
        data = res.json()
        assert data["total_concepts"] >= 1, "At least 1 concept should be tracked"
        assert isinstance(data["concepts"], list)

    def test_course_mastery_structure(self, submitted_attempt, client, auth_headers, course_id):
        """CourseMasteryResponse should have expected fields."""
        res = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery",
            headers=auth_headers,
        )
        data = res.json()
        assert "total_concepts" in data
        assert "mastered_concepts" in data
        assert "overall_mastery_percentage" in data
        assert "concepts" in data
        assert isinstance(data["overall_mastery_percentage"], (int, float))

    def test_concept_mastery_fields(self, submitted_attempt, client, auth_headers, course_id):
        """Each concept should have all expected BKT fields."""
        res = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery",
            headers=auth_headers,
        )
        concepts = res.json()["concepts"]
        assert len(concepts) > 0

        c = concepts[0]
        required_fields = [
            "concept_label", "p_know", "p_learn", "p_guess", "p_slip",
            "mastery_threshold", "total_attempts", "correct_attempts",
            "is_mastered", "priority_score", "p_know_history",
            "mastery_percentage", "accuracy_rate", "mastery_status",
        ]
        for field in required_fields:
            assert field in c, f"Missing field: {field}"

        # BKT state sanity checks
        assert 0.0 <= c["p_know"] <= 1.0
        assert 0.0 <= c["p_learn"] <= 1.0
        assert 0.0 <= c["p_guess"] <= 1.0
        assert 0.0 <= c["p_slip"] <= 1.0
        assert c["total_attempts"] > 0
        assert c["mastery_status"] in ["mastered", "developing", "needs_work", "not_started"]

    def test_p_know_history_populated(self, submitted_attempt, client, auth_headers, course_id):
        """p_know_history sparkline should have at least 1 entry."""
        res = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery",
            headers=auth_headers,
        )
        concepts = res.json()["concepts"]
        for c in concepts:
            assert isinstance(c["p_know_history"], list)
            assert len(c["p_know_history"]) >= 1, f"Concept '{c['concept_label']}' has empty history"

    def test_adaptive_recommendations(self, submitted_attempt, client, auth_headers, course_id):
        """Recommendations endpoint should return sorted, valid recommendations."""
        res = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery/recommendations",
            headers=auth_headers,
        )
        assert res.status_code == 200, f"Recommendations failed: {res.text}"
        data = res.json()

        assert "recommendations" in data
        assert "overall_mastery_percentage" in data
        assert isinstance(data["recommendations"], list)

    def test_recommendation_fields(self, submitted_attempt, client, auth_headers, course_id):
        """Each recommendation should have bloom scaffolding and rationale."""
        res = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery/recommendations?top_n=3",
            headers=auth_headers,
        )
        data = res.json()
        recs = data["recommendations"]

        for rec in recs:
            assert "concept_label" in rec
            assert "p_know" in rec
            assert "mastery_status" in rec
            assert "reason" in rec
            assert "recommended_bloom_levels" in rec
            assert "estimated_questions_to_mastery" in rec
            assert isinstance(rec["recommended_bloom_levels"], list)
            assert len(rec["recommended_bloom_levels"]) > 0
            assert 0.0 <= rec["p_know"] <= 1.0

    def test_concept_mastery_not_found(self, client, auth_headers, course_id):
        """Unknown concept label should return 404."""
        res = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery/non-existent-concept-xyz",
            headers=auth_headers,
        )
        assert res.status_code == 404

    def test_mastery_priority_ordering(self, submitted_attempt, client, auth_headers, course_id):
        """Concepts should be ordered by descending priority_score (weakest first)."""
        res = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery",
            headers=auth_headers,
        )
        concepts = res.json()["concepts"]
        if len(concepts) >= 2:
            scores = [c["priority_score"] for c in concepts]
            assert scores == sorted(scores, reverse=True), "Concepts not ordered by priority"

    def test_mastery_updated_incrementally(self, client, auth_headers, course_id, assessment_id):
        """Multiple submissions should update p_know (convergence check)."""
        # Get p_know before additional submission
        res_before = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery",
            headers=auth_headers,
        )
        before_concepts = {c["concept_label"]: c["p_know"] for c in res_before.json()["concepts"]}

        # Submit attempt: if already at ceiling (1.0), submit incorrect to test downward update;
        # otherwise submit all-correct to test upward convergence.
        is_at_ceiling = any(v >= 0.99 for v in before_concepts.values())
        det = client.get(
            f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}?student_mode=false",
            headers=auth_headers,
        ).json()
        questions = det["questions"]
        responses = []
        for q in questions:
            if is_at_ceiling:
                wrong = [o["id"] for o in q["options"] if not o.get("is_correct")]
                chosen = [wrong[0]] if wrong else [q["options"][0]["id"]]
            else:
                corr = [o["id"] for o in q["options"] if o.get("is_correct")]
                chosen = corr if corr else [q["options"][0]["id"]]
            responses.append({"question_id": q["id"], "selected_answers": chosen})

        client.post(
            f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/submit",
            headers=auth_headers,
            json={"time_spent_seconds": 60, "responses": responses},
        )

        res_after = client.get(
            f"{BASE_URL}/courses/{course_id}/mastery",
            headers=auth_headers,
        )
        after_concepts = {c["concept_label"]: c["p_know"] for c in res_after.json()["concepts"]}

        # At least one concept's p_know should have changed
        changed = any(
            abs(after_concepts.get(k, 0) - v) > 0.001
            for k, v in before_concepts.items()
        )
        assert changed, "No concept mastery changed after attempt"
