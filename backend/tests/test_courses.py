"""Automated tests for Course Management and Workspace Isolation."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_authenticated_headers(email: str, name: str = "Test Student"):
    """Register and login a student, returning authorization headers."""
    reg_payload = {
        "name": name,
        "email": email,
        "password": "Password123!",
        "education_level": "Undergraduate",
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    if res.status_code != 201:
        # If already exists, login
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
        )
        token = login_res.json()["access_token"]
    else:
        token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_and_list_courses():
    """Verify course creation and listing for authenticated user."""
    headers = get_authenticated_headers("course_user_1@knovara.edu", "Alice")

    create_payload = {
        "name": "Artificial Intelligence",
        "description": "Introduction to AI agents and search algorithms",
        "subject": "Computer Science",
    }
    create_res = client.post("/api/v1/courses", json=create_payload, headers=headers)
    assert create_res.status_code == 201
    course_data = create_res.json()
    assert course_data["name"] == create_payload["name"]
    assert course_data["subject"] == create_payload["subject"]
    course_id = course_data["id"]

    # List courses
    list_res = client.get("/api/v1/courses", headers=headers)
    assert list_res.status_code == 200
    courses = list_res.json()
    assert any(c["id"] == course_id for c in courses)


def test_course_workspace_isolation():
    """Verify strict isolation: User B cannot access or mutate User A's course."""
    headers_a = get_authenticated_headers("user_a@knovara.edu", "User A")
    headers_b = get_authenticated_headers("user_b@knovara.edu", "User B")

    # User A creates a course
    create_res = client.post(
        "/api/v1/courses",
        json={"name": "Confidential AI", "subject": "CS"},
        headers=headers_a,
    )
    assert create_res.status_code == 201
    course_id_a = create_res.json()["id"]

    # User B lists courses -> Should NOT see User A's course
    list_b = client.get("/api/v1/courses", headers=headers_b)
    assert list_b.status_code == 200
    assert not any(c["id"] == course_id_a for c in list_b.json())

    # User B attempts to access User A's course directly -> 404 Not Found
    get_b = client.get(f"/api/v1/courses/{course_id_a}", headers=headers_b)
    assert get_b.status_code == 404

    # User B attempts to delete User A's course -> 404 Not Found
    del_b = client.delete(f"/api/v1/courses/{course_id_a}", headers=headers_b)
    assert del_b.status_code == 404


def test_update_and_delete_course():
    """Verify course modification and deletion."""
    headers = get_authenticated_headers("course_updater@knovara.edu", "Bob")

    create_res = client.post(
        "/api/v1/courses",
        json={"name": "Intro to Python", "subject": "CS"},
        headers=headers,
    )
    course_id = create_res.json()["id"]

    # Update
    update_res = client.put(
        f"/api/v1/courses/{course_id}",
        json={"name": "Advanced Python & PyTorch"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Advanced Python & PyTorch"

    # Delete
    del_res = client.delete(f"/api/v1/courses/{course_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify no longer exists
    get_res = client.get(f"/api/v1/courses/{course_id}", headers=headers)
    assert get_res.status_code == 404


def test_seed_demo_course():
    """Verify demo course seeding with 6 foundational topics."""
    headers = get_authenticated_headers("demo_seeder@knovara.edu", "Demo Student")

    seed_res = client.post("/api/v1/courses/seed-demo", headers=headers)
    assert seed_res.status_code == 201
    data = seed_res.json()
    assert data["name"] == "Machine Learning"
    assert len(data["topics"]) == 6

    topic_names = [t["name"] for t in data["topics"]]
    expected_topics = [
        "Regression",
        "Classification",
        "Decision Trees",
        "Random Forest",
        "Support Vector Machines (SVM)",
        "Clustering",
    ]
    for topic in expected_topics:
        assert topic in topic_names
