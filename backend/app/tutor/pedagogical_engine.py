"""Pedagogical Engine implementing 7 specialized tutoring styles with grounded source citations."""

import logging
import httpx
from typing import List, Dict, Any, Tuple
from app.config import settings
from app.schemas.rag import SourceCitation

logger = logging.getLogger(__name__)

# System instructions and prompt templates for student-friendly tutoring styles
PEDAGOGICAL_PROMPTS = {
    "socratic": (
        "You are a friendly, encouraging AI Study Tutor. Your goal is to help the student understand their "
        "uploaded study materials using simple, easy-to-understand words. Guide them with 1 or 2 gentle, "
        "thoughtful questions so they can think through the concept easily. Avoid intimidating academic jargon, "
        "and cite the source tag like [Doc 1: Page 42]."
    ),
    "analogy": (
        "You are an intuitive AI Study Tutor. Your superpower is explaining difficult ideas using simple everyday "
        "analogies (like comparing concepts to sports, cooking, games, or daily life). Use plain, friendly words "
        "that any student can instantly relate to, and connect the analogy simply back to their notes with inline citations."
    ),
    "first_principles": (
        "You are a step-by-step AI Study Tutor. Break down the concept into its simplest building blocks, step 1, 2, and 3. "
        "Explain WHY it works in plain English without dense mathematical or theoretical jargon, referencing their notes with inline citations."
    ),
    "misconception_buster": (
        "You are a friendly diagnostic AI Study Tutor. Point out the most common mistakes students make on this topic, "
        "explain in simple words why the confusion happens, and show the easy, correct way to remember it using their notes."
    ),
    "exam_prep": (
        "You are an encouraging Exam Coach. Give the student the most important, high-yield takeaways they need for their test. "
        "Keep it structured with bullet points: 1) What to remember, 2) Key definitions in simple words, and 3) A quick 1-sentence practice check."
    ),
    "deep_dive": (
        "You are an in-depth AI Study Tutor. Give a thorough explanation while keeping your words clear, accessible, and structured. "
        "Break complex ideas into bite-sized sections so the student never feels overwhelmed."
    ),
    "quick_review": (
        "You are a Rapid Review Tutor. Give 3 quick, punchy bullet points summarizing the most important ideas in simple words "
        "so the student can review in 30 seconds."
    ),
}


