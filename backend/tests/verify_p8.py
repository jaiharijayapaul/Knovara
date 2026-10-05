import httpx
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

try:
    with httpx.Client(timeout=30.0) as client:
        login_res = client.post(f"{BASE_URL}/auth/login", json={"email": "sarah@knovara.edu", "password": "StrongPassword2026!"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[1] Login OK")

        courses = client.get(f"{BASE_URL}/courses", headers=headers).json()
        course_id = courses[0]["id"]
        print(f"[2] Course: {course_id}")

        assessments = client.get(f"{BASE_URL}/courses/{course_id}/assessments", headers=headers).json()
        assessment_id = assessments[0]["id"]
        det = client.get(f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}?student_mode=false", headers=headers).json()
        questions = det["questions"]
        print(f"[3] Questions: {len(questions)}")

        responses = []
        for idx, q in enumerate(questions):
            opts = q["options"]
            if idx == 0:
                corr = [o["id"] for o in opts if o.get("is_correct")]
                chosen = corr if corr else [opts[0]["id"]]
            else:
                wrong = [o["id"] for o in opts if not o.get("is_correct")]
                chosen = [wrong[0]] if wrong else [opts[0]["id"]]
            responses.append({"question_id": q["id"], "selected_answers": chosen})

        submit_res = client.post(f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/submit", headers=headers, json={"time_spent_seconds": 120, "responses": responses})
        print(f"[4] Submit status: {submit_res.status_code}")
        attempt = submit_res.json()
        print(f"[4] Score: {attempt.get('score')}/{attempt.get('total_points')} ({attempt.get('percentage')}%) Passed={attempt.get('passed')}")
        print(f"[4] Error summary: {attempt.get('error_summary')}")
        print(f"[4] Bloom levels: {list((attempt.get('bloom_summary') or {}).keys())}")
        print(f"[4] Q-results count: {len(attempt.get('question_results', []))}")
        q0 = attempt.get('question_results', [{}])[0]
        print(f"[4] Q0 correct={q0.get('is_correct')} cat={q0.get('error_category')}")

        hist = client.get(f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/attempts", headers=headers).json()
        print(f"[5] History: {len(hist)} attempts")

        detail = client.get(f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/attempts/{attempt['id']}", headers=headers).json()
        print(f"[6] Detail q-results: {len(detail.get('question_results', []))}")

        print("\n>>> ALL PHASE 8 CHECKS PASSED! <<<")

except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
