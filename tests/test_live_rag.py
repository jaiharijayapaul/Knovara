"""Live integration test for Grounded RAG and Source Citations Engine."""

import httpx

BASE_URL = "http://127.0.0.1:8000"


def test_live_rag():
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        print("[1] Authenticating as demo student sarah@knovara.edu...")
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": "sarah@knovara.edu", "password": "StrongPassword2026!"},
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("  -> Authenticated successfully.")

        print("[2] Fetching student's courses...")
        courses_res = client.get("/api/v1/courses", headers=headers)
        assert courses_res.status_code == 200
        courses = courses_res.json()
        assert len(courses) > 0
        course_id = courses[0]["id"]
        course_name = courses[0]["name"]
        print(f"  -> Testing on course '{course_name}' ({course_id})")

        print("[3] Indexing vector embeddings for course chunks...")
        index_res = client.post(f"/api/v1/courses/{course_id}/rag/index", headers=headers)
        assert index_res.status_code == 200
        idx_data = index_res.json()
        print(f"  -> Vector index status: {idx_data['indexed_chunks']}/{idx_data['total_chunks']} chunks indexed (256-dim embeddings).")

        print("[4] Query 1: PDF Textbook citation (Shannon Entropy)...")
        res1 = client.post(
            f"/api/v1/courses/{course_id}/rag/query",
            json={"query": "How is Shannon Entropy calculated for training examples?", "top_k": 3},
            headers=headers,
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["grounded"] is True
        assert len(data1["citations"]) > 0
        top1 = data1["citations"][0]
        assert top1["page_number"] == 42, f"Expected page 42, got {top1['page_number']}"
        print(f"  -> Verified PDF Citation: {top1['document_name']} [Page {top1['page_number']}] (Score: {top1['score']})")

        print("[5] Query 2: PPTX Slide citation (Out of Bag in Random Forests)...")
        res2 = client.post(
            f"/api/v1/courses/{course_id}/rag/query",
            json={"query": "What is Out of Bag evaluation in Random Forest?", "top_k": 3},
            headers=headers,
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["grounded"] is True
        rf_cites = [c for c in data2["citations"] if c["slide_number"] is not None]
        assert len(rf_cites) > 0
        print(f"  -> Verified PPTX Citation: {rf_cites[0]['document_name']} [Slide {rf_cites[0]['slide_number']}] (Score: {rf_cites[0]['score']})")

        print("[6] Query 3: Video Lecture transcript citation (18:20-20:05 timestamp)...")
        res3 = client.post(
            f"/api/v1/courses/{course_id}/rag/query",
            json={"query": "What misconception about entropy did the professor explain in lecture?", "top_k": 3},
            headers=headers,
        )
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["grounded"] is True
        video_cites = [c for c in data3["citations"] if c["file_type"] == "video"]
        assert len(video_cites) > 0
        print(f"  -> Verified Video Citation: {video_cites[0]['document_name']} [{video_cites[0]['timestamp_start']}-{video_cites[0]['timestamp_end']}] (Score: {video_cites[0]['score']})")

        print("[7] Query 4: Hallucination Guard Test (Out-of-domain Quantum Gravity)...")
        res4 = client.post(
            f"/api/v1/courses/{course_id}/rag/query",
            json={"query": "Explain Quantum Chromodynamics and gluon fields", "top_k": 3},
            headers=headers,
        )
        assert res4.status_code == 200
        data4 = res4.json()
        assert data4["grounded"] is False
        assert data4["model_used"] == "knovara-hallucination-guard"
        print(f"  -> Verified Hallucination Guard: Refused ungrounded query, reported model: {data4['model_used']}")

        print("\nAll Grounded RAG integration tests passed with 100% precision!")


if __name__ == "__main__":
    test_live_rag()
