# Knovara Database

This directory houses database migrations, schema definitions, and seed data for the Knovara platform.

## Schema Overview

- **PostgreSQL 15+** with the **pgvector** extension.
- Tables for Users, Courses, Documents, Document Chunks (with vector embeddings), Topics, Student Mastery, Questions, Question Attempts, Misconceptions, Flashcards, Study Plans, and Learning Reports.

## Migrations

Managed with Alembic and SQLAlchemy.
