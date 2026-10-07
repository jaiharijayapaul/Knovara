"""Grounded answer generation engine with inline multimodal citation attribution and hallucination guard."""

import os
import re
import logging
import httpx
from typing import List, Tuple
from app.config import settings
from app.schemas.rag import SourceCitation

logger = logging.getLogger(__name__)


class GroundedGenerator:
    """
    Synthesizes pedagogical answers strictly grounded in retrieved course knowledge base excerpts.
    Embeds verified citation markers [Doc X: Page Y] or [Doc X: Slide Z] or [Doc X: mm:ss]
    and enforces strict hallucination guards against ungrounded queries.
    """

    @classmethod
    async def generate_answer(
        cls,
        query: str,
        citations: List[SourceCitation],
        course_name: str = "Course",
    ) -> Tuple[str, bool, str]:
        """
        Generate grounded response.
        Returns (answer_markdown, is_grounded, model_used).
        """
        # 1. Check if retrieved chunks exist and meet relevance threshold
        if not citations or citations[0].score < 0.18:
            return (
                f"### ℹ️ Not Found in Current Notes (Knowledge Base Boundary Alert)\n\n"
                f"I looked through your uploaded notes for **{course_name}**, but I couldn't find information "
                f"specifically answering: *\"{query}\"*.\n\n"
                f"**How to get this answered:**\n"
                f"- Upload more lecture slides, PDF chapters, or notes covering this topic.\n"
                f"- Or ask a question about the topics currently in your uploaded material!",
                False,
                "knovara-hallucination-guard",
            )

        # 2. If Gemini API key is configured, invoke Gemini 1.5 Pro
        api_key = settings.LLM_API_KEY
        if api_key and len(api_key.strip()) > 10:
            try:
                answer = await cls._generate_with_gemini(query, citations, api_key)
                if answer:
                    return answer, True, f"gemini-{settings.LLM_MODEL}"
            except Exception as e:
                logger.warning(f"Gemini API call failed, falling back to local grounded synthesis: {e}")

        # 3. High-Fidelity Local Grounded Synthesis
        answer = cls._synthesize_local_grounded_answer(query, citations)
        return answer, True, "knovara-grounded-synthesizer"

    @classmethod
    async def _generate_with_gemini(
        cls, query: str, citations: List[SourceCitation], api_key: str
    ) -> str:
        """Call Gemini API with strict system grounding prompt."""
        context_parts = []
        for c in citations:
            loc = (
                f"Page {c.page_number}"
                if c.page_number
                else f"Slide {c.slide_number}"
                if c.slide_number
                else f"Timestamp {c.timestamp_start}-{c.timestamp_end}"
                if c.timestamp_start
                else "Section"
            )
            context_parts.append(
                f"[{c.citation_label} - Source: {c.document_name} ({loc})]:\n{c.snippet}\n"
            )

        context_str = "\n".join(context_parts)
        prompt = (
            f"You are a friendly, encouraging, and clear AI Study Tutor.\n"
            f"A student has uploaded their study material and asked you a question.\n"
            f"YOUR GOAL: Answer the question using SIMPLE, CLEAR, EASY-TO-UNDERSTAND words that any student can immediately understand.\n\n"
            f"IMPORTANT TEACHING RULES:\n"
            f"1. Explain in plain, friendly language. Avoid unnecessary or confusing technical jargon. If a difficult term must be used, explain it simply using a relatable real-world example or analogy.\n"
            f"2. Structure your answer with clear, bite-sized bullet points or steps so it is easy to read and remember.\n"
            f"3. Base your facts strictly on the provided study material excerpts below.\n"
            f"4. Cite the exact source tags provided (e.g. {citations[0].citation_label}).\n"
            f"5. If the uploaded material does not contain the answer, politely and simply let the student know: 'I couldn't find this specific detail in your uploaded notes. Would you like to upload more pages or ask about what is covered?'\n"
            f"6. STRICT ENGLISH REQUIREMENT: Formulate your answer, explanations, steps, and citations strictly in fluent, clear English. Even if the student's question is typed in another language or the study materials cite non-English words, always teach and answer strictly in English.\n\n"
            f"STUDY MATERIAL EXCERPTS:\n{context_str}\n\n"
            f"STUDENT QUESTION: {query}\n\n"
            f"SIMPLE & CLEAR EXPLANATION (In English):"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text.strip()

        return ""

    @classmethod
    def _synthesize_local_grounded_answer(
        cls, query: str, citations: List[SourceCitation]
    ) -> str:
        """
        Synthesize a simple, easy-to-understand educational answer directly from top retrieved chunks.
        """
        primary = citations[0]
        supporting = citations[1:] if len(citations) > 1 else []

        raw_snippet = primary.snippet.strip("...")
        # Break snippet into clean sentences
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", raw_snippet) if len(s.strip()) > 10]
        main_idea = sentences[0] if sentences else raw_snippet
        extra_detail = " ".join(sentences[1:3]) if len(sentences) > 1 else ""

        paragraphs = []

        # 1. Simple explanation header
        paragraphs.append(
            f"### 💡 Simple Explanation\n\n"
            f"Here is what your uploaded material in **{primary.document_name}** {primary.citation_label} explains:\n\n"
            f"**Key Point:** {main_idea}\n\n"
            f"{extra_detail}"
        )

        # 2. What this means in plain words
        paragraphs.append(
            f"**In simple words:** This concept is essential for your understanding of this topic. "
            f"Focus on how it connects to the main ideas in your chapter."
        )

        # 3. Additional notes from uploaded materials
        if supporting:
            paragraphs.append("#### 📌 Key Details from Your Notes:")
            for sup in supporting[:2]:
                loc_desc = (
                    f"Page {sup.page_number}"
                    if sup.page_number
                    else f"Slide {sup.slide_number}"
                    if sup.slide_number
                    else f"Timestamp {sup.timestamp_start}\u2013{sup.timestamp_end}"
                    if sup.timestamp_start
                    else sup.file_type.upper()
                )
                paragraphs.append(
                    f"- **{sup.document_name}** ({loc_desc}) {sup.citation_label}: "
                    f"{sup.snippet.strip('...')}"
                )

        # 4. Sources consulted
        paragraphs.append("\n---\n*📚 Grounded in your uploaded notes:*")
        for c in citations[:3]:
            loc = (
                f"Page {c.page_number}"
                if c.page_number
                else f"Slide {c.slide_number}"
                if c.slide_number
                else f"Time {c.timestamp_start}\u2013{c.timestamp_end}"
                if c.timestamp_start
                else "Text"
            )
            paragraphs.append(
                f"- `{c.citation_label}`: **{c.document_name}** ({loc})"
            )

        return "\n\n".join(paragraphs)
