"""Tests verifying Auto-Generated AI Study Notes and multiple file handling."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.models.course import Course, Topic
from app.models.document import Document, DocumentChunk
from app.services.notes_service import NotesService

client = TestClient(app)


def _get_db():
    """Helper to get database session respecting test overrides."""
    if get_db in app.dependency_overrides:
        return next(app.dependency_overrides[get_db]())
    return next(get_db())


def get_auth_headers(email: str = "notes_student@knovara.edu"):
    reg_payload = {
        "name": "Notes Student",
        "email": email,
        "password": "Password123!",
        "education_level": "Undergraduate",
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    if res.status_code != 201:
        login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        token = login_res.json()["access_token"]
    else:
        token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_notes_service_generates_structured_notes():
    """Verify NotesService creates 6-part structured AI study notes from document chunks."""
    db = _get_db()
    try:
        course = Course(name="Thermodynamics 101", subject="Physics", user_id="user-1")
        db.add(course)
        db.commit()

        doc = Document(
            course_id=course.id,
            filename="Physics_Chapter3_Thermodynamics.pdf",
            file_type="pdf",
            storage_url="uploads/test/thermo.pdf",
            file_size=4096,
            processing_status="COMPLETED",
        )
        db.add(doc)
        db.commit()

        chunk1 = DocumentChunk(
            document_id=doc.id,
            course_id=course.id,
            content="The First Law of Thermodynamics states that energy cannot be created or destroyed, only transformed from one form to another. Internal energy change equals heat added minus work done: dU = dQ - dW.",
            chunk_index=0,
            page_number=14,
            topic="First Law of Thermodynamics",
        )
        chunk2 = DocumentChunk(
            document_id=doc.id,
            course_id=course.id,
            content="The Second Law states that the entropy of an isolated system always increases over time. Heat flows spontaneously from hotter bodies to colder bodies.",
            chunk_index=1,
            page_number=18,
            topic="Entropy & Second Law",
        )
        db.add_all([chunk1, chunk2])
        db.commit()

        notes = NotesService._synthesize_local_notes(doc, [chunk1, chunk2], course.name)
        assert notes is not None
        assert len(notes) > 200
        assert "Physics Chapter3 Thermodynamics" in notes or "Physics_Chapter3_Thermodynamics.pdf" in notes
        assert "Core Concepts" in notes
        assert "Exam Takeaways" in notes
        assert "Quick Practice Check" in notes
        assert "Page 14" in notes
    finally:
        db.close()


def test_course_study_notes_api_endpoints():
    """Verify GET /api/v1/courses/{course_id}/study-notes and document notes endpoints."""
    headers = get_auth_headers("notes_test_user@knovara.edu")
    course_res = client.post("/api/v1/courses", json={"name": "Genetics Lab", "subject": "Biology"}, headers=headers)
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    db = _get_db()
    try:
        doc = Document(
            course_id=course_id,
            filename="Cell_Division_Notes.pdf",
            file_type="pdf",
            storage_url="uploads/test/cells.pdf",
            file_size=2048,
            processing_status="COMPLETED",
        )
        db.add(doc)
        db.commit()

        chunk = DocumentChunk(
            document_id=doc.id,
            course_id=course_id,
            content="Mitosis is the process of nuclear division where a eukaryotic cell separates chromosomes into two identical sets. The stages are prophase, metaphase, anaphase, and telophase.",
            chunk_index=0,
            page_number=5,
            topic="Mitosis",
        )
        db.add(chunk)
        db.commit()
        doc_id = doc.id
    finally:
        db.close()

    # 1. Test Document Notes Endpoint
    doc_notes_res = client.get(f"/api/v1/courses/{course_id}/documents/{doc_id}/notes", headers=headers)
    assert doc_notes_res.status_code == 200
    doc_data = doc_notes_res.json()
    assert doc_data["document_id"] == doc_id
    assert "AI Study Notes" in doc_data["ai_notes"]
    assert "Mitosis" in doc_data["ai_notes"]

    # 2. Test Course Study Notes Endpoint
    course_notes_res = client.get(f"/api/v1/courses/{course_id}/study-notes", headers=headers)
    assert course_notes_res.status_code == 200
    course_data = course_notes_res.json()
    assert course_data["course_id"] == course_id
    assert "study_notes" in course_data
    assert len(course_data["document_notes"]) >= 1
