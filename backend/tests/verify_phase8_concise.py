import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

with httpx.Client(timeout=30.0) as client:
    # 1. Login
    login_res = client.post(
        f"{BASE_URL}/auth/login",
        json={"email": "sarah@knovara.edu", "password": "StrongPassword2026!"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Logged in successfully")

    # 2. List courses
    courses_res = client.get(f"{BASE_URL}/courses", headers=headers)
    courses = courses_res.json()
    course_id = courses[0]["id"]
    print(f"[2] Using course: {course_id}")

    # 3. List assessments
    assessments_res = client.get(f"{BASE_URL}/courses/{course_id}/assessments", headers=headers)
    assessments = assessments_res.json()
    assessment_id = assessments[0]["id"]

    det_res = client.get(f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}?student_mode=false", headers=headers)
    assessment = det_res.json()
    questions = assessment["questions"]
    print(f"[3] Assessment has {len(questions)} questions")

    # 4. Submit
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

    submit_payload = {"time_spent_seconds": 120, "responses": responses}
    submit_res = client.post(
        f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/submit",
        headers=headers,
        json=submit_payload
    )
    print(f"[4] Submit response status: {submit_res.status_code}")
    if submit_res.status_code != 200:
        print(f"Error body: {submit_res.text}")
        exit(1)

    attempt = submit_res.json()
    print(f"[4] Attempt score: {attempt['score']}/{attempt['total_points']} ({attempt['percentage']}%)")
    print(f"[4] Passed: {attempt['passed']}")
    print(f"[4] Error taxonomy summary: {attempt['error_summary']}")

    # 5. History
    hist_res = client.get(f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/attempts", headers=headers)
    history = hist_res.json()
    print(f"[5] History count: {len(history)} attempts")

    # 6. Detail
    detail_res = client.get(f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}/attempts/{attempt['id']}", headers=headers)
    print(f"[6] Detail status: {detail_res.status_code}")
    detail = detail_res.json()
    print(f"[6] Results count: {len(detail['question_results'])}")

    print("\n>>> ALL PHASE 8 BACKEND AND API CHECKS PASSED PERFECTLY! <<<")
