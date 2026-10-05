# Knovara Architecture Overview

## Overview
Knovara is an AI-powered personalized tutoring and adaptive learning platform. It unifies multimodal learning material (textbooks, lecture slides, video lectures) into a source-cited knowledge base and runs an adaptive feedback loop.

## The Adaptive Learning Loop
```text
Learning Material 
  ↓
Knowledge Base & Multimodal Processing
  ↓
RAG Engine (pgvector + semantic retrieval)
  ↓
AI Tutor (Pedagogical modes + Grounded citations)
  ↓
Adaptive Assessment (Bloom's taxonomy + Dynamic difficulty)
  ↓
Performance Analysis & Misconception Detection
  ↓
Learner Mastery Model
  ↓
Personalized Recommendation & Study Planner
  ↓
Retest & Updated Mastery
```

## System Components
1. **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Axios.
2. **Backend**: Python 3.13, FastAPI, Pydantic, SQLAlchemy 2.
3. **Database**: PostgreSQL with `pgvector` for vector storage and semantic search.
4. **AI & RAG Pipeline**: LLM provider with fallback, semantic chunking, and source citation engine.
