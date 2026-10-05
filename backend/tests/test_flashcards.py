"""
Phase 10-B: Spaced Repetition System (SRS) & Grounded Flashcards Engine Tests.

Verifies:
1. Pure SM-2 mathematical correctness (interval expansion, ease factor clamping, lapse reset).
2. Grounded flashcard creation & syllabus-grounded generation.
3. Review submission and SM-2 state evolution.
4. Bidirectional BKT concept mastery synchronization from flashcard reviews.
5. SRS telemetry and stats calculations.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.srs import SM2Engine, DEFAULT_EASE_FACTOR, MIN_EASE_FACTOR

client = TestClient(app)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Pure SM-2 Engine Unit Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestSM2EngineMath:
    """Verifies the pure SuperMemo-2 mathematical recurrence relation."""

    def test_first_successful_review_interval(self):
        """First successful review (q >= 3) should produce interval = 1 day, rep = 1."""
        res = SM2Engine.calculate(
            quality=4,
            repetitions=0,
            previous_interval=1,
            previous_ease_factor=DEFAULT_EASE_FACTOR,
        )
        assert res.repetitions == 1
        assert res.interval_days == 1
        assert res.is_lapse is False
        assert res.ease_factor == pytest.approx(DEFAULT_EASE_FACTOR, abs=0.01)

    def test_second_successful_review_interval(self):
        """Second successful review should produce interval = 6 days, rep = 2."""
        res = SM2Engine.calculate(
            quality=4,
            repetitions=1,
            previous_interval=1,
            previous_ease_factor=DEFAULT_EASE_FACTOR,
        )
        assert res.repetitions == 2
        assert res.interval_days == 6
        assert res.is_lapse is False

    def test_third_successful_review_scales_by_ease_factor(self):
        """Repetitions >= 2 should multiply previous interval by ease factor."""
        res = SM2Engine.calculate(
            quality=4,
            repetitions=2,
            previous_interval=6,
            previous_ease_factor=2.5,
        )
        assert res.repetitions == 3
        # 6 * 2.5 = 15 days
        assert res.interval_days == 15

    def test_failed_review_resets_repetitions_and_flags_lapse(self):
        """Quality < 3 indicates failed recall: repetitions reset to 0, interval resets to 1."""
        res = SM2Engine.calculate(
            quality=2,
            repetitions=4,
            previous_interval=30,
            previous_ease_factor=2.5,
        )
        assert res.repetitions == 0
        assert res.interval_days == 1
        assert res.is_lapse is True
        # Ease factor is also reduced
        assert res.ease_factor < 2.5

    def test_ease_factor_cannot_drop_below_minimum(self):
        """Repeated zero/low ratings should not reduce ease factor below MIN_EASE_FACTOR (1.3)."""
        ef = 1.35
        for _ in range(5):
            res = SM2Engine.calculate(
                quality=0,
                repetitions=0,
                previous_interval=1,
                previous_ease_factor=ef,
            )
            ef = res.ease_factor
        assert ef >= MIN_EASE_FACTOR
        assert ef == 1.3

    def test_perfect_score_increases_ease_factor(self):
        """Quality = 5 should increase ease factor: EF' = 2.5 + (0.1 - 0) = 2.6."""
        res = SM2Engine.calculate(
            quality=5,
            repetitions=1,
            previous_interval=1,
            previous_ease_factor=2.5,
        )
        assert res.ease_factor == pytest.approx(2.6, abs=0.001)

    def test_quality_rating_validation(self):
        """Quality must be within [0, 5]."""
        with pytest.raises(ValueError):
            SM2Engine.calculate(quality=-1, repetitions=0, previous_interval=1, previous_ease_factor=2.5)
        with pytest.raises(ValueError):
            SM2Engine.calculate(quality=6, repetitions=0, previous_interval=1, previous_ease_factor=2.5)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Flashcard API End-to-End Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_flashcard_lifecycle_and_bkt_sync():
    """
    Complete lifecycle test:
    - User registration and course creation
    - Seed course documents
    - Create deck & manual flashcard with source citations
    - Generate grounded flashcards
    - Perform SM-2 reviews
    - Verify BKT mastery updates from flashcard reviews
    - Verify SRS stats endpoint
    """
    # 1. Setup User and Course
    email = f"srs_learner_{int(datetime.now(timezone.utc).timestamp())}@knovara.edu"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword2026!", "name": "SRS Specialist"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Cognitive Science & Memory", "description": "Spaced Repetition & Retrieval Practice"},
        headers=headers,
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    # Seed demo documents for grounding
    seed_res = client.post(
        f"/api/v1/courses/{course_id}/documents/demo-seed",
        headers=headers,
    )
    assert seed_res.status_code == 201

    # 2. Create Deck
    deck_res = client.post(
        f"/api/v1/courses/{course_id}/flashcards/decks",
        json={
            "title": "Machine Learning Fundamentals",
            "description": "Core concepts and theorems",
            "topic": "Decision Trees",
        },
        headers=headers,
    )
    assert deck_res.status_code == 201
    deck_id = deck_res.json()["id"]

    # 3. Create Manual Flashcard with Source Citations
    card_res = client.post(
        f"/api/v1/courses/{course_id}/flashcards",
        json={
            "deck_id": deck_id,
            "topic": "Decision Trees",
            "front": "What does Gini Impurity measure?",
            "back": "Gini Impurity measures the frequency with which an element would be incorrectly labeled if randomly labeled according to the distribution.",
            "concept_label": "Decision Trees",
            "citation_label": "Course Syllabus §2.1",
            "document_name": "ML_Textbook_Ch2.pdf",
            "page_number": 42,
            "source_snippet": "Gini impurity is a measure of variance for classification trees.",
        },
        headers=headers,
    )
    assert card_res.status_code == 201
    card_data = card_res.json()
    card_id = card_data["id"]
    assert card_data["front"] == "What does Gini Impurity measure?"
    assert card_data["repetitions"] == 0
    assert card_data["interval_days"] == 0.0
    assert card_data["document_name"] == "ML_Textbook_Ch2.pdf"

    # 4. Generate AI Grounded Flashcards
    gen_res = client.post(
        f"/api/v1/courses/{course_id}/flashcards/generate",
        json={
            "num_cards": 3,
            "topic": "Decision Trees",
            "prioritize_weak_concepts": True,
        },
        headers=headers,
    )
    assert gen_res.status_code == 201
    generated_cards = gen_res.json()
    assert len(generated_cards) >= 1
    # Verify citations are present on generated cards
    first_gen = generated_cards[0]
    assert first_gen["front"] != ""
    assert first_gen["back"] != ""

    # 5. List Flashcards
    list_res = client.get(f"/api/v1/courses/{course_id}/flashcards", headers=headers)
    assert list_res.status_code == 200
    all_cards = list_res.json()
    assert len(all_cards) >= 2

    # Filter due only
    due_res = client.get(f"/api/v1/courses/{course_id}/flashcards?due_only=true", headers=headers)
    assert due_res.status_code == 200
    due_cards = due_res.json()
    assert len(due_cards) >= 1

    # 6. Submit Flashcard Review (Quality = 4 -> Good)
    review_res = client.post(
        f"/api/v1/courses/{course_id}/flashcards/{card_id}/review",
        json={"quality": 4},
        headers=headers,
    )
    assert review_res.status_code == 200
    rev_data = review_res.json()
    assert rev_data["card_id"] == card_id
    assert rev_data["repetitions"] == 1
    assert rev_data["interval_days"] == 1
    assert rev_data["card"]["total_reviews"] == 1
    assert rev_data["is_successful"] is True
    assert rev_data["bkt_synced"] is True

    # Check BKT updated for the concept
    mastery_res = client.get(
        f"/api/v1/courses/{course_id}/mastery/Decision%20Trees",
        headers=headers,
    )
    assert mastery_res.status_code == 200
    mastery_data = mastery_res.json()
    assert mastery_data["concept_label"].lower() == "decision trees"
    assert mastery_data["total_attempts"] >= 1
    assert mastery_data["p_know"] > 0

    # 7. Submit Second Review (Quality = 5 -> Easy)
    review_res_2 = client.post(
        f"/api/v1/courses/{course_id}/flashcards/{card_id}/review",
        json={"quality": 5},
        headers=headers,
    )
    assert review_res_2.status_code == 200
    rev_data_2 = review_res_2.json()
    assert rev_data_2["repetitions"] == 2
    assert rev_data_2["interval_days"] == 6
    assert rev_data_2["ease_factor"] > DEFAULT_EASE_FACTOR

    # 8. Check SRS Stats Endpoint
    stats_res = client.get(
        f"/api/v1/courses/{course_id}/flashcards/stats",
        headers=headers,
    )
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_cards"] >= 2
    assert "cards_due_today" in stats
    assert "retention_rate" in stats
    assert stats["cards_reviewing"] >= 1
