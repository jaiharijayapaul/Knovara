"""Quick live endpoint verification script for Course Management."""

import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

# 1. Login demo user
login = httpx.post(f"{BASE_URL}/auth/login", json={
    "email": "sarah@knovara.edu",
    "password": "StrongPassword2026!"
})
assert login.status_code == 200, f"Login failed: {login.text}"
token = login.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. List courses
courses_res = httpx.get(f"{BASE_URL}/courses", headers=headers)
assert courses_res.status_code == 200
courses = courses_res.json()
print(f"Courses retrieved: {len(courses)}")
for c in courses:
    name = c["name"]
    topics_count = c["topics_count"]
    subject = c["subject"]
    print(f" - {name} ({topics_count} Topics, Subject: {subject})")

# 3. Get first course details
first_id = courses[0]["id"]
detail_res = httpx.get(f"{BASE_URL}/courses/{first_id}", headers=headers)
assert detail_res.status_code == 200
detail = detail_res.json()
print(f"Topics in {detail['name']}:")
for t in detail.get("topics", []):
    print(f"   * {t['name']}: {t.get('description', '')[:50]}...")

# 4. Create custom course
create_res = httpx.post(f"{BASE_URL}/courses", json={
    "name": "Deep Reinforcement Learning",
    "description": "Policy gradients, Q-learning, and Markov decision processes.",
    "subject": "Artificial Intelligence"
}, headers=headers)
assert create_res.status_code == 201
new_course = create_res.json()
print(f"Created custom workspace: {new_course['name']} (ID: {new_course['id']})")

print("\nALL LIVE COURSE WORKSPACE CHECKS PASSED!")
