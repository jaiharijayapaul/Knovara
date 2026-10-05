"""
Live integration test for Phase 7: Adaptive Assessment Engine & Bloom's Taxonomy Question Generator.
Tests live backend endpoints on port 8000.
"""

import httpx
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def main():
    print("=" * 60)
    print("PHASE 7: LIVE ADAPTIVE ASSESSMENT & BLOOM TAXONOMY INTEGRATION TEST")
    print("=" * 60)

    # 1. Login
    print("\n[1] Authenticating demo student...")
    login_res = httpx.post(f"{BASE_URL}/auth/login", json={
        "email": "sarah@knovara.edu",
        "password": "StrongPassword2026!"
    })
    if login_res.status_code != 200:
        print(f"FAILED: Login error {login_res.status_code}: {login_res.text}")
        sys.exit(1)
    
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Logged in successfully.")

    # 2. Get Course
    print("\n[2] Fetching course workspace...")
    courses_res = httpx.get(f"{BASE_URL}/courses", headers=headers)
    assert courses_res.status_code == 200
    courses = courses_res.json()
    assert len(courses) > 0, "No courses found."
    course = courses[0]
    course_id = course["id"]
    print(f"✓ Target Course: {course['name']} ({course_id})")

    # 3. Generate Bloom Taxonomy Assessment
    print("\n[3] Generating 6-level Bloom's Taxonomy Cognitive Assessment...")
    gen_res = httpx.post(
        f"{BASE_URL}/courses/{course_id}/assessments/generate",
        headers=headers,
        json={
            "title": "Decision Trees & Information Theory Mastery",
            "topic": "Decision Trees",
            "num_questions": 6,
            "difficulty": "medium",
            "bloom_levels": ["remember", "understand", "apply", "analyze", "evaluate", "create"]
        },
        timeout=30.0
    )
    assert gen_res.status_code == 201, f"Generation failed: {gen_res.text}"
    assessment = gen_res.json()
    assessment_id = assessment["id"]
    print(f"✓ Assessment Generated: '{assessment['title']}' (ID: {assessment_id})")
    print(f"✓ Total Points: {assessment['total_points']}, Questions Count: {assessment['questions_count']}")

    # 4. Inspect Questions & Bloom Taxonomy Progression
    print("\n[4] Validating cognitive levels and diagnostic distractors:")
    observed_levels = []
    for q in assessment["questions"]:
        level = q["bloom_level"]
        observed_levels.append(level)
        cite = q.get("citation_label", "No citation")
        doc = q.get("document_name", "General")
        loc = f"p.{q['page_number']}" if q.get("page_number") else f"slide {q.get('slide_number')}" if q.get("slide_number") else q.get("timestamp_start", "excerpt")

        print(f"   [{level.upper():<10}] Q{q['order_index']+1}: {q['question_text'][:70]}...")
        print(f"      Grounded Source: {cite} in {doc} ({loc})")
        print(f"      Correct Answer: {q['correct_answers']} | Points: {q['points']}")

        # Validate distractor traps
        distractors = [opt for opt in q["options"] if not opt.get("is_correct")]
        for d in distractors[:1]:
            print(f"      Sample Distractor Trap ({d['id']}): {d['misconception'][:65]}...")

    expected_set = {"remember", "understand", "apply", "analyze", "evaluate", "create"}
    assert set(observed_levels) == expected_set, f"Mismatch in Bloom levels: {observed_levels}"
    print("✓ All 6 Bloom's Taxonomy cognitive progression levels verified!")

    # 5. Test Student Practice Mode (Redacted View)
    print("\n[5] Fetching assessment in student testing mode (?student_mode=true)...")
    student_res = httpx.get(
        f"{BASE_URL}/courses/{course_id}/assessments/{assessment_id}?student_mode=true",
        headers=headers
    )
    assert student_res.status_code == 200
    student_view = student_res.json()
    for sq in student_view["questions"]:
        assert "correct_answers" not in sq
        assert "explanation" not in sq
        for opt in sq["options"]:
            assert "is_correct" not in opt
            assert "misconception" not in opt
    print("✓ Student test view securely redacts answers, explanations, and misconception tags.")

    # 6. List Assessments
    print("\n[6] Listing all course assessments...")
    list_res = httpx.get(f"{BASE_URL}/courses/{course_id}/assessments", headers=headers)
    assert list_res.status_code == 200
    assessments_list = list_res.json()
    print(f"✓ Retrieved {len(assessments_list)} assessments in course.")

    print("\n" + "=" * 60)
    print("✓✓✓ PHASE 7 ADAPTIVE ASSESSMENT INTEGRATION TEST PASSED! ✓✓✓")
    print("=" * 60)

if __name__ == "__main__":
    main()
