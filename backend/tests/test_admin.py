"""Automated test suite for Admin Control Panel and Administrative Telemetry."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_admin_endpoints_require_admin_privileges():
    """Verify regular student accounts are rejected with 403 Forbidden."""
    # Register normal student
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Standard Student",
            "email": "regular_student_test@knovara.edu",
            "password": "Password123!",
            "education_level": "Undergraduate",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt admin calls
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 403
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
    assert client.get("/api/v1/admin/courses", headers=headers).status_code == 403
    assert client.get("/api/v1/admin/activity", headers=headers).status_code == 403


def test_admin_dashboard_telemetry_and_audit_activity():
    """Verify admin gets full KPI telemetry and audit stream with tutor sessions and materials."""
    # Register admin user
    admin_email = "admin@knovara.edu"
    admin_res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Platform Admin",
            "email": admin_email,
            "password": "Password123!",
            "education_level": "Postgraduate",
        },
    )
    if admin_res.status_code == 201:
        admin_token = admin_res.json()["access_token"]
    else:
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": "Password123!"},
        )
        admin_token = login_res.json()["access_token"]

    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create a course and materials and tutor session to populate all audit types
    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Admin Telemetry Demo Course", "subject": "Engineering"},
        headers=admin_headers,
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    # Seed demo materials
    seed_res = client.post(f"/api/v1/courses/{course_id}/documents/demo-seed", headers=admin_headers)
    assert seed_res.status_code == 201

    # Create tutor session
    tutor_res = client.post(
        f"/api/v1/courses/{course_id}/tutor/sessions",
        json={"title": "Audit Test Session", "pedagogical_mode": "socratic"},
        headers=admin_headers,
    )
    assert tutor_res.status_code == 201

    # 1. Fetch Stats
    stats_res = client.get("/api/v1/admin/stats", headers=admin_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_users"] >= 1
    assert stats["total_courses"] >= 1
    assert stats["total_documents"] >= 3
    assert stats["database_status"] in ("connected", "ready", "ok")

    # 2. Fetch Users
    users_res = client.get("/api/v1/admin/users", headers=admin_headers)
    assert users_res.status_code == 200
    users = users_res.json()
    assert len(users) >= 1

    # 3. Fetch Courses
    courses_res = client.get("/api/v1/admin/courses", headers=admin_headers)
    assert courses_res.status_code == 200
    courses = courses_res.json()
    assert len(courses) >= 1

    # 4. Fetch Audit Activity (Crucial test: verifies no s.mode AttributeError on tutor sessions!)
    activity_res = client.get("/api/v1/admin/activity", headers=admin_headers)
    assert activity_res.status_code == 200
    activities = activity_res.json()
    assert len(activities) >= 1
    # Check that tutor session event was properly formatted without error
    tutor_events = [a for a in activities if a["type"] == "tutor_session"]
    assert len(tutor_events) >= 1
    assert "Socratic" in tutor_events[0]["title"] or "Tutor" in tutor_events[0]["title"]
