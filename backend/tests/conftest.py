"""Pytest configuration and database fixtures for test isolation."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.utils.rate_limit import limiter

# In-memory SQLite engine for tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def disable_rate_limiter_for_tests():
    """Disable rate limiter for high-velocity test suite execution."""
    limiter.enabled = False
    yield
    limiter.enabled = True


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all tables before test session and drop afterwards."""
    # Register all models with Base
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def override_db_dependency():
    """Override get_db dependency in FastAPI app for all tests in session."""
    def _get_test_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()
