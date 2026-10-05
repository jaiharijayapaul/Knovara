"""Automated tests for Multi-Turn AI Tutor and 7 Pedagogical Modes."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_auth_course_and_materials(email: str, name: str = "Tutor Student"):
    """Register student, create course workspace, seed canonical materials, return headers + course_id."""
    reg_payload = {
        "name": name,
        "email": email,
        "password": "Password123!",
        "education_level": "Undergraduate",
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    if res.status_code != 201:
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
        )
        token = login_res.json()["access_token"]
    else:
        token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create course
    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Machine Learning Academy", "subject": "CS"},
        headers=headers,
    )
    course_id = course_res.json()["id"]

    # Seed canonical multimodal materials (PDF Ch4 p42, PPTX Lec5 s18, Video 18:20-20:05)
    client.post(f"/api/v1/courses/{course_id}/documents/demo-seed", headers=headers)

    return headers, course_id


def test_create_and_list_sessions():
    """Verify initializing a session with default greeting message and listing."""
    headers, course_id = get_auth_course_and_materials("tutor_user_1@knovara.edu", "Alice")

    create_payload = {
        "title": "Decision Trees Deep Exploration",
        "pedagogical_mode": "socratic",
        "topic": "Decision Trees",
    }
    res = client.post(f"/api/v1/courses/{course_id}/tutor/sessions", json=create_payload, headers=headers)
    assert res.status_code == 201
    session_data = res.json()
    assert session_data["pedagogical_mode"] == "socratic"
    assert session_data["topic"] == "Decision Trees"
    assert len(session_data["messages"]) == 1
    assert session_data["messages"][0]["sender"] == "assistant"
    assert "SOCRATIC" in session_data["messages"][0]["content"]

    session_id = session_data["id"]

    # List sessions
    list_res = client.get(f"/api/v1/courses/{course_id}/tutor/sessions", headers=headers)
    assert list_res.status_code == 200
    sessions = list_res.json()
    assert any(s["id"] == session_id for s in sessions)


def test_all_seven_pedagogical_modes():
    """Verify tutor generates distinct, appropriate teaching styles across all 7 modes."""
    headers, course_id = get_auth_course_and_materials("tutor_modes_user@knovara.edu", "Bob")

    modes_to_test = [
        ("socratic", "reason through the mechanics"),
        ("analogy", "analogy"),
        ("first_principles", "axiomatic"),
        ("misconception_buster", "Misconception"),
        ("exam_prep", "Exam"),
        ("deep_dive", "Deep Dive"),
        ("quick_review", "Quick Review"),
    ]

    for mode, expected_indicator in modes_to_test:
        # Create session in mode
        session_res = client.post(
            f"/api/v1/courses/{course_id}/tutor/sessions",
            json={"title": f"Test {mode}", "pedagogical_mode": mode},
            headers=headers,
        )
        assert session_res.status_code == 201
        session_id = session_res.json()["id"]

        # Send question
        msg_res = client.post(
            f"/api/v1/courses/{course_id}/tutor/sessions/{session_id}/messages",
            json={"content": "How is entropy calculated in decision trees?"},
            headers=headers,
        )
        assert msg_res.status_code == 201
        msg = msg_res.json()
        assert msg["sender"] == "assistant"
        assert msg["pedagogical_mode"] == mode
        assert expected_indicator.lower() in msg["content"].lower()
        assert len(msg["citations"]) > 0
        assert any(
            c["page_number"] is not None or c["timestamp_start"] is not None or c["slide_number"] is not None
            for c in msg["citations"]
        )


def test_switch_pedagogical_mode_mid_session():
    """Verify switching teaching mode mid-conversation dynamically alters tutor behavior."""
    headers, course_id = get_auth_course_and_materials("tutor_switch_user@knovara.edu", "Charlie")

    # Start in Socratic mode
    session_res = client.post(
        f"/api/v1/courses/{course_id}/tutor/sessions",
        json={"title": "Dynamic Switch Test", "pedagogical_mode": "socratic"},
        headers=headers,
    )
    session_id = session_res.json()["id"]

    # First turn in Socratic
    client.post(
        f"/api/v1/courses/{course_id}/tutor/sessions/{session_id}/messages",
        json={"content": "What is entropy?"},
        headers=headers,
    )

    # Switch mode to Analogy
    switch_res = client.patch(
        f"/api/v1/courses/{course_id}/tutor/sessions/{session_id}/mode",
        json={"pedagogical_mode": "analogy"},
        headers=headers,
    )
    assert switch_res.status_code == 200
    assert switch_res.json()["pedagogical_mode"] == "analogy"

    # Second turn should now adopt Analogy style
    msg_res = client.post(
        f"/api/v1/courses/{course_id}/tutor/sessions/{session_id}/messages",
        json={"content": "Can you explain it again?"},
        headers=headers,
    )
    assert msg_res.status_code == 201
    msg = msg_res.json()
    assert msg["pedagogical_mode"] == "analogy"
    assert "analogy" in msg["content"].lower() or "room" in msg["content"].lower() or "blue" in msg["content"].lower()


def test_tutor_workspace_isolation():
    """Verify student B cannot read or post messages into student A's tutoring session."""
    headers_a, course_id_a = get_auth_course_and_materials("tutor_iso_a@knovara.edu", "Student A")

    session_res = client.post(
        f"/api/v1/courses/{course_id_a}/tutor/sessions",
        json={"title": "Private Session A", "pedagogical_mode": "socratic"},
        headers=headers_a,
    )
    session_id_a = session_res.json()["id"]

    # Register Student B
    reg_b = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Student B",
            "email": "tutor_iso_b@knovara.edu",
            "password": "Password123!",
            "education_level": "Undergraduate",
        },
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Student B attempts to get Student A's session -> 404
    get_res = client.get(
        f"/api/v1/courses/{course_id_a}/tutor/sessions/{session_id_a}",
        headers=headers_b,
    )
    assert get_res.status_code == 404

    # Student B attempts to post message to Student A's session -> 404
    post_res = client.post(
        f"/api/v1/courses/{course_id_a}/tutor/sessions/{session_id_a}/messages",
        json={"content": "Hacking session"},
        headers=headers_b,
    )
    assert post_res.status_code == 404
