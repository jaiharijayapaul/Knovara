# Knovara Backend Service

FastAPI-powered backend handling adaptive learning loops, RAG knowledge retrieval, multimodal processing pipelines, and student mastery tracing.

## Structure
- `app/api/`: REST endpoint routes
- `app/models/`: SQLAlchemy database models
- `app/schemas/`: Pydantic request/response schemas
- `app/services/`: Core application services
- `app/repositories/`: Database abstraction queries
- `app/rag/`: Retrieval Augmented Generation pipeline
- `app/tutor/`: AI Tutor engine with pedagogical modes
- `app/assessment/`: Dynamic question generator and difficulty adjuster
- `app/learner/`: Student mastery and misconception models
- `app/processing/`: Text/PDF/PPTX/Video parser and chunker
- `app/auth/`: JWT security and user credential validation
- `app/utils/`: Common helpers and logging configuration

## Running Backend
```bash
uvicorn app.main:app --reload --port 8000
```
