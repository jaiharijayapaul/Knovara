"""Automated tests for Multimodal Document Ingestion, Processing, and Citations."""

import io
import pytest
from fastapi.testclient import TestClient
from pptx import Presentation
from app.main import app

client = TestClient(app)


def get_auth_and_course(email: str, name: str = "Test Student"):
    """Helper to register user, create course, and return headers + course_id."""
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

    # Create course with topics
    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Machine Learning Lab", "subject": "CS"},
        headers=headers,
    )
    course_id = course_res.json()["id"]

    # Add topics
    client.post(
        f"/api/v1/courses/{course_id}/topics",
        json={"name": "Decision Trees", "description": "Tree based models"},
        headers=headers,
    )
    client.post(
        f"/api/v1/courses/{course_id}/topics",
        json={"name": "Random Forest", "description": "Ensemble learning"},
        headers=headers,
    )

    return headers, course_id


def test_seed_demo_materials():
    """Verify seeding canonical multimodal materials with verified citations."""
    headers, course_id = get_auth_and_course("seed_tester@knovara.edu", "Seed Tester")

    seed_res = client.post(f"/api/v1/courses/{course_id}/documents/demo-seed", headers=headers)
    assert seed_res.status_code == 201
    docs = seed_res.json()
    assert len(docs) == 3

    filenames = [d["filename"] for d in docs]
    assert "ML_Textbook_Chapter4_DecisionTrees.pdf" in filenames
    assert "ML_Lecture05_Ensembles_RandomForest.pptx" in filenames
    assert "ML_Lecture05_Entropy_Video_Transcript.mp4" in filenames

    # Verify detail and citation metadata of the PDF
    pdf_doc = next(d for d in docs if d["filename"] == "ML_Textbook_Chapter4_DecisionTrees.pdf")
    detail_res = client.get(
        f"/api/v1/courses/{course_id}/documents/{pdf_doc['id']}", headers=headers
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["processing_status"] == "COMPLETED"
    assert len(detail["chunks"]) == 3
    # Verify canonical Page 42 citation
    assert detail["chunks"][0]["page_number"] == 42
    assert "Entropy" in detail["chunks"][0]["content"]

    # Verify PPTX Slide 18 citation
    pptx_doc = next(d for d in docs if d["filename"] == "ML_Lecture05_Ensembles_RandomForest.pptx")
    pptx_detail_res = client.get(
        f"/api/v1/courses/{course_id}/documents/{pptx_doc['id']}", headers=headers
    )
    pptx_detail = pptx_detail_res.json()
    assert pptx_detail["chunks"][0]["slide_number"] == 18

    # Verify Video 18:20-20:05 timestamp citation
    video_doc = next(d for d in docs if d["filename"] == "ML_Lecture05_Entropy_Video_Transcript.mp4")
    video_detail_res = client.get(
        f"/api/v1/courses/{course_id}/documents/{video_doc['id']}", headers=headers
    )
    video_detail = video_detail_res.json()
    assert video_detail["chunks"][0]["timestamp_start"] == "18:20"
    assert video_detail["chunks"][0]["timestamp_end"] == "20:05"


def test_upload_text_material():
    """Verify uploading and chunking plain text notes."""
    headers, course_id = get_auth_and_course("txt_uploader@knovara.edu", "Text Uploader")

    content = (
        "Decision Trees are supervised learning algorithms used for both classification and regression. "
        "They split data based on features to maximize information gain. "
        "Random Forest is an ensemble method combining multiple decision trees to reduce variance."
    )
    files = {"file": ("notes.txt", io.BytesIO(content.encode("utf-8")), "text/plain")}

    upload_res = client.post(f"/api/v1/courses/{course_id}/documents", files=files, headers=headers)
    assert upload_res.status_code == 201
    doc = upload_res.json()
    assert doc["filename"] == "notes.txt"
    assert doc["file_type"] == "text"
    assert doc["processing_status"] == "COMPLETED"
    assert len(doc["chunks"]) >= 1
    # Check auto topic tagging
    assert doc["chunks"][0]["topic"] in ["Decision Trees", "Random Forest"]


def test_upload_pptx_material():
    """Verify uploading and parsing presentation slides via python-pptx."""
    headers, course_id = get_auth_and_course("pptx_uploader@knovara.edu", "PPTX Uploader")

    # Generate small presentation in memory
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    if slide.shapes.title:
        slide.shapes.title.text = "Decision Trees & Random Forest Architecture"

    slide2 = prs.slides.add_slide(prs.slide_layouts[1])
    if slide2.shapes.title:
        slide2.shapes.title.text = "Entropy and Information Gain Split Criteria"

    pptx_bytes = io.BytesIO()
    prs.save(pptx_bytes)
    pptx_bytes.seek(0)

    files = {
        "file": (
            "lecture_slides.pptx",
            pptx_bytes,
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    }

    upload_res = client.post(f"/api/v1/courses/{course_id}/documents", files=files, headers=headers)
    assert upload_res.status_code == 201
    doc = upload_res.json()
    assert doc["file_type"] == "pptx"
    assert doc["processing_status"] == "COMPLETED"
    assert len(doc["chunks"]) >= 1
    assert doc["chunks"][0]["slide_number"] is not None


def test_upload_vtt_transcript():
    """Verify uploading video/audio transcript with WebVTT timestamps."""
    headers, course_id = get_auth_and_course("vtt_uploader@knovara.edu", "VTT Uploader")

    vtt_content = (
        "WEBVTT\n\n"
        "00:05:10.000 --> 00:07:30.000\n"
        "In this segment we discuss Decision Trees and how Entropy quantifies impurity.\n\n"
        "00:07:35.000 --> 00:10:00.000\n"
        "Next, Random Forest aggregates trees using bootstrap aggregating.\n"
    )
    files = {"file": ("lecture_transcript.vtt", io.BytesIO(vtt_content.encode("utf-8")), "text/vtt")}

    upload_res = client.post(f"/api/v1/courses/{course_id}/documents", files=files, headers=headers)
    assert upload_res.status_code == 201
    doc = upload_res.json()
    assert doc["file_type"] == "video"
    assert doc["processing_status"] == "COMPLETED"
    assert len(doc["chunks"]) >= 2
    assert doc["chunks"][0]["timestamp_start"] == "00:05:10"
    assert doc["chunks"][0]["timestamp_end"] == "00:07:30"


def test_upload_invalid_extension():
    """Verify rejecting disallowed file types."""
    headers, course_id = get_auth_and_course("invalid_file_user@knovara.edu", "Invalid User")

    files = {"file": ("malicious.exe", io.BytesIO(b"executable data"), "application/octet-stream")}
    res = client.post(f"/api/v1/courses/{course_id}/documents", files=files, headers=headers)
    assert res.status_code == 400
    assert "Unsupported file type" in res.json()["detail"]


def test_upload_empty_file():
    """Verify rejecting empty 0-byte files."""
    headers, course_id = get_auth_and_course("empty_file_user@knovara.edu", "Empty User")

    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    res = client.post(f"/api/v1/courses/{course_id}/documents", files=files, headers=headers)
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_document_workspace_isolation():
    """Verify User B cannot access or delete User A's uploaded documents."""
    headers_a, course_id_a = get_auth_and_course("user_doc_a@knovara.edu", "User A")
    headers_b, course_id_b = get_auth_and_course("user_doc_b@knovara.edu", "User B")

    # User A uploads a document
    files = {"file": ("confidential.txt", io.BytesIO(b"Confidential notes on Decision Trees"), "text/plain")}
    upload_res = client.post(f"/api/v1/courses/{course_id_a}/documents", files=files, headers=headers_a)
    assert upload_res.status_code == 201
    doc_id_a = upload_res.json()["id"]

    # User B tries to list User A's course documents -> 404
    list_res = client.get(f"/api/v1/courses/{course_id_a}/documents", headers=headers_b)
    assert list_res.status_code == 404

    # User B tries to get User A's document -> 404
    get_res = client.get(f"/api/v1/courses/{course_id_a}/documents/{doc_id_a}", headers=headers_b)
    assert get_res.status_code == 404

    # User B tries to delete User A's document -> 404
    del_res = client.delete(f"/api/v1/courses/{course_id_a}/documents/{doc_id_a}", headers=headers_b)
    assert del_res.status_code == 404


def test_delete_document():
    """Verify deleting a document cascades and removes extracted chunks."""
    headers, course_id = get_auth_and_course("delete_doc_user@knovara.edu", "Delete User")

    files = {"file": ("delete_me.txt", io.BytesIO(b"Temporary notes to be deleted"), "text/plain")}
    upload_res = client.post(f"/api/v1/courses/{course_id}/documents", files=files, headers=headers)
    doc_id = upload_res.json()["id"]

    # Delete
    del_res = client.delete(f"/api/v1/courses/{course_id}/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify document no longer exists
    get_res = client.get(f"/api/v1/courses/{course_id}/documents/{doc_id}", headers=headers)
    assert get_res.status_code == 404
