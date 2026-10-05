# Knovara Deployment Guide

## Architecture
- **Frontend**: Vercel or static hosting with Vite build artifacts (`npm run build`).
- **Backend**: Container or Python hosting service (Render, Railway, Fly.io, Cloud Run) executing `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- **Database**: Managed PostgreSQL with `pgvector` extension (Supabase PostgreSQL, Neon, AWS RDS, or local Docker container).
- **Storage**: Supabase Storage or S3-compatible bucket for PDF/PPTX/Video lecture media.
