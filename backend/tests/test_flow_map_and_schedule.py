"""Tests for Course Flow Map (DAG) and Ebbinghaus Study Schedule."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_authenticated_headers(email: str, name: str = "Test Student"):
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
    return {"Authorization": f"Bearer {token}"}


def test_course_flow_map_and_schedule():
    headers = get_authenticated_headers("flow_user_1@knovara.edu", "Flow Student")
    # 1. Seed demo course
    res = client.post("/api/v1/courses/seed-demo", headers=headers)
    assert res.status_code == 201
    course_id = res.json()["id"]

    # 2. Query Flow Map
    res_flow = client.get(
        f"/api/v1/courses/{course_id}/flow-map",
        headers=headers,
    )
    assert res_flow.status_code == 200
    flow_data = res_flow.json()
    assert flow_data["course_id"] == course_id
    assert len(flow_data["nodes"]) >= 6
    assert len(flow_data["edges"]) >= 5
    # First node should be available
    assert flow_data["nodes"][0]["status"] in ["available", "in_progress", "mastered"]

    # 3. Query Study Schedule
    res_sched = client.get(
        f"/api/v1/courses/{course_id}/study-schedule?target_exam_date=2026-10-30",
        headers=headers,
    )
    assert res_sched.status_code == 200
    sched_data = res_sched.json()
    assert sched_data["course_id"] == course_id
    assert sched_data["days_until_exam"] >= 1
    assert len(sched_data["schedule"]) > 0
    # Check retention estimate adheres to Ebbinghaus bounds 0 < R <= 1.0
    for item in sched_data["schedule"]:
        assert 0.0 < item["retention_estimate"] <= 1.0
        assert item["urgency"] in ["high", "medium", "low"]
