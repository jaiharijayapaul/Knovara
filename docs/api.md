# Knovara REST API Specification

## Conventions
- Standard JSON responses with status codes.
- Bearer JWT authentication on all protected routes (`Authorization: Bearer <token>`).
- Workspace isolation enforced per user and course ID.

## Core API Endpoints

### 1. Health & Telemetry
- `GET /health` — Liveness and database connectivity probe.
- `GET /` — API greeting, system version, and environment telemetry.

### 2. Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register student account.
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token.
- `GET /api/v1/auth/me` — Current authenticated student profile.

### 3. Courses (`/api/v1/courses`)
- `GET /api/v1/courses` — List course workspaces owned by current student.
- `POST /api/v1/courses` — Create a new isolated course workspace.
- `GET /api/v1/courses/{id}` — Fetch course workspace details with topic hierarchy.
- `PUT /api/v1/courses/{id}` — Update course title and description.
- `DELETE /api/v1/courses/{id}` — Purge course workspace and associated assets.
- `POST /api/v1/courses/{id}/topics` — Add topic to course curriculum.

### 4. Multimodal Documents & Ingestion (`/api/v1/courses/{id}/documents`)
- `GET /api/v1/courses/{id}/documents` — List course uploaded materials.
- `POST /api/v1/courses/{id}/documents/upload` — Upload PDF, PPTX, or Video/Audio transcript.
- `GET /api/v1/courses/{id}/documents/{doc_id}` — Document processing status and chunk metadata.
- `DELETE /api/v1/courses/{id}/documents/{doc_id}` — Purge document and indexed chunks.
- `POST /api/v1/courses/{id}/documents/demo-seed` — Seed verified multi-document curriculum with citations.

### 5. Grounded RAG & Citations (`/api/v1/rag`)
- `POST /api/v1/courses/{id}/rag/query` — Semantic search returning grounded answer with exact multimodal coordinates (`page_number`, `slide_number`, `timestamp_start`–`timestamp_end`).
- `GET /api/v1/courses/{id}/rag/telemetry` — Vector index health, chunk counts, and embedding status.

### 6. Socratic AI Tutor (`/api/v1/courses/{id}/tutor`)
- `GET /api/v1/courses/{id}/tutor/sessions` — List student conversation sessions.
- `POST /api/v1/courses/{id}/tutor/sessions` — Initialize a new Socratic dialog session.
- `POST /api/v1/courses/{id}/tutor/sessions/{session_id}/message` — Post student query with optional mode (socratic, hint, deep_dive, feynman) and receive pedagogical guided response with citations.

### 7. Adaptive Assessments & Bloom's Taxonomy (`/api/v1/courses/{id}/assessments`)
- `GET /api/v1/courses/{id}/assessments` — List generated assessments (includes `is_adaptive` indicator).
- `POST /api/v1/courses/{id}/assessments/generate` — Generate grounded questions.
  - **Payload fields**:
    - `title?: string`
    - `topic?: string`
    - `num_questions: int` (1–20)
    - `difficulty: 'easy' | 'medium' | 'hard' | 'adaptive'`
    - `bloom_levels?: BloomLevel[]` ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')
    - `adaptive_mode?: bool` — **Phase 10-A**: When `true`, queries student's Bayesian Knowledge Tracing model to prioritize weak concepts and scaffold cognitive levels dynamically.
- `GET /api/v1/courses/{id}/assessments/{assessment_id}` — Fetch assessment (supports `?student_mode=true` to redact answers for active examination).
- `POST /api/v1/courses/{id}/assessments/{assessment_id}/submit` — Submit answers; evaluates against 5-category cognitive error taxonomy, calculates score, logs responses, and automatically triggers BKT updates.
- `GET /api/v1/courses/{id}/assessments/{assessment_id}/attempts` — List past attempt summaries.
- `GET /api/v1/courses/{id}/assessments/{assessment_id}/attempts/{attempt_id}` — Full diagnostic review report with question-level error classifications and misconception diagnoses.

### 8. Bayesian Knowledge Tracing & Learner Mastery (`/api/v1/courses/{id}/mastery`)
- `GET /api/v1/courses/{id}/mastery` — Full mastery model for all course concepts with BKT parameters (`p_know`, `p_learn`, `p_guess`, `p_slip`, `is_mastered`, `priority_score`, sparkline trend `p_know_history`).
- `GET /api/v1/courses/{id}/mastery/recommendations?top_n=5` — Ranked adaptive study recommendations ordered by remediation priority score, including scaffolded Bloom levels.
- `GET /api/v1/courses/{id}/mastery/{concept_label}` — Single concept mastery state.
- `PUT /api/v1/courses/{id}/mastery` — Manual BKT hyperparameter override for tuning.

### 9. Spaced Repetition & Flashcards (`/api/v1/courses/{id}/flashcards`)
- `GET /api/v1/courses/{id}/flashcards` — List flashcards (supports `?due_only=true` for active SM-2 study queue, topic, deck filter).
- `POST /api/v1/courses/{id}/flashcards` — Manually create a grounded flashcard.
- `POST /api/v1/courses/{id}/flashcards/generate` — Generate grounded flashcards from syllabus documents (`target_weak_concepts` queries BKT).
- `POST /api/v1/courses/{id}/flashcards/{card_id}/review` — Submit review rating (0-5) computing SuperMemo-2 (SM-2) ease factor, intervals, and bidirectional BKT synchronisation.
- `DELETE /api/v1/courses/{id}/flashcards/{card_id}` — Remove flashcard.
- `GET /api/v1/courses/{id}/flashcards/stats` — Spaced repetition deck telemetry (due today, mature cards, average ease factor).

### 10. Comprehensive Learning Analytics & Progress Telemetry (`/api/v1/courses/{id}/analytics`)
- `GET /api/v1/courses/{id}/analytics` — High-fidelity multi-source learning telemetry report:
  - **Learner Velocity**: Overall mastery %, mastered concepts count, study velocity, active streak days, total study time, and interaction counts.
  - **Bloom's Revised Taxonomy Telemetry**: Accurate question and accuracy breakdown across all 6 cognitive tiers (Remembering, Understanding, Applying, Analyzing, Evaluating, Creating).
  - **Diagnostic Error Taxonomy Profiler**: Frequency distribution and targeted remediation guidance for cognitive traps (`factual_misconception`, `procedural_slip`, `formula_inversion`, `dimensionality_confusion`, `unchecked_assumption`, `distractor_trap`).
  - **Spaced Repetition Retention Decay Forecast**: 14-day Ebbinghaus stability curve ($R(t) = \exp(-t/S)$) and review workload queue projections.
  - **Curricular Concept Mastery Matrix**: Concept status, $P(L)$ scores, priority scores, and iteration sparklines.
  - **Activity Timeline**: 14-day daily volume across assessments, flashcards, and tutor turns.
  - **Executive Summary**: Synthesized narrative diagnostic analysis.
- `GET /api/v1/courses/{id}/analytics/export?format=markdown|json` — Downloadable learning portfolio in formatted Markdown or raw JSON telemetry.
