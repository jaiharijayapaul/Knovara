"""Tests for Security Hardening and Rate Limiting Invariants."""

import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import app

client = TestClient(app)


def test_production_jwt_secret_validation_rejects_default_secret():
    """Verify that in production mode, default development JWT secret fails validation."""
    settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET="knovara_hackathon_super_secret_jwt_key_2026",
    )
    with pytest.raises(ValueError, match="cannot use a default, placeholder, or empty secret"):
        settings.validate_production_security()


def test_production_jwt_secret_validation_rejects_short_secret():
    """Verify that in production mode, secrets shorter than 32 characters are rejected."""
    settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET="short_insecure_secret_123",
    )
    with pytest.raises(ValueError, match="at least 32 characters long"):
        settings.validate_production_security()


def test_production_jwt_secret_validation_accepts_strong_secret():
    """Verify that in production mode, strong 32+ character secrets pass validation."""
    settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET="prod_super_strong_cryptographic_key_9823471982734!",
    )
    # Should not raise exception
    settings.validate_production_security()


def test_development_allows_default_secret():
    """Verify that development mode allows default keys for frictionless local onboarding."""
    settings = Settings(
        ENVIRONMENT="development",
        JWT_SECRET="knovara_hackathon_super_secret_jwt_key_2026",
    )
    # Should not raise exception in dev
    settings.validate_production_security()


def test_rate_limiter_active_on_login():
    """Verify rate limiter is wired and functioning on auth endpoints."""
    from app.utils.rate_limit import limiter
    limiter.enabled = True
    try:
        hit_429 = False
        for _ in range(15):
            res = client.post(
                "/api/v1/auth/login",
                json={"email": "nonexistent@knovara.edu", "password": "WrongPassword!"},
            )
            if res.status_code == 429:
                hit_429 = True
                break
        assert hit_429 is True, "Rate limiter did not trigger 429 Too Many Requests"
    finally:
        limiter.enabled = False
