"""Automated tests for User Authentication workflows."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

TEST_USER = {
    "name": "Alex Student",
    "email": "alex.student@example.com",
    "password": "SecurePassword123!",
    "education_level": "Undergraduate",
}


def test_register_user_success():
    """Verify new student registration."""
    # Ensure fresh state with unique email
    import uuid
    unique_email = f"student_{uuid.uuid4().hex[:8]}@example.com"
    payload = {**TEST_USER, "email": unique_email}

    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == unique_email
    assert data["user"]["name"] == TEST_USER["name"]
    assert "id" in data["user"]


def test_register_duplicate_email():
    """Verify registration with duplicate email rejects with 400."""
    import uuid
    unique_email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
    payload = {**TEST_USER, "email": unique_email}

    first_res = client.post("/api/v1/auth/register", json=payload)
    assert first_res.status_code == 201

    second_res = client.post("/api/v1/auth/register", json=payload)
    assert second_res.status_code == 400
    assert "already exists" in second_res.json()["detail"]


def test_login_success_and_me_endpoint():
    """Verify login returns valid token that unlocks /auth/me."""
    import uuid
    unique_email = f"login_test_{uuid.uuid4().hex[:8]}@example.com"
    reg_payload = {**TEST_USER, "email": unique_email}

    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    # Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": TEST_USER["password"]},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["access_token"]
    assert token is not None

    # Access protected /auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == unique_email
    assert me_data["name"] == TEST_USER["name"]


def test_login_invalid_password():
    """Verify invalid password returns 401."""
    import uuid
    unique_email = f"badpass_{uuid.uuid4().hex[:8]}@example.com"
    reg_payload = {**TEST_USER, "email": unique_email}
    client.post("/api/v1/auth/register", json=reg_payload)

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "WrongPassword!"},
    )
    assert login_res.status_code == 401
    assert "Invalid email or password" in login_res.json()["detail"]


def test_protected_route_unauthorized():
    """Verify access without token returns 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
