"""Unit tests for Knovara API root and health endpoints."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Verify that root endpoint returns 200 and valid metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Knovara" in data["message"]
    assert "version" in data
    assert data["health_check"] == "/health"


def test_health_endpoint():
    """Verify that health endpoint returns 200 and telemetry data."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Knovara"
    assert "status" in data
    assert "database" in data
    assert "dialect" in data["database"]
    assert "timestamp" in data
