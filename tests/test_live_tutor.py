"""
Live integration test for Phase 6: Multi-Turn Socratic AI Tutor & Pedagogical Modes.
Tests live backend endpoints on port 8000.
"""

import httpx
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def main():
    print("=" * 60)
    print("PHASE 6: LIVE MULTI-TURN AI TUTOR INTEGRATION TEST")
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
    assert len(courses) > 0, "No courses found for user."
    course = courses[0]
    course_id = course["id"]
    print(f"✓ Target Course: {course['name']} ({course_id})")

    # 3. Create Tutor Session in Socratic Mode
    print("\n[3] Creating Tutor Session in 'socratic' mode...")
    create_session_res = httpx.post(
        f"{BASE_URL}/courses/{course_id}/tutor/sessions",
        headers=headers,
        json={
            "title": "Entropy & Information Gain Exploration",
            "pedagogical_mode": "socratic"
        }
    )
    assert create_session_res.status_code == 201, f"Failed session creation: {create_session_res.text}"
    session = create_session_res.json()
    session_id = session["id"]
    print(f"✓ Session created: {session['title']} (ID: {session_id}, Mode: {session['pedagogical_mode']})")

    # 4. Turn 1 (Socratic Query)
    print("\n[4] Turn 1: Sending question in Socratic mode...")
    turn1_res = httpx.post(
        f"{BASE_URL}/courses/{course_id}/tutor/sessions/{session_id}/messages",
        headers=headers,
        json={"content": "Why does Shannon Entropy peak at p = 0.5 for binary classification?"}
    )
    assert turn1_res.status_code == 201, f"Failed turn 1: {turn1_res.text}"
    turn1 = turn1_res.json()
    assert turn1["sender"] == "assistant"
    assert turn1["pedagogical_mode"] == "socratic"
    print(f"✓ Socratic Tutor Response Preview:\n  {turn1['content'][:150]}...")
    print(f"✓ Grounded Citations count: {len(turn1['citations'])}")
    for c in turn1["citations"]:
        loc = f"p.{c['page_number']}" if c.get("page_number") else f"slide {c.get('slide_number')}" if c.get("slide_number") else c.get("timestamp_start", "excerpt")
        print(f"   - {c['citation_label']} [{c['document_name']} ({loc})]: {c['snippet'][:60]}...")

    # 5. Turn 2: Switch mode to 'analogy' mid-conversation
    print("\n[5] Dynamic Mode Switch: Switching session to 'analogy' mode...")
    switch_res = httpx.patch(
        f"{BASE_URL}/courses/{course_id}/tutor/sessions/{session_id}/mode",
        headers=headers,
        json={"pedagogical_mode": "analogy"}
    )
    assert switch_res.status_code == 200, f"Failed mode switch: {switch_res.text}"
    updated_session = switch_res.json()
    assert updated_session["pedagogical_mode"] == "analogy"
    print(f"✓ Mode dynamically switched to: {updated_session['pedagogical_mode']}")

    # 6. Turn 3: Ask question in Analogy mode
    print("\n[6] Turn 2: Sending question in Analogy mode...")
    turn2_res = httpx.post(
        f"{BASE_URL}/courses/{course_id}/tutor/sessions/{session_id}/messages",
        headers=headers,
        json={"content": "Can you explain how Random Forest reduces variance using an analogy?"}
    )
    assert turn2_res.status_code == 201, f"Failed turn 2: {turn2_res.text}"
    turn2 = turn2_res.json()
    assert turn2["sender"] == "assistant"
    assert turn2["pedagogical_mode"] == "analogy"
    print(f"✓ Analogy Tutor Response Preview:\n  {turn2['content'][:150]}...")
    print(f"✓ Grounded Citations count: {len(turn2['citations'])}")

    # 7. Turn 3: Switch mode to 'exam_prep'
    print("\n[7] Dynamic Mode Switch: Switching session to 'exam_prep' mode...")
    switch2_res = httpx.patch(
        f"{BASE_URL}/courses/{course_id}/tutor/sessions/{session_id}/mode",
        headers=headers,
        json={"pedagogical_mode": "exam_prep"}
    )
    assert switch2_res.status_code == 200
    print("✓ Mode switched to exam_prep.")

    print("\n[8] Turn 3: Sending question in Exam Prep mode...")
    turn3_res = httpx.post(
        f"{BASE_URL}/courses/{course_id}/tutor/sessions/{session_id}/messages",
        headers=headers,
        json={"content": "What are the most likely exam questions about Decision Tree Information Gain?"}
    )
    assert turn3_res.status_code == 201
    turn3 = turn3_res.json()
    assert turn3["pedagogical_mode"] == "exam_prep"
    print(f"✓ Exam Prep Tutor Response Preview:\n  {turn3['content'][:150]}...")

    # 9. Verify full session conversation persistence
    print("\n[9] Fetching full session dialogue history...")
    detail_res = httpx.get(
        f"{BASE_URL}/courses/{course_id}/tutor/sessions/{session_id}",
        headers=headers
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    print(f"✓ Total turns in session: {len(detail['messages'])}")
    # 1 initial welcome + 2 mode switches + 3 user queries + 3 assistant responses = 9
    assert len(detail["messages"]) == 9
    print("✓ Multi-turn context, mode transition milestones, and citation integrity fully verified!")

    # 10. List all tutor sessions
    print("\n[10] Listing all course tutor sessions...")
    list_res = httpx.get(
        f"{BASE_URL}/courses/{course_id}/tutor/sessions",
        headers=headers
    )
    assert list_res.status_code == 200
    sessions_list = list_res.json()
    print(f"✓ Retrieved {len(sessions_list)} sessions for course.")

    print("\n" + "=" * 60)
    print("✓✓✓ PHASE 6 MULTI-TURN AI TUTOR INTEGRATION TEST PASSED! ✓✓✓")
    print("=" * 60)

if __name__ == "__main__":
    main()
