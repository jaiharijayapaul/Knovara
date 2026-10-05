# Knovara — Personalized AI Tutoring & Adaptive Learning Platform

> **Hackathon Track D: Personalized Tutoring & Adaptive Learning**
> Unifying lecture videos, textbooks, and slides into a source-cited knowledge base with continuous adaptive assessment and mastery tracing.

---

## 🚀 The Adaptive Learning Loop
```text
Learning Material → Knowledge Base → RAG Engine → AI Tutor → Adaptive Assessment
      ↑                                                                 ↓
Updated Mastery ← Study Plan ← Recommendations ← Misconception ← Evaluation
```

## 🏗️ Monorepo Architecture

```text
Knovara/
├── frontend/          # React 19 + TypeScript + Vite + Tailwind CSS + Lucide
├── backend/           # FastAPI + SQLAlchemy + Pydantic + pgvector RAG
├── database/          # Migrations, seed data, and schema specs
├── docs/              # System architecture, API, and deployment documentation
├── tests/             # Cross-tier integration and automated tests
├── docker-compose.yml # PostgreSQL + pgvector container definition
└── .env.example       # Canonical configuration blueprint
```

## 🛠️ Quickstart Guide

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173` and automatically proxy API calls to `http://localhost:8000`.

### 3. Health Check
- Backend API Root: `http://localhost:8000/`
- Health Check: `http://localhost:8000/health`
- Interactive API Docs: `http://localhost:8000/docs`
