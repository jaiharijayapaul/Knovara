"""AI Study Notes Generation Service for uploaded learning materials."""

import re
import json
import logging
import httpx
from typing import List, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models.document import Document, DocumentChunk
from app.models.course import Course

logger = logging.getLogger(__name__)


class NotesService:
    """
    Analyzes uploaded course materials and synthesizes structured,
    simple, student-friendly AI Study Notes.
    """

    @classmethod
    async def generate_notes_for_document(
        cls,
        db: Session,
        document: Document,
        course_name: str = "Course",
    ) -> str:
        """
        Synthesize comprehensive AI Study Notes directly from an uploaded document's chunks.
        Saves the markdown output to document.ai_notes.
        """
        chunks = document.chunks
        if not chunks:
            # Fallback if no chunks available
            notes = (
                f"# 📝 Study Notes: {document.filename}\n\n"
                f"### 🎯 Overview\n"
                f"This document ({document.file_type.upper()}) was uploaded to **{course_name}**. "
                f"Content is being extracted and indexed for study sessions.\n\n"
                f"- **Format:** {document.file_type.upper()}\n"
                f"- **Size:** {round(document.file_size / 1024, 1)} KB\n"
            )
            document.ai_notes = notes
            db.commit()
            return notes

        # Combine representative text from chunks
        chunk_excerpts = []
        for c in chunks[:15]:
            loc = (
                f"Page {c.page_number}"
                if c.page_number
                else f"Slide {c.slide_number}"
                if c.slide_number
                else f"Time {c.timestamp_start}\u2013{c.timestamp_end}"
                if c.timestamp_start
                else "Section"
            )
            chunk_excerpts.append(f"[{loc}]: {c.content}")

        combined_text = "\n\n".join(chunk_excerpts)

        # 1. Try Gemini 2.5 Flash
        api_key = settings.LLM_API_KEY
        if api_key and len(api_key.strip()) > 10:
            try:
                gemini_notes = await cls._generate_with_gemini(
                    doc_filename=document.filename,
                    course_name=course_name,
                    content=combined_text,
                    api_key=api_key,
                )
                if gemini_notes and len(gemini_notes.strip()) > 100:
                    document.ai_notes = gemini_notes.strip()
                    db.commit()
                    logger.info(f"Generated AI notes with Gemini for document '{document.filename}'")
                    return document.ai_notes
            except Exception as e:
                logger.warning(f"Gemini notes generation failed, using local synthesis: {e}")

        # 2. High-Fidelity Local Deterministic Synthesis
        local_notes = cls._synthesize_local_notes(document, chunks, course_name)
        document.ai_notes = local_notes
        db.commit()
        logger.info(f"Synthesized local AI study notes for document '{document.filename}'")
        return local_notes

    @classmethod
    async def generate_course_study_notes(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
    ) -> str:
        """
        Synthesize unified AI Master Study Guide across all uploaded materials in a course workspace.
        """
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return ""

        docs = course.documents
        if not docs:
            notes = (
                f"# 📚 Master Study Guide: {course.name}\n\n"
                f"Upload lecture slides, textbook PDFs, or class notes to automatically generate your unified AI Study Guide!"
            )
            course.study_notes = notes
            db.commit()
            return notes

        # Collect top chunks from across all documents
        all_chunks = []
        for d in docs:
            all_chunks.extend(d.chunks)

        if not all_chunks:
            return ""

        # Build cross-document synthesis
        sample_texts = [f"[{c.document.filename if c.document else 'Doc'}]: {c.content}" for c in all_chunks[:12]]
        combined_text = "\n\n".join(sample_texts)

        api_key = settings.LLM_API_KEY
        if api_key and len(api_key.strip()) > 10:
            try:
                notes = await cls._generate_course_notes_gemini(
                    course_name=course.name,
                    subject=course.subject,
                    content=combined_text,
                    api_key=api_key,
                )
                if notes and len(notes.strip()) > 100:
                    course.study_notes = notes.strip()
                    db.commit()
                    return course.study_notes
            except Exception as e:
                logger.warning(f"Course Gemini notes generation failed: {e}")

        # Local course synthesis
        topics_list = [t.name for t in course.topics]
        notes = (
            f"# 📚 Master Study Guide: {course.name}\n\n"
            f"**Subject Area:** {course.subject} | **Uploaded Materials:** {len(docs)} documents\n\n"
            f"### 🎯 Course Curriculum Overview\n"
            f"This study workspace synthesizes your uploaded materials into a structured, easy-to-review guide. "
            f"Review these notes before taking your practice assessments or practicing flashcards.\n\n"
            f"### 💡 Key Curriculum Modules\n"
        )
        for i, t in enumerate(topics_list, start=1):
            notes += f"{i}. **{t}**\n"

        notes += f"\n### 📋 Document Breakdown\n"
        for d in docs:
            notes += f"- **{d.filename}** ({d.file_type.upper()}): {len(d.chunks)} sections indexed\n"

        course.study_notes = notes
        db.commit()
        return notes

    @classmethod
    async def _generate_with_gemini(
        cls,
        doc_filename: str,
        course_name: str,
        content: str,
        api_key: str,
    ) -> str:
        """Call Gemini 2.5 Flash to synthesize comprehensive, simple student study notes."""
        prompt = (
            f"You are an expert, friendly AI Study Guide Creator for students.\n"
            f"A student uploaded their learning material: '{doc_filename}' for the course '{course_name}'.\n\n"
            f"YOUR TASK: Read the provided material text below and create comprehensive, beautifully structured AI STUDY NOTES in SIMPLE, FRIENDLY, EASY-TO-UNDERSTAND words that any student can immediately understand and learn from.\n\n"
            f"LANGUAGE REQUIREMENT: You MUST formulate and write all study notes strictly in fluent, clear English. Even if the lecture excerpts or original document contain non-English words, translate and explain all concepts thoroughly in English.\n\n"
            f"REQUIRED STRUCTURE FOR THE NOTES:\n"
            f"# 📝 AI Study Notes: {doc_filename}\n\n"
            f"### 🎯 1. Big Picture & What This Covers\n"
            f"(2-3 sentences explaining in simple words what this document is about and why it matters)\n\n"
            f"### 💡 2. Core Concepts Explained Simply\n"
            f"(Identify the 3-5 most important concepts. Explain each concept clearly with an intuitive real-world example or everyday analogy)\n\n"
            f"### 📋 3. Key Facts, Rules & Definitions\n"
            f"(Provide bullet points of essential definitions, rules, steps, or formulas directly from the text with exact page/slide citations)\n\n"
            f"### ⚡ 4. High-Yield Exam Takeaways\n"
            f"(4-6 bite-sized bullet points summarizing what is most likely to be tested on exams or quizzes)\n\n"
            f"### ⚠️ 5. Common Student Mistakes & Traps\n"
            f"(Point out 2 common misconceptions or traps students make on this material and the easy way to remember the right answer)\n\n"
            f"### 🧠 6. Quick Practice Check (Self-Test)\n"
            f"(3 short self-check questions with their simple correct answers hidden or clearly labeled so students can test themselves)\n\n"
            f"MATERIAL EXCERPTS:\n{content[:8000]}\n\n"
            f"STUDENT STUDY NOTES (Markdown format in English):"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            if res.status_code == 200:
                data = res.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        return ""

    @classmethod
    async def _generate_course_notes_gemini(
        cls,
        course_name: str,
        subject: str,
        content: str,
        api_key: str,
    ) -> str:
        """Call Gemini to synthesize a course master study guide."""
        prompt = (
            f"You are a friendly academic tutor.\n"
            f"Create a unified Master Study Guide for the course '{course_name}' ({subject}) based on the student's uploaded notes.\n"
            f"LANGUAGE REQUIREMENT: Formulate the entire study guide strictly in fluent, clear English.\n"
            f"Use simple words, clear headings, bullet points, real-world analogies, and quick self-tests.\n\n"
            f"EXCERPTS:\n{content[:8000]}\n\n"
            f"MASTER STUDY GUIDE (Markdown in English):"
        )
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            if res.status_code == 200:
                data = res.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        return ""

    @classmethod
    def _synthesize_local_notes(
        cls,
        document: Document,
        chunks: List[DocumentChunk],
        course_name: str,
    ) -> str:
        """Deterministic, grounded study notes generator when offline."""
        clean_name = document.filename.rsplit(".", 1)[0].replace("_", " ")

        # Extract sentences and key ideas from chunks
        sections = []
        for i, c in enumerate(chunks[:8], start=1):
            loc = (
                f"Page {c.page_number}"
                if c.page_number
                else f"Slide {c.slide_number}"
                if c.slide_number
                else f"Section {i}"
            )
            raw = c.content.strip()
            # Grab first 2 clean sentences
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", raw) if len(s.strip()) > 15]
            core = sentences[0] if sentences else raw[:150]
            extra = sentences[1] if len(sentences) > 1 else ""
            sections.append((loc, core, extra, c.topic or "Core Concept"))

        notes = (
            f"# 📝 AI Study Notes: {document.filename}\n\n"
            f"**Workspace:** {course_name} | **Document Type:** {document.file_type.upper()} | **Sections Analyzed:** {len(chunks)}\n\n"
            f"### 🎯 1. Big Picture & What This Covers\n"
            f"These study notes were automatically analyzed from your uploaded file **{document.filename}**. "
            f"The material covers foundational and applied principles of **{clean_name}**, organized into clear, "
            f"bite-sized concepts so you can master each idea easily.\n\n"
            f"### 💡 2. Core Concepts Explained Simply\n\n"
        )

        for loc, core, extra, topic in sections[:4]:
            notes += (
                f"#### 📌 {topic} ({loc})\n"
                f"- **Key Idea in Plain Words:** {core}\n"
            )
            if extra:
                notes += f"- **Why It Matters:** {extra}\n"
            notes += "\n"

        notes += (
            f"### 📋 3. Key Facts & Definitions from Your Notes\n\n"
        )
        for loc, core, _, _ in sections[2:6]:
            notes += f"- **[{loc}]**: {core}\n"

        notes += (
            f"\n### ⚡ 4. High-Yield Exam Takeaways\n\n"
            f"1. **Core Definition:** Focus on understanding the main principles outlined in **{clean_name}** without rote memorization.\n"
            f"2. **Mechanics & Steps:** Review how each step connects to the overall goal of the topic.\n"
            f"3. **Practical Application:** Be ready to explain how this concept solves problems in exams and real-world scenarios.\n"
            f"4. **Quick Revision:** Re-read the key points above 15 minutes before your test for maximum recall.\n\n"
            f"### ⚠️ 5. Common Student Mistakes & Traps\n\n"
            f"- **Mistake:** Memorizing terms without understanding the underlying mechanism.\n"
            f"- **How to Avoid:** Explain the concept in your own words or relate it to a simple daily analogy.\n\n"
            f"### 🧠 6. Quick Practice Check (Self-Test)\n\n"
        )

        if sections:
            first_topic = sections[0][3]
            first_core = sections[0][1]
            notes += (
                f"**Q1: In 1-2 sentences, what is the main idea behind {first_topic}?**\n\n"
                f"&bull; *Answer:* {first_core}\n\n"
            )
        if len(sections) > 1:
            second_topic = sections[1][3]
            second_core = sections[1][1]
            notes += (
                f"**Q2: How does {second_topic} apply in this material?**\n\n"
                f"&bull; *Answer:* {second_core}\n\n"
            )

        notes += (
            f"**Q3: Why is it important to review the source citations in your uploaded materials?**\n\n"
            f"&bull; *Answer:* Citations trace every explanation back to the exact page and slide of your textbook so you know the information is 100% truthful.\n"
        )

        return notes
