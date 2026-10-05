import httpx
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_live_phase8():
    with httpx.Client(timeout=30.0) as client:
        # 1. Login
        login_res = client.post(
            f"{BASE_URL}/auth/login",
            json={"email": "sarah@knovara.edu", "password": "StrongPassword2026!"}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("1. [PASS] Logged in successfully.")

        # 2. List courses
        courses_res = client.get(f"{BASE_URL}/courses", headers=headers)
        assert courses_res.status_code == 200
        courses = courses_res.json()
        assert len(courses) > 0, "No courses found"
        course_id = courses[0]["id"]
        print(f"2. [PASS] Retrieved course: {courses[0]['name']} ({course_id})")

        # 3. List or generate assessment
        assessments_res = client.get(f"{BASE_URL}/courses/{course_id}/assessments", headers=headers)
        assert assessments_res.status_code == 200
        assessments = assessments_res.json()

        if len(assessments) == 0:
            print("Generating new assessment for testing...")
            gen_res = client.post(
                f"{BASE_URL}/courses/{course_id}/assessments/generate",
                headers=headers,
                json={
                    "title": "Phase 8 Live Diagnostic Verification",
                    "num_questions": 4,
                    "difficulty": "medium",
                    "bloom_levels": ["remember", "understand", "apply", "analyze"]
                }
            )
            assert gen_res.status_code == 200, f"Generate failed: {gen_res.text}"
            assessment = gen_res.json()
        else:
            # Fetch detail
            det_res = client.get(
                f"{BASE_URL}/courses/{course_id}/assessments/{assessments[0]['id']}?student_mode=false",
                headers=headers
            )
            assert det_res.status_code == 200
            assessment = det_res.json()

        assessment_id = assessment["id"]
        questions = assessment["questions"]
        print(f"3. [PASS] Assessment ready: '{assessment['title']}' with {len(questions)} questions.")

        # 4. Submit answers: answer question 0 correctly, question 1 with distractor
        responses = []
        for idx, q in enumerate(questions):
            opts = q["options"]
            if idx == 0:
                # Answer correctly
                corr_opts = [o["id"] for o in opts if o.get("is_correct")]
                chosen = corr_opts if corr_opts else [opts[0]["id"]]
            else:
                # Answer with distractor to test taxonomy
                wrong_opts = [o["id"] for o in opts if not o.get("is_correct")]
                chosen = [wrong_opts[0]] if wrong_opts else [opts[0]["id"]]

            responses.append({
                "question_id": q["id"],
                "selected_answers": chosen
            })

        submit_payload = {
            "time_spent_seconds": 142,
            "responses": responses
        }

        submit_res = client.post(
            f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/submit",
            headers=headers,
            json=submit_payload
        )
        assert submit_res.status_code == 200, f"Submit failed: {submit_res.text}"
        attempt = submit_res.json()
        print(f"4. [PASS] Submitted test successfully! Score: {attempt['score']}/{attempt['total_points']} ({attempt['percentage']}%), Passed: {attempt['passed']}")
        print(f"   Error Summary: {attempt['error_summary']}")
        print(f"   Bloom Summary: {list(attempt['bloom_summary'].keys())}")

        # 5. Check item results & Error taxonomy classification
        q_results = attempt["question_results"]
        assert len(q_results) == len(questions)
        q0_res = q_results[0]
        assert q0_res["is_correct"] is True
        assert q0_res["error_category"] == "none"

        if len(q_results) > 1:
            q1_res = q_results[1]
            assert q1_res["is_correct"] is False
            assert q1_res["error_category"] in [
                "factual_misconception",
                "procedural_slip",
                "formula_inversion",
                "dimensionality_confusion",
                "unchecked_assumption"
            ]
            print(f"   Taxonomy Classification on Q2: [{q1_res['error_category']}] - {q1_res['misconception_diagnosis']}")
            print(f"   Remediation Advice: {q1_res['remediation_hint']}")

        # 6. Verify attempts list endpoint
        hist_res = client.get(
            f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/attempts",
            headers=headers
        )
        assert hist_res.status_code == 200
        history = hist_res.json()
        assert any(a["id"] == attempt["id"] for a in history)
        print(f"5. [PASS] History endpoint returned {len(history)} attempts, including new attempt {attempt['id']}.")

        # 7. Verify attempt detail endpoint
        detail_res = client.get(
            f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/attempts/{attempt['id']}",
            headers=headers
        )
        assert detail_res.status_code == 200
        retrieved_attempt = detail_res.json()
        assert retrieved_attempt["id"] == attempt["id"]
        assert len(retrieved_attempt["question_results"]) == len(questions)
        print("6. [PASS] Attempt detail endpoint successfully retrieved full diagnostic result.")

        print("\nALL LIVE PHASE 8 VERIFICATIONS PASSED 100%!")

if __name__ == "__main__":
    test_live_phase8()
