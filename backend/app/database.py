"""Database connection engine and session management."""

import os
import logging
from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

logger = logging.getLogger(__name__)

# Configure engine arguments and normalize database URL
connect_args = {}
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
elif db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    if ":memory:" not in db_url:
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        normalized_path = os.path.join(root_dir, "knovara.db").replace("\\", "/")
        db_url = f"sqlite:///{normalized_path}"

# Create database engine
try:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
except Exception as e:
    logger.error(f"Failed to initialize engine with {db_url}: {e}")
    engine = create_engine("sqlite:///:memory:", echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator:
    """Yield a database session dependency for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> Dict[str, Any]:
    """
    Safely ping the database and return health telemetry.
    Does not crash the application if the database is temporarily unreachable.
    """
    dialect = engine.url.drivername
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "connected",
            "dialect": dialect,
            "host": engine.url.host or "local",
            "database": engine.url.database or "memory",
        }
    except Exception as exc:
        logger.warning(f"Database health check failed: {exc}")
        return {
            "status": "disconnected",
            "dialect": dialect,
            "error": str(exc),
        }


def init_db() -> None:
    """Create all database tables on application startup and ensure column migrations."""
    try:
        # Enable pgvector extension if on PostgreSQL
        if engine.url.drivername.startswith("postgresql"):
            with engine.connect() as conn:
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                    conn.commit()
                except Exception as ext_err:
                    logger.warning(f"Could not create vector extension (may already exist or insufficient privileges): {ext_err}")

        # Import models to ensure they register with Base metadata
        import app.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        
        # Safe migration for new columns
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE assessments ADD COLUMN is_adaptive BOOLEAN DEFAULT 0"))
                conn.commit()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE documents ADD COLUMN ai_notes TEXT"))
                conn.commit()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE courses ADD COLUMN study_notes TEXT"))
                conn.commit()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding TEXT"))
                conn.commit()
            except Exception:
                pass
                
        logger.info("Database tables initialized/verified successfully.")
    except Exception as exc:
        logger.warning(f"Database table initialization warning: {exc}")