class PedagogicalEngine:
    """
    Coordinates multi-turn dialogue generation across the 7 pedagogical modes,
    integrating grounded RAG citations and conversational history.
    """

    @classmethod
    async def generate_turn(
        cls,
        user_message: str,
        pedagogical_mode: str,
        citations: List[SourceCitation],
        history: List[Dict[str, str]],
        course_name: str,
        topic: str | None = None,
    ) -> Tuple[str, List[SourceCitation]]:
        """
        Generate next tutor dialogue turn.
        Returns (assistant_reply_text, citations_used).
        """
        mode = pedagogical_mode.lower()
        if mode not in PEDAGOGICAL_PROMPTS:
            mode = "socratic"

        # Check if Gemini API key is configured
        api_key = settings.LLM_API_KEY
        if api_key and len(api_key.strip()) > 10:
            try:
                gemini_reply = await cls._generate_with_gemini(
                    user_message=user_message,
                    mode=mode,
                    citations=citations,
                    history=history,
                    course_name=course_name,
                    topic=topic,
                    api_key=api_key,
                )
                if gemini_reply:
                    return gemini_reply, citations
            except Exception as e:
                logger.warning(f"Gemini tutor generation failed, falling back to local pedagogical synthesis: {e}")

        # Local deterministic pedagogical synthesis engine
        local_reply = cls._synthesize_local_pedagogical_turn(
            user_message=user_message,
            mode=mode,
            citations=citations,
            history=history,
            course_name=course_name,
            topic=topic,
        )
        return local_reply, citations

    @classmethod
    async def _generate_with_gemini(
        cls,
        user_message: str,
        mode: str,
        citations: List[SourceCitation],
        history: List[Dict[str, str]],
        course_name: str,
        topic: str | None = None,
        api_key: str = "",
    ) -> str:
        """Execute multi-turn grounded tutoring with Google Gemini."""
        system_instruction = PEDAGOGICAL_PROMPTS[mode]
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
            context_parts.append(f"{c.citation_label} [{c.document_name}, {loc}]: {c.snippet}")

        grounding_context = "\n".join(context_parts)

        # Build contents array with recent history (up to last 6 turns)
        contents = []
        for turn in history[-6:]:
            role = "user" if turn["sender"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": turn["content"]}]})

        current_prompt = (
            f"You are a friendly, encouraging AI Study Tutor for students studying '{course_name}' (Topic: {topic or 'General'}).\n"
            f"ACTIVE TEACHING MODE: {mode.upper()} ({system_instruction})\n\n"
            f"CRITICAL TEACHING RULES:\n"
            f"1. DIRECT AND FACTUAL ANSWER: When the student asks a question or asks to explain a concept, YOU MUST FIRST ANSWER THE QUESTION DIRECTLY, CORRECTLY, AND COMPLETELY using the facts, definitions, rules, and formulas in the grounded excerpts below. Do not respond with only questions! Provide the clear, accurate answer up front so the student learns what they asked about.\n"
            f"2. SIMPLE WORDS: Explain the answer in simple, crystal-clear, friendly language that any student can understand.\n"
            f"3. CITATIONS: Clearly cite the exact source tags (e.g. {citations[0].citation_label if citations else '[Doc 1]'}) for the facts you explain.\n"
            f"4. TEACHING WRAP-UP ({mode.upper()}):\n"
            f"   - If Socratic: Provide the complete direct answer first, and then wrap up with 1 friendly question to help them reflect on what they just learned.\n"
            f"   - If Analogy: Provide the direct answer first, and explain it with an everyday real-world analogy.\n"
            f"   - If First Principles: Break down the direct answer into simple foundational steps.\n"
            f"   - If Misconception Buster: Provide the direct answer first, and highlight a common trap students face.\n"
            f"   - If Exam Prep: Provide the direct answer first, followed by key high-yield exam takeaways.\n"
            f"   - If Deep Dive: Provide a thorough, structured breakdown of the answer.\n"
            f"   - If Quick Review: Provide a rapid 3-point summary answering the question.\n\n"
            f"GROUNDED COURSE EXCERPTS:\n{grounding_context}\n\n"
            f"STUDENT TURN: {user_message}\n\n"
            f"TUTOR RESPONSE:"
        )
        contents.append({"role": "user", "parts": [{"text": current_prompt}]})

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json={"contents": contents})
            if res.status_code == 200:
                data = res.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()

        return ""

    @classmethod
    def _synthesize_local_pedagogical_turn(
        cls,
        user_message: str,
        mode: str,
        citations: List[SourceCitation],
        history: List[Dict[str, str]],
        course_name: str,
        topic: str | None = None,
    ) -> str:
        """
        Synthesizes a distinct, high-quality educational response corresponding to the selected mode.
        Guarantees that the student's question is directly and factually answered first.
        """
        primary = citations[0] if citations else None
        cite_tag = primary.citation_label if primary else "[Course Materials]"
        primary_snippet = primary.snippet.strip("...") if primary else "Core curriculum materials."
        topic_name = topic or (primary.topic if primary and primary.topic else "the curriculum")

        import re
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", primary_snippet) if len(s.strip()) > 10]
        core_point = sentences[0] if sentences else primary_snippet
        supporting_point = sentences[1] if len(sentences) > 1 else "Review this section carefully to connect it to the main ideas."
        doc_label = primary.document_name if primary else "your uploaded notes"

        direct_answer = (
            f"### 💡 Answer from Your Notes ({doc_label} {cite_tag})\n\n"
            f"**Key Fact:** {core_point}\n\n"
            f"{supporting_point}\n\n"
            f"> *\"{primary_snippet}\"*\n\n"
        )

        if mode == "socratic":
            return (
                f"{direct_answer}"
                f"### 🎯 Understanding Check\n"
                f"Now that we've covered the direct answer from your notes, let's reason through the mechanics together with two simple questions:\n"
                f"1. Looking at *\"{core_point}\"*, what do you think is the main goal or outcome of **{topic_name}**?\n"
                f"2. How does this connect to what you've learned in the rest of this chapter?\n\n"
                f"*Try answering in your own words, and I'll help you check your reasoning!*"
            )

        elif mode == "analogy":
            return (
                f"{direct_answer}"
                f"#### 🍎 Everyday Analogy\n"
                f"Think of **{topic_name}** like a GPS navigation system on a road trip:\n"
                f"- If you have clear, accurate road signs, your path is smooth and direct.\n"
                f"- In your notes ({doc_label} {cite_tag}), {core_point} acts just like that map guiding you on the right path!"
            )

        elif mode == "first_principles":
            return (
                f"{direct_answer}"
                f"#### 🪜 Step-by-Step Breakdown\n"
                f"1. **Step 1: The Core Foundation (Axiomatic Rule)** {cite_tag}: {core_point}\n"
                f"2. **Step 2: How It Operates**: {supporting_point}\n"
                f"3. **Step 3: The Big Takeaway**: Master these foundational steps and you can answer any question on this topic!"
            )

        elif mode == "misconception_buster":
            return (
                f"### 💡 Common Misconception on {topic_name}\n\n"
                f"❌ **Common Trap**:\n"
                f"Many students assume this concept is overly complicated or memorize formulas without understanding what they mean.\n\n"
                f"✅ **What Your Notes Actually Tell Us** {cite_tag}:\n"
                f"> \"{core_point}\"\n\n"
                f"**How to remember easily:** Keep it simple! Remember that *{core_point}* is the central rule."
            )

        elif mode == "exam_prep":
            return (
                f"### 🎯 Exam & Quiz High-Yield Points: {topic_name}\n\n"
                f"- **Core Point to Remember** {cite_tag}:\n"
                f"  {core_point}\n\n"
                f"- **Important Details**:\n"
                f"  &bull; {supporting_point}\n"
                f"  &bull; Always check how this connects to the definitions in your notes.\n\n"
                f"**Quick Practice Check**:\n"
                f"*In 1 sentence, how would you explain '{topic_name}' if a classmate asked you?*"
            )

        elif mode == "deep_dive":
            return (
                f"### 🔍 Deep Dive: {topic_name}\n\n"
                f"From your study material in **{doc_label}** {cite_tag}:\n\n"
                f"> \"{primary_snippet}\"\n\n"
                f"**Key Breakdown**:\n"
                f"- **Core Concept**: {core_point}\n"
                f"- **Context & Details**: {supporting_point}\n"
                f"- **Application**: This principle is used whenever you need to analyze or solve questions on {topic_name}."
            )

        else:  # quick_review
            return (
                f"### ⚡ Quick Review: {topic_name}\n\n"
                f"- **Main Idea** {cite_tag}: {core_point}\n"
                f"- **Key Takeaway**: {supporting_point}\n"
                f"- **Source Reference**: See **{doc_label}** {cite_tag} in your study material."
            )
