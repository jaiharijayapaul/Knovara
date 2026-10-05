# Knovara Database Specification

## Relational Schema & State Storage

Knovara uses a relational database architecture (SQLite for development / PostgreSQL 15+ with `pgvector` for production) with strict user workspace isolation.

### Core Tables

1. **`users`**
   - User account credentials, hashed password, name, and role.
2. **`courses`**
   - Isolated course workspaces with metadata, isolated document repositories, and topic structures.
3. **`topics`**
   - Pedagogical syllabus topic tree partitioned by course.
4. **`documents`**
   - Ingested multimodal curriculum files (PDF, PPTX, Video/Audio Transcripts).
5. **`document_chunks`**
   - Semantic text chunks with vector embeddings and multimodal coordinate tracking (`page_number`, `slide_number`, `timestamp_start`–`timestamp_end`).
6. **`chat_sessions` & `chat_messages`**
   - Socratic AI tutor conversation trajectories with pedagogical mode and source citations.
7. **`assessments`**
   - Diagnostic and adaptive examinations.
   - Key attributes: `title`, `topic`, `difficulty`, `is_adaptive` (Phase 10-A), `pass_percentage`, `total_points`.
8. **`questions`**
   - Psychometric questions linked to Bloom's Taxonomy cognitive progression (`remember` through `create`).
   - Grounded citations: `citation_label`, `document_name`, `page_number`, `slide_number`, `timestamp_start`, `source_snippet`.
   - Distractors with misconception diagnostic metadata.
9. **`assessment_attempts`**
   - Scored examination attempts with time spent, percentage score, passed status, and aggregated cognitive error taxonomy summaries.
10. **`question_response_logs`**
    - Item-level attempt logs with selected answer, correctness, points earned, Bloom level, and error classification (`factual_misconception`, `procedural_slip`, `formula_inversion`, `dimensionality_confusion`, `unchecked_assumption`).
11. **`learner_concept_mastery` (Phase 9 & 10-A)**
    - Bayesian Knowledge Tracing (BKT) Hidden Markov Model state per student and concept.
    - Fields: `concept_label`, `p_know` (P(L)), `p_learn`, `p_guess`, `p_slip`, `mastery_threshold`, `total_attempts`, `correct_attempts`, `is_mastered`, `priority_score`, `p_know_history_json` (sparkline).
