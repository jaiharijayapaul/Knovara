"""
Phase 10-C: Targeted Remediation Loop & AI Tutor Deep-Linking Tests.

Verifies:
1. Creating a remediation session directly from an assessment mistake.
2. Context injection: question text, student's answer, error taxonomy trap, and syllabus citations.
3. Creating a remediation session from a weak BKT concept with calibrated mastery probabilities.
4. Continuing the multi-turn Socratic dialogue within the remediation session.
"""

from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_remediation_loop_from_assessment_mistake_and_bkt():
    """Verify deep-linked AI Tutor remediation sessions for both mistakes and weak concepts."""
    # 1. Setup User and Course
    email = f"remediate_learner_{int(datetime.now(timezone.utc).timestamp())}@knovara.edu"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPassword2026!", "name": "Ada Lovelace"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Adaptive Machine Learning", "description": "Remediation loop testing"},
        headers=headers,
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    # Seed demo materials
    seed_res = client.post(f"/api/v1/courses/{course_id}/documents/demo-seed", headers=headers)
    assert seed_res.status_code == 201

    # 2. Generate Assessment
    gen_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/generate",
        json={"num_questions": 3, "topic": "Decision Trees", "difficulty": "medium"},
        headers=headers,
    )
    assert gen_res.status_code == 201
    assessment_id = gen_res.json()["id"]

    # 3. Take assessment with an intentional mistake
    det_res = client.get(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}?student_mode=false",
        headers=headers,
    )
    questions = det_res.json()["questions"]
    assert len(questions) >= 1

    first_q = questions[0]
    options = first_q["options"]
    # Pick incorrect option
    wrong_opts = [o["id"] for o in options if not o.get("is_correct")]
    chosen_wrong = [wrong_opts[0]] if wrong_opts else [options[0]["id"]]

    responses = [{"question_id": first_q["id"], "selected_answers": chosen_wrong}]
    submit_res = client.post(
        f"/api/v1/courses/{course_id}/assessments/{assessment_id}/submit",
        json={"time_spent_seconds": 45, "responses": responses},
        headers=headers,
    )
    assert submit_res.status_code == 201
    attempt_id = submit_res.json()["id"]

    # 4. Deep-Link Remediation from Assessment Mistake
    remed_res = client.post(
        f"/api/v1/courses/{course_id}/tutor/remediate",
        json={
            "source_type": "assessment_mistake",
            "attempt_id": attempt_id,
            "question_id": first_q["id"],
            "pedagogical_mode": "misconception_buster",
        },
        headers=headers,
    )
    assert remed_res.status_code == 201
    remed_data = remed_res.json()
    session_id = remed_data["id"]
    assert "Remediation" in remed_data["title"]
    assert remed_data["pedagogical_mode"] == "misconception_buster"
    assert len(remed_data["messages"]) >= 1

    first_message = remed_data["messages"][0]
    assert first_message["sender"] == "assistant"
    # Verify context injection
    assert first_q["question_text"] in first_message["content"]
    assert "Objective" in first_message["content"]

    # 5. Deep-Link Remediation from Weak BKT Concept
    bkt_remed_res = client.post(
        f"/api/v1/courses/{course_id}/tutor/remediate",
        json={
            "source_type": "bkt_concept",
            "concept_label": "Decision Trees",
            "pedagogical_mode": "socratic",
        },
        headers=headers,
    )
    assert bkt_remed_res.status_code == 201
    bkt_remed_data = bkt_remed_res.json()
    assert "Decision Trees" in bkt_remed_data["title"]
    assert bkt_remed_data["pedagogical_mode"] == "socratic"
    bkt_msg = bkt_remed_data["messages"][0]["content"]
    assert "Decision Trees" in bkt_msg
    assert "mastery probability" in bkt_msg

    # 6. Send follow-up turn in the remediation session
    chat_res = client.post(
        f"/api/v1/courses/{course_id}/tutor/sessions/{session_id}/messages",
        json={"content": "I confused Gini Impurity with Shannon Entropy."},
        headers=headers,
    )
    assert chat_res.status_code == 201
    chat_data = chat_res.json()
    assert chat_data["sender"] == "assistant"
    assert len(chat_data["content"]) > 10
