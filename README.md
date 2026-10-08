# 🎓 Knovara — Personalized AI Tutoring & Adaptive Learning Platform

> **AI-Powered Learning Platform with Multimodal Ingestion, Multilingual YouTube Translation, Socratic AI Tutoring, and Bayesian Knowledge Tracing.**

[![Live Web App](https://img.shields.io/badge/Frontend-Vercel%20Production-teal?logo=vercel)](https://knovara-beta.vercel.app)
[![API Backend](https://img.shields.io/badge/Backend-Render%20Production-blue?logo=render)](https://knovara-backend.onrender.com/health)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-green?logo=supabase)](https://supabase.com)
[![AI Engine](https://img.shields.io/badge/LLM-Gemini%202.5%20Flash-orange?logo=google)](https://ai.google.dev/)

---

## 🌟 Platform Highlights & Key Features

### 1. 🎥 Multilingual YouTube Lecture Ingestion & Auto-Translation
- **Paste Any YouTube Link**: Ingest lecture videos, webinars, or tutorials directly by pasting URLs (`https://youtube.com/watch?v=...` or `https://youtu.be/...`).
- **Multilingual Support**: Supports lectures recorded in any language (English, Hindi, Spanish, French, German, Tamil, Japanese, etc.).
- **Automatic English Translation**: Non-English transcripts are automatically translated into clear, academic English via Google Gemini 2.5 Flash.
- **Exact Video Timestamps**: Timestamps (e.g. `[YouTube: 04:22 - 05:40]`) are preserved and aligned with translated segments.
- **1-Click Video Jumping**: Clicking any timestamp badge in chat or notes immediately jumps to that exact second in the YouTube video.

### 2. 📝 1-Click AI Study Notes & Master Course Guides
- **Structured Study Notes**: In 1 click, synthesize comprehensive, beautifully structured study notes from any uploaded PDF, PPTX, or YouTube lecture.
- **Pedagogical Structure**: Notes include:
  1. *Big Picture & Core Purpose*
  2. *Core Concepts Explained with Real-World Analogies*
  3. *Key Facts, Rules & Formulas*
  4. *High-Yield Exam Takeaways*
  5. *Common Student Traps & Misconceptions*
  6. *Quick Practice Check (Self-Test)*
- **Master Course Guide**: Merge all chapters and video lectures in a course into one unified exam preparation master guide.
- **Strictly in English**: All synthesized notes and explanations are formulated in fluent, crystal-clear English.

### 3. 🤖 Socratic AI Tutor with 7 Teaching Styles
- **Source-Grounded Citations**: The AI tutor provides factual answers backed by exact page numbers, slide numbers, or YouTube timestamp citations.
- **7 Pedagogical Modes**:
  - `Guided Thinking (Socratic)`: Gives the direct answer first, followed by an encouraging question to spark reflection.
  - `Everyday Analogy`: Explains abstract math or science concepts using intuitive, everyday real-world examples.
  - `Step-by-Step Guide`: Breaks complex algorithms or formulas into small, easy-to-follow steps.
  - `Mistake Buster`: Warns against common exam traps and shows how to remember correctly.
  - `Exam Prep`: Highlights the high-yield formulas and concepts most likely to be tested.
  - `Deep Dive`: In-depth breakdown with theoretical background and industrial applications.
  - `Quick 30-Sec Summary`: Fast 3-point recap right before class or exams.
- **Strict English Language Enforcement**: Always responds in fluent English, even if the student types their question in another language.

### 4. 🧠 Bayesian Knowledge Tracing (BKT) & Adaptive Quizzes
- **Latent Mastery Modeling**: Continuously computes latent concept mastery $P(L_t)$ from student responses:
  - $P(L_0)$: Initial prior mastery.
  - $P(T)$: Transition probability of learning during practice.
  - $P(G)$: Guess parameter to filter out lucky guesses.
  - $P(S)$: Slip parameter to protect against careless mistakes.
- **Adaptive Question Blueprints**: Automatically generates quiz questions focusing on the student's weakest topics.
- **Misconception Feedback**: Explains why incorrect options were wrong and how to correct the underlying misconception.
- **Timed Mock Exams**: Realistic exam countdown clock with question palette and review flagging.

### 5. 🗂️ Spaced Repetition Flashcards (SuperMemo SM-2)
- Automatically generated high-yield recall flashcards from syllabus concepts.
- Optimal review intervals computed using the SM-2 algorithm based on student recall ratings (*Again, Hard, Good, Easy*).

### 6. 🗺️ Concept Mind Map & 1-Page Exam Revision Sheet
- **Interactive Mind Map**: Visual network graph color-coded by mastery (Green = Mastered, Yellow = Learning, Red = Needs Practice).
- **Printable Revision Sheet**: 1-click clean white printable summary sheet optimized for final exam review.

### 7. 🛡️ Admin Command Center & Role-Based Access Control (`/admin`)
- **Institutional Management**: Dedicated dashboard for educators and platform administrators.
- **User Management & RBAC**: View all users, search profiles, and assign roles (`student`, `instructor`, `admin`).
- **Course & Document Audits**: Inspect courses, files, chunks, and quiz generations across the institution.
- **Live Infrastructure Monitoring**: Real-time status for PostgreSQL, Gemini API, and server latency.

---

## 🏗️ Architecture & Technology Stack

```text
┌────────────────────────────────────────────────────────┐
│                   Frontend (Vercel)                    │
│   React 19 + TypeScript + Vite + Tailwind CSS + Lucide │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / JSON API
┌──────────────────────────▼─────────────────────────────┐
│                   Backend (Render)                     │
│    FastAPI + SQLAlchemy + Pydantic + Uvicorn           │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
┌──────────────▼─────────────┐   ┌────────▼──────────────┐
│   Database (Supabase)      │   │     AI / LLM API      │
│ PostgreSQL + pgvector RAG  │   │ Google Gemini 2.5     │
└────────────────────────────┘   └───────────────────────┘
```

---

## 🚀 Step-by-Step User Guide

### For Students:
1. **Sign In**: Sign in using your email/password or with **1-Click Google Sign-In**.
2. **Create a Course Workspace**: Click "Create New Subject" (e.g., *Machine Learning*, *Biology*, *Data Structures*).
3. **Upload Material or Paste YouTube Video**:
   - Upload PDF textbooks, PowerPoint slides, or notes.
   - Paste any YouTube lecture URL (in English, Hindi, Spanish, Tamil, French, etc.). The system automatically translates foreign lectures to English!
4. **Generate AI Study Notes**: Click "Generate AI Study Notes" on any document to get a complete study guide.
5. **Chat with AI Tutor**: Ask questions in the "Ask AI Tutor" tab and choose your preferred teaching mode.
6. **Practice Flashcards & Quizzes**: Review flashcards using spaced repetition and take adaptive mock exams to boost your BKT mastery scores.

### For Instructors & Admins:
1. Access the **Admin Command Center** at [`/admin`](https://knovara-beta.vercel.app/admin).
2. Manage student accounts, adjust user roles (`student`, `instructor`, `admin`), and inspect course materials.
3. Monitor server latency and database connection pool health.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- SQLite or PostgreSQL

### 2. Backend Setup
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

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The app will run locally at `http://localhost:5173` and connect to the backend at `http://127.0.0.1:8000`.

### 4. Production Deployment URLs
- **Web Application**: [https://knovara-beta.vercel.app](https://knovara-beta.vercel.app)
- **Backend API**: [https://knovara-backend.onrender.com](https://knovara-backend.onrender.com)
- **Health Check**: [https://knovara-backend.onrender.com/health](https://knovara-backend.onrender.com/health)
- **API Documentation**: [https://knovara-backend.onrender.com/docs](https://knovara-backend.onrender.com/docs)
