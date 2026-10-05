"""Automated tests for Grounded RAG, Multimodal Source Citations, and Hallucination Guards."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_auth_course_and_materials(email: str, name: str = "RAG Student"):
    """Helper to register student, create course, seed canonical materials, and return headers + course_id."""
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

    # Create course
    course_res = client.post(
        "/api/v1/courses",
        json={"name": "Machine Learning Foundations", "subject": "CS"},
        headers=headers,
    )
    course_id = course_res.json()["id"]

    # Seed canonical demo materials
    client.post(f"/api/v1/courses/{course_id}/documents/demo-seed", headers=headers)

    return headers, course_id


def test_rag_query_pdf_page_citation():
    """Verify grounded retrieval finds the PDF and attributes the exact Page 42 citation."""
    headers, course_id = get_auth_course_and_materials("rag_pdf_user@knovara.edu", "PDF Student")

    query_payload = {
        "query": "How is Shannon Entropy calculated for training examples?",
        "top_k": 3,
    }
    res = client.post(f"/api/v1/courses/{course_id}/rag/query", json=query_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["grounded"] is True
    assert data["retrieved_count"] > 0
    assert len(data["citations"]) > 0

    # Top citation must be from the PDF textbook with Page 42
    top_cite = data["citations"][0]
    assert top_cite["document_name"] == "ML_Textbook_Chapter4_DecisionTrees.pdf"
    assert top_cite["page_number"] == 42
    assert "Page 42" in top_cite["citation_label"]
    assert "entropy" in top_cite["snippet"].lower()

    # Answer should contain inline citation tag
    assert "[Doc 1: Page 42]" in data["answer"]


def test_rag_query_pptx_slide_citation():
    """Verify grounded retrieval finds the PPTX slide deck with Slide 19/20 citation."""
    headers, course_id = get_auth_course_and_materials("rag_pptx_user@knovara.edu", "PPTX Student")

    query_payload = {
        "query": "What is Out of Bag evaluation in Random Forest?",
        "top_k": 3,
    }
    res = client.post(f"/api/v1/courses/{course_id}/rag/query", json=query_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["grounded"] is True

    # Find the citation referencing Random Forest slides
    rf_citations = [c for c in data["citations"] if c["slide_number"] is not None]
    assert len(rf_citations) > 0
    assert rf_citations[0]["document_name"] == "ML_Lecture05_Ensembles_RandomForest.pptx"
    assert rf_citations[0]["slide_number"] in [18, 19, 20]
    assert "Slide" in rf_citations[0]["citation_label"]


def test_rag_query_video_timestamp_citation():
    """Verify grounded retrieval finds the lecture video transcript with timestamp citation."""
    headers, course_id = get_auth_course_and_materials("rag_video_user@knovara.edu", "Video Student")

    query_payload = {
        "query": "What common misconception about entropy did the professor explain in lecture?",
        "top_k": 3,
    }
    res = client.post(f"/api/v1/courses/{course_id}/rag/query", json=query_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["grounded"] is True

    video_cites = [c for c in data["citations"] if c["file_type"] == "video"]
    assert len(video_cites) > 0
    assert video_cites[0]["timestamp_start"] == "18:20"
    assert video_cites[0]["timestamp_end"] == "20:05"
    assert "18:20" in video_cites[0]["citation_label"]


def test_rag_hallucination_guard():
    """Verify hallucination guard blocks out-of-domain queries and refuses to hallucinate."""
    headers, course_id = get_auth_course_and_materials("rag_guard_user@knovara.edu", "Guard Student")

    ungrounded_payload = {
        "query": "Explain Quantum Chromodynamics, gluon fields, and asymptotic freedom.",
        "top_k": 3,
    }
    res = client.post(f"/api/v1/courses/{course_id}/rag/query", json=ungrounded_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["grounded"] is False
    assert data["model_used"] == "knovara-hallucination-guard"
    assert "Knowledge Base Boundary Alert" in data["answer"]


def test_rag_indexing_lifecycle():
    """Verify triggering vector indexing computes and caches embeddings."""
    headers, course_id = get_auth_course_and_materials("rag_index_user@knovara.edu", "Index Student")

    # Check status
    status_res = client.get(f"/api/v1/courses/{course_id}/rag/status", headers=headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["total_chunks"] >= 8

    # Trigger indexing
    index_res = client.post(f"/api/v1/courses/{course_id}/rag/index", headers=headers)
    assert index_res.status_code == 200
    index_data = index_res.json()
    assert index_data["indexed_chunks"] == index_data["total_chunks"]
    assert index_data["embedding_dimension"] == 256


def test_rag_workspace_isolation():
    """Verify User B cannot query User A's RAG knowledge base."""
    headers_a, course_id_a = get_auth_course_and_materials("rag_iso_a@knovara.edu", "Student A")

    # Register Student B
    reg_b = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Student B",
            "email": "rag_iso_b@knovara.edu",
            "password": "Password123!",
            "education_level": "Undergraduate",
        },
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Student B queries Student A's course RAG -> 404 Not Found
    res = client.post(
        f"/api/v1/courses/{course_id_a}/rag/query",
        json={"query": "What is Entropy?"},
        headers=headers_b,
    )
    assert res.status_code == 404
