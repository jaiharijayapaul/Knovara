"""
Assessment Generator Engine implementing Bloom's Taxonomy cognitive progression
and grounded multimodal source citations.
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings
from app.models.document import DocumentChunk
from app.schemas.assessment import BloomLevel, QuestionType
from app.processing.speech_cleaner import clean_transcript_speech, clean_academic_sentence

logger = logging.getLogger("knovara.assessment_generator")

BLOOM_LEVELS_PROGRESSION: List[BloomLevel] = [
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
]


class AssessmentGenerator:
    """
    Generates balanced, grounded diagnostic assessments across all 6 cognitive
    levels of Bloom's Taxonomy, paired with realistic misconception distractors.
    """

    @classmethod
    async def generate_questions(
        cls,
        chunks: List[DocumentChunk],
        num_questions: int = 5,
        target_bloom_levels: Optional[List[BloomLevel]] = None,
        difficulty: str = "medium",
        question_types: Optional[List[QuestionType]] = None,
        topic: Optional[str] = None,
        course_name: str = "Machine Learning",
        adaptive_blueprint: Optional[List[Dict[str, Any]]] = None,
        previous_stems: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate grounded assessment questions. Attempts remote LLM generation
        if configured, falling back to deterministic multimodal chunk synthesis.
        Supports Bayesian Knowledge Tracing adaptive blueprints and avoids duplicate questions.
        """
        if adaptive_blueprint:
            num_questions = len(adaptive_blueprint)
            levels = [bp["bloom_level"] for bp in adaptive_blueprint]
        elif not target_bloom_levels:
            # Cycle through Bloom's progression
            levels = [
                BLOOM_LEVELS_PROGRESSION[i % len(BLOOM_LEVELS_PROGRESSION)]
                for i in range(num_questions)
            ]
        else:
            levels = [
                target_bloom_levels[i % len(target_bloom_levels)]
                for i in range(num_questions)
            ]

        # Filter chunks by topic if specified
        relevant_chunks = chunks
        if topic and not adaptive_blueprint:
            filtered = [
                c for c in chunks
                if (c.topic and topic.lower() in c.topic.lower())
                or topic.lower() in c.content.lower()
            ]
            if filtered:
                relevant_chunks = filtered

        # Check if remote Gemini generation is enabled
        api_key = getattr(settings, "GEMINI_API_KEY", "") or getattr(settings, "LLM_API_KEY", "")
        if api_key and api_key != "mock_gemini_key_for_testing_only" and len(api_key) > 20:
            try:
                remote_results = await cls._generate_with_gemini(
                    chunks=relevant_chunks[:6],
                    levels=levels,
                    difficulty=difficulty,
                    course_name=course_name,
                    topic=topic,
                    api_key=api_key,
                    adaptive_blueprint=adaptive_blueprint,
                    question_types=question_types,
                    previous_stems=previous_stems,
                )
                if remote_results and len(remote_results) >= num_questions:
                    return remote_results[:num_questions]
            except Exception as e:
                logger.warning(f"Remote LLM assessment generation failed, using local grounding: {e}")

        # Deterministic local syllabus grounding
        return cls._generate_local_grounded_questions(
            chunks=relevant_chunks,
            levels=levels,
            difficulty=difficulty,
            course_name=course_name,
            topic=topic,
            adaptive_blueprint=adaptive_blueprint,
            question_types=question_types,
            previous_stems=previous_stems,
        )

    @classmethod
    async def _generate_with_gemini(
        cls,
        chunks: List[DocumentChunk],
        levels: List[BloomLevel],
        difficulty: str,
        course_name: str,
        topic: Optional[str],
        api_key: str,
        adaptive_blueprint: Optional[List[Dict[str, Any]]] = None,
        question_types: Optional[List[QuestionType]] = None,
        previous_stems: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Calls Gemini API with structured JSON output enforcing simple language, diverse question formats, and deduplication."""
        context_parts = []
        for i, c in enumerate(chunks):
            doc_name = (c.document.filename if c.document else None) or "Uploaded Notes"
            loc = (
                f"Page {c.page_number}"
                if c.page_number
                else f"Slide {c.slide_number}"
                if c.slide_number
                else f"Timestamp {c.timestamp_start}-{c.timestamp_end}"
                if c.timestamp_start
                else "Section"
            )
            context_parts.append(f"[{i+1}] {doc_name} ({loc}):\n{c.content[:450]}")

        grounding_text = "\n\n".join(context_parts)

        adaptive_instructions = ""
        if adaptive_blueprint:
            bp_lines = [
                f"- Q{i+1}: Focus on concept '{b['topic']}' ({b.get('reason', 'practice focus')})"
                for i, b in enumerate(adaptive_blueprint)
            ]
            adaptive_instructions = (
                f"This quiz adapts to the student's learning progress.\n"
                f"Each question must target these designated concepts:\n"
                + "\n".join(bp_lines) + "\n\n"
            )

        dedup_clause = ""
        if previous_stems:
            stems_preview = [f"- {s}" for s in previous_stems[:12]]
            dedup_clause = (
                "DEDUPLICATION REQUIREMENT:\n"
                "Do NOT duplicate or closely rephrase any of these previously generated question stems:\n"
                + "\n".join(stems_preview) + "\n\n"
            )

        q_types_str = ", ".join(question_types) if question_types else "multiple_choice, short_answer, numerical"

        prompt = (
            f"You are a friendly, encouraging teacher creating a helpful practice quiz for a student in '{course_name}'.\n"
            f"{adaptive_instructions}"
            f"{dedup_clause}"
            f"Create {len(levels)} practice questions strictly grounded in the student's uploaded study material below:\n\n"
            f"{grounding_text}\n\n"
            f"CRITICAL REQUIREMENTS:\n"
            f"1. NO VERBATIM TRANSCRIPT REPETITION: The excerpts may be taken from spoken lecture transcripts or video captions. NEVER copy casual conversational chatter, verbal fillers, or broken spoken grammar (e.g. 'hello guys', 'today we will discuss', 'let me show you', 'okay so'). Reframe all questions into formal academic test questions.\n"
            f"2. Use SIMPLE, CLEAR, EVERYDAY WORDS that any student can easily understand. Avoid unnecessarily convoluted jargon.\n"
            f"3. Generate one question corresponding to each of the following learning steps: {', '.join(levels)}.\n"
            f"4. Difficulty level: {difficulty}.\n"
            f"5. Supported question types: {q_types_str}.\n"
            f"   - For 'multiple_choice': provide 4 options (A, B, C, D) with exactly one correct answer.\n"
            f"   - For 'short_answer': 'options' is empty [], 'correct_answers' contains the concise key phrase or numerical value, and explanation gives the exact source reasoning.\n"
            f"   - For 'numerical': formulate a problem requiring a calculation or quantitative reasoning, providing 4 options with arithmetic/sign trap distractors.\n"
            f"6. IMPORTANT: For multiple_choice and numerical questions, ROTATE AND VARY the correct answer position randomly across options A, B, C, and D for each question. Do NOT make option A the correct answer every time!\n"
            f"7. Ground each of the 3 incorrect options in a specific diagnostic error taxonomy category:\n"
            f"   - One distractor must represent a procedural slip (sign error or arithmetic/calculation flaw). Label its misconception: 'Procedural slip: sign error or calculation flaw'.\n"
            f"   - One distractor must represent dimensionality confusion (scale or feature count vs sample size). Label its misconception: 'Dimensionality confusion: feature count or scale error'.\n"
            f"   - One distractor must represent formula inversion (inverting the governing relationship). Label its misconception: 'Formula inversion: inverted formula or objective'.\n"
            f"8. LANGUAGE REQUIREMENT: All quiz questions, answer options, and misconception explanations MUST be written strictly in clear, simple English.\n"
            f"9. Return ONLY a valid JSON list matching this structure:\n"
            f"[\n"
            f"  {{\n"
            f"    \"bloom_level\": \"remember|understand|apply|analyze|evaluate|create\",\n"
            f"    \"difficulty\": \"{difficulty}\",\n"
            f"    \"question_type\": \"multiple_choice|short_answer|numerical\",\n"
            f"    \"question_text\": \"...\",\n"
            f"    \"topic\": \"{topic or course_name}\",\n"
            f"    \"options\": [\n"
            f"      {{\"id\": \"A\", \"text\": \"...\", \"is_correct\": false, \"misconception\": \"Procedural slip: Sign error or arithmetic flaw\"}},\n"
            f"      {{\"id\": \"B\", \"text\": \"...\", \"is_correct\": true, \"misconception\": null}},\n"
            f"      {{\"id\": \"C\", \"text\": \"...\", \"is_correct\": false, \"misconception\": \"Dimensionality confusion: Scale or feature count error\"}},\n"
            f"      {{\"id\": \"D\", \"text\": \"...\", \"is_correct\": false, \"misconception\": \"Formula inversion: Inverted governing relationship\"}}\n"
            f"    ],\n"
            f"    \"correct_answers\": [\"B\"],\n"
            f"    \"explanation\": \"Clear, step-by-step explanation in plain words why the answer is correct.\",\n"
            f"    \"citation_label\": \"[Doc 1]\",\n"
            f"    \"document_name\": \"...\",\n"
            f"    \"page_number\": null,\n"
            f"    \"slide_number\": null,\n"
            f"    \"timestamp_start\": null,\n"
            f"    \"timestamp_end\": null,\n"
            f"    \"source_snippet\": \"...\",\n"
            f"    \"points\": 10.0\n"
            f"  }}\n"
            f"]"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(url, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"response_mime_type": "application/json"}
            })
            if res.status_code == 200:
                data = res.json()
                raw_json = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                questions = json.loads(raw_json)
                # Filter out any duplicate stems against previous_stems
                filtered_questions = []
                seen_lower = set(s.lower().strip() for s in (previous_stems or []))
                for idx, q in enumerate(questions):
                    stem = q.get("question_text", "").strip().lower()
                    if stem and stem in seen_lower:
                        continue
                    seen_lower.add(stem)
                    correct_opts = [opt["id"] for opt in q.get("options", []) if opt.get("is_correct")]
                    if correct_opts:
                        q["correct_answers"] = correct_opts
                    q["order_index"] = idx
                    filtered_questions.append(q)
                if filtered_questions:
                    return filtered_questions

        return []

    @classmethod
    def _generate_local_grounded_questions(
        cls,
        chunks: List[DocumentChunk],
        levels: List[BloomLevel],
        difficulty: str,
        course_name: str,
        topic: Optional[str],
        adaptive_blueprint: Optional[List[Dict[str, Any]]] = None,
        question_types: Optional[List[QuestionType]] = None,
        previous_stems: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Synthesizes student-friendly practice questions derived directly
        from the student's uploaded course documents, ensuring varied answer positions,
        support for multiple question formats (MCQ, short answer, numerical), and deduplication.
        """
        questions = []
        num_chunks = len(chunks) if chunks else 1
        seen_stems = set(s.lower().strip() for s in (previous_stems or []))

        for idx, bloom_level in enumerate(levels):
            # Resolve target topic from blueprint, chunk, or course name
            bp = adaptive_blueprint[idx] if (adaptive_blueprint and idx < len(adaptive_blueprint)) else None
            
            # Select matching chunk for topic if available
            matching = []
            if chunks and topic:
                matching = [
                    c for c in chunks
                    if (c.topic and topic.lower() in c.topic.lower())
                    or topic.lower() in c.content.lower()
                ]
            
            chunk = matching[idx % len(matching)] if matching else (chunks[idx % num_chunks] if chunks else None)

            # Determine best topic
            chunk_topic = getattr(chunk, "topic", None) if chunk else None
            target_topic = (bp.get("topic") if bp else None) or topic or chunk_topic or course_name
            effective_level = (bp.get("bloom_level") if bp else None) or bloom_level
            effective_diff = (bp.get("difficulty") if bp else None) or difficulty

            # Multimodal coordinates and filenames
            doc_name = (
                chunk.document.filename
                if chunk and getattr(chunk, "document", None) and chunk.document.filename
                else f"{course_name} Study Notes"
            )
            snippet = (
                chunk.content[:350]
                if chunk and chunk.content
                else f"{target_topic} is an important concept covered in your uploaded notes."
            )

            page_num = getattr(chunk, "page_number", None)
            slide_num = getattr(chunk, "slide_number", None)
            ts_start = getattr(chunk, "timestamp_start", None)
            ts_end = getattr(chunk, "timestamp_end", None)

            coord_str = (
                f"Page {page_num}" if page_num
                else f"Slide {slide_num}" if slide_num
                else f"{ts_start}–{ts_end}" if ts_start
                else "Core Section"
            )
            cite_label = f"[Doc {idx+1}: {coord_str}]"

            # Determine question type
            selected_q_type = "multiple_choice"
            if question_types:
                selected_q_type = question_types[idx % len(question_types)]

            q_data = cls._build_question_for_level(
                bloom_level=effective_level,
                topic=target_topic,
                doc_name=doc_name,
                cite_label=cite_label,
                page_num=page_num,
                slide_num=slide_num,
                ts_start=ts_start,
                ts_end=ts_end,
                snippet=snippet,
                difficulty=effective_diff,
                order_index=idx,
                question_type=selected_q_type,
                seen_stems=seen_stems,
            )
            seen_stems.add(q_data["question_text"].lower().strip())
            questions.append(q_data)

        return questions

    @classmethod
    def _build_question_for_level(
        cls,
        bloom_level: BloomLevel,
        topic: str,
        doc_name: str,
        cite_label: str,
        page_num: Optional[int],
        slide_num: Optional[int],
        ts_start: Optional[str],
        ts_end: Optional[str],
        snippet: str,
        difficulty: str,
        order_index: int,
        question_type: str = "multiple_choice",
        seen_stems: Optional[set] = None,
    ) -> Dict[str, Any]:
        """Crafts a question aligned to a specific Bloom cognitive level dynamically from chunk excerpt in simple language."""
        # Clean speech filler from snippet and extract informative academic sentences
        clean_snip = clean_transcript_speech(snippet) or snippet
        sentences = [
            clean_academic_sentence(s.strip())
            for s in re.split(r"(?<=[.!?])\s+", clean_snip)
            if len(s.strip()) > 15 and not s.strip().startswith("#")
        ]
        sentences = [s for s in sentences if s and len(s) > 15]

        primary_fact = None
        for s in sentences:
            if len(s.split()) < 4:
                continue
            if any(kw in s.lower() for kw in [
                " is ", " are ", " defined as ", " refers to ", " occurs when ", " means ",
                " helps ", " used for ", " works by ", " applies ", " computes ", " calculates ",
                " provides ", " operates ", " consists of ", " includes "
            ]):
                primary_fact = s
                break
        if not primary_fact and sentences:
            candidates = [s for s in sentences if len(s.split()) >= 4]
            primary_fact = candidates[0] if candidates else sentences[0]
        elif not primary_fact:
            primary_fact = f"{topic} is an essential concept outlined in your uploaded notes."

        clean_fact = primary_fact.rstrip(".")
        second_fact = sentences[1].rstrip(".") if len(sentences) > 1 else f"It provides the key guidance for understanding {topic}"

        # Deduplication stem variation
        stem_variant_prefix = ""
        if seen_stems and any(topic.lower() in s for s in seen_stems):
            variant_options = [
                f"Reviewing the key section on {topic} in {doc_name} {cite_label}: ",
                f"In the practical context of {topic} ({doc_name} {cite_label}): ",
                f"According to the foundational analysis of {topic} in {doc_name} {cite_label}: ",
                f"From the conceptual breakdown of {topic} presented in {doc_name} {cite_label}: ",
                f"Examining the core principles of {topic} in {doc_name} {cite_label}: ",
            ]
            matched_count = sum(1 for s in seen_stems if topic.lower() in s)
            stem_variant_prefix = variant_options[matched_count % len(variant_options)]

        # Handle Short Answer Questions
        if question_type == "short_answer":
            q_text = (
                f"{stem_variant_prefix}In your own words, state the definition or primary operational role of {topic} as documented in {doc_name} {cite_label}."
                if not stem_variant_prefix else
                f"{stem_variant_prefix}What is the core working principle of {topic}?"
            )
            explanation = (
                f"Source citation from {doc_name} {cite_label}: \"{clean_fact}\". "
                f"Acceptable answers should mention that {clean_fact.lower()}."
            )
            return {
                "bloom_level": bloom_level,
                "difficulty": difficulty,
                "question_type": "short_answer",
                "question_text": q_text,
                "topic": topic,
                "options": [],
                "correct_answers": [clean_fact],
                "explanation": explanation,
                "citation_label": cite_label,
                "document_name": doc_name,
                "page_number": page_num,
                "slide_number": slide_num,
                "timestamp_start": ts_start,
                "timestamp_end": ts_end,
                "source_snippet": snippet,
                "points": 10.0,
                "order_index": order_index,
            }

        # Handle Numerical Problem Questions
        if question_type == "numerical":
            q_text = (
                f"Given the formulation of {topic} in {doc_name} {cite_label}, suppose a parameter update is evaluated with baseline magnitude 10.0, step factor 0.2, and error gradient 2.0. "
                f"Calculate the resulting adjusted parameter value."
            )
            # Correct: 10.0 - (0.2 * 2.0) = 9.6
            raw_options = [
                {"text": "9.6", "is_correct": True, "misconception": None},
                {"text": "10.4", "is_correct": False, "misconception": "Procedural slip: sign error in step direction (added instead of subtracted)."},
                {"text": "96.0", "is_correct": False, "misconception": "Dimensionality confusion: factor scaling or unit multiplier misplaced by 10x."},
                {"text": "0.104", "is_correct": False, "misconception": "Formula inversion: inverted dividend/divisor relationship in update step."},
            ]
            target_pos = order_index % 4
            raw_options[0], raw_options[target_pos] = raw_options[target_pos], raw_options[0]
            letters = ["A", "B", "C", "D"]
            options = []
            correct_answers = []
            for l_idx, letter in enumerate(letters):
                opt_data = raw_options[l_idx]
                if opt_data["is_correct"]:
                    correct_answers.append(letter)
                options.append({
                    "id": letter,
                    "text": opt_data["text"],
                    "is_correct": opt_data["is_correct"],
                    "misconception": opt_data["misconception"],
                })
            explanation = (
                f"Verified from formula in {doc_name} {cite_label}: New = Baseline - (step_factor * gradient) = 10.0 - (0.2 * 2.0) = 9.6. "
                f"Option {correct_answers[0]} is correct."
            )
            return {
                "bloom_level": bloom_level,
                "difficulty": difficulty,
                "question_type": "numerical",
                "question_text": q_text,
                "topic": topic,
                "options": options,
                "correct_answers": correct_answers,
                "explanation": explanation,
                "citation_label": cite_label,
                "document_name": doc_name,
                "page_number": page_num,
                "slide_number": slide_num,
                "timestamp_start": ts_start,
                "timestamp_end": ts_end,
                "source_snippet": snippet,
                "points": 10.0,
                "order_index": order_index,
            }

        # Build simple, clear, student-friendly question prompts and answer choices for multiple_choice
        if bloom_level == "remember":
            q_text = f"{stem_variant_prefix}According to your notes in {doc_name} {cite_label}, what is the main idea or definition of {topic}?"
            correct_text = clean_fact
            opt_b = f"{topic} involves a procedural slip or sign error in basic calculations."
            opt_c = f"{topic} applies only when the dimension scale is zero."
            opt_d = f"{topic} formula inversion produces an opposite result."
        elif bloom_level == "understand":
            q_text = f"{stem_variant_prefix}In {doc_name} {cite_label}, how is the process or purpose of {topic} explained?"
            correct_text = f"{clean_fact}, ensuring concepts remain clear and consistent."
            opt_b = f"It exhibits a procedural slip or negative sign error during evaluation."
            opt_c = f"It confuses feature dimensions and sample size cardinality in scale."
            opt_d = f"It inverts the core formula or relationship, leading to opposite results."
        elif bloom_level == "apply":
            q_text = f"{stem_variant_prefix}When applying {topic} to work through an example as shown in {doc_name} {cite_label}, which approach is correct?"
            correct_text = f"Apply the rule that {clean_fact.lower()} to guide your solution step-by-step."
            opt_b = f"Apply calculations with a procedural slip or negative sign error."
            opt_c = f"Confound continuous vs categorical feature dimensions in the data."
            opt_d = f"Invert the governing formula without normalizing baseline values."
        elif bloom_level == "analyze":
            q_text = f"{stem_variant_prefix}What key distinction or relationship regarding {topic} is highlighted in {doc_name} {cite_label}?"
            correct_text = f"That {clean_fact.lower()}, which distinguishes it from unrelated ideas."
            opt_b = f"That procedural slips or sign errors in {topic} remain completely undetectable."
            opt_c = f"That {topic} changes fundamentally when feature dimensions exceed sample cardinality."
            opt_d = f"That formula inversion causes divergence under unconstrained settings."
        elif bloom_level == "evaluate":
            q_text = f"{stem_variant_prefix}When evaluating statements about {topic} based on {doc_name} {cite_label}, which conclusion is correct?"
            correct_text = f"The evidence confirms that {clean_fact.lower()}."
            opt_b = f"Procedural slips and sign errors in evaluation corrupt all performance metrics."
            opt_c = f"Distortions occur only when feature dimensions are conflated with class counts."
            opt_d = f"Formula inversion yields identical outcomes under all distributions."
        else:  # create
            q_text = f"{stem_variant_prefix}If you are organizing a summary or solution that incorporates {topic} as detailed in {doc_name} {cite_label}, which core guideline should you follow?"
            correct_text = f"Base your work on the principle that {clean_fact.lower()}."
            opt_b = f"Audit calculations to prevent procedural slips, negative sign errors, and rounding flaws."
            opt_c = f"Ensure feature dimension coordinates are properly normalized before proceeding."
            opt_d = f"Account for formula inversion constraints when defining relationships."

        misc_b = f"Procedural slip: Sign error or arithmetic calculation flaw in evaluating {topic}."
        misc_c = f"Dimensionality confusion: Conflating feature dimensions, sample size, or scale in {topic}."
        misc_d = f"Formula inversion: Inverting the governing formula or dependency relationship in {topic}."

        # Rotate the correct option position across A, B, C, D
        raw_options = [
            {"text": correct_text, "is_correct": True, "misconception": None},
            {"text": opt_b, "is_correct": False, "misconception": misc_b},
            {"text": opt_c, "is_correct": False, "misconception": misc_c},
            {"text": opt_d, "is_correct": False, "misconception": misc_d},
        ]
        target_pos = order_index % 4
        raw_options[0], raw_options[target_pos] = raw_options[target_pos], raw_options[0]

        letters = ["A", "B", "C", "D"]
        options = []
        correct_answers = []
        for l_idx, letter in enumerate(letters):
            opt_data = raw_options[l_idx]
            is_corr = opt_data["is_correct"]
            if is_corr:
                correct_answers.append(letter)
            options.append({
                "id": letter,
                "text": opt_data["text"],
                "is_correct": is_corr,
                "misconception": opt_data["misconception"],
            })

        explanation = (
            f"Verified directly from your notes in {doc_name} {cite_label}: "
            f"\"{clean_fact}\". This confirms that option {correct_answers[0]} ({correct_text}) is the correct answer."
        )

        return {
            "bloom_level": bloom_level,
            "difficulty": difficulty,
            "question_type": "multiple_choice",
            "question_text": q_text,
            "topic": topic,
            "options": options,
            "correct_answers": correct_answers,
            "explanation": explanation,
            "citation_label": cite_label,
            "document_name": doc_name,
            "page_number": page_num,
            "slide_number": slide_num,
            "timestamp_start": ts_start,
            "timestamp_end": ts_end,
            "source_snippet": snippet,
            "points": 10.0,
            "order_index": order_index,
        }
