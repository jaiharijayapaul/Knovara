"""Intelligent topic and curriculum concept extraction from live document content."""

import re
import json
import logging
from typing import List, Dict, Optional
import httpx
from app.config import settings

logger = logging.getLogger("knovara.topic_extractor")


class TopicExtractor:
    """
    Extracts curriculum topics and key concepts from live educational documents.
    Uses Gemini API if available, with intelligent deterministic linguistic fallback.
    """

    @classmethod
    async def extract_topics(
        cls,
        text_samples: List[str],
        course_name: str,
        subject: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """
        Extract 3 to 6 structured topics with name and description from raw text chunks.
        """
        combined_text = "\n\n".join(text_samples[:10])[:4000]

        # 1. Attempt LLM extraction if key configured
        api_key = getattr(settings, "GEMINI_API_KEY", "") or getattr(settings, "LLM_API_KEY", "")
        if api_key and api_key != "mock_gemini_key_for_testing_only" and len(api_key) > 20 and combined_text.strip():
            try:
                llm_topics = await cls._extract_with_gemini(combined_text, course_name, api_key)
                if llm_topics and len(llm_topics) >= 2:
                    return llm_topics
            except Exception as e:
                logger.warning(f"Gemini topic extraction error: {e}, falling back to local extraction")

        # 2. Local deterministic extraction
        return cls._extract_local_topics(combined_text, course_name)

    @classmethod
    async def _extract_with_gemini(
        cls, text: str, course_name: str, api_key: str
    ) -> List[Dict[str, str]]:
        prompt = (
            f"You are a university curriculum director. Analyze the following excerpts from educational materials "
            f"uploaded for the course '{course_name}'.\n\n"
            f"Identify 3 to 6 distinct, foundational syllabus topics/modules taught in these materials.\n"
            f"Return ONLY a JSON array of objects with 'name' (2-4 words title) and 'description' (1 concise sentence).\n"
            f"Example: [{{\"name\": \"Binary Search Trees\", \"description\": \"Tree traversal, balance criteria, and logarithmic search complexity.\"}}]\n\n"
            f"Material Excerpts:\n{text}"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"response_mime_type": "application/json"}
            })
            if res.status_code == 200:
                data = res.json()
                raw_json = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                parsed = json.loads(raw_json)
                if isinstance(parsed, list):
                    clean_results = []
                    for item in parsed:
                        if isinstance(item, dict) and "name" in item:
                            clean_results.append({
                                "name": str(item["name"]).strip(),
                                "description": str(item.get("description", f"Key principles and applications of {item['name']}.")).strip(),
                            })
                    return clean_results
        return []

    @classmethod
    def _extract_local_topics(cls, text: str, course_name: str) -> List[Dict[str, str]]:
        """Heuristic topic extraction from headings, chapters, and key phrases."""
        found_topics: List[Dict[str, str]] = []
        seen_names = set()

        # Regex patterns for chapters, lectures, and headings
        heading_patterns = [
            r"(?im)^(?:chapter|module|unit|lecture|section)\s*(?:\d+|[ivxlcdm]+)?\s*[:\-–]?\s*([A-Za-z0-9\s,&]{3,40})$",
            r"(?im)^\d+\.\s+([A-Z][A-Za-z0-9\s,&]{3,35})$",
            r"(?im)^##\s+([A-Za-z0-9\s,&]{3,35})$",
        ]

        for pat in heading_patterns:
            matches = re.findall(pat, text)
            for m in matches:
                name = m.strip()
                # Exclude trivial or generic matches
                if len(name) >= 3 and name.lower() not in seen_names and name.lower() not in ["introduction", "conclusion", "references", "overview"]:
                    seen_names.add(name.lower())
                    found_topics.append({
                        "name": name,
                        "description": f"Curriculum module covering core principles of {name}.",
                    })
                if len(found_topics) >= 6:
                    break
            if len(found_topics) >= 4:
                break

        # If not enough headings found, search for common technical title phrases
        if len(found_topics) < 3:
            # Look for lines with 2-4 capitalized words that look like slide titles
            candidate_lines = [
                line.strip() for line in text.split("\n")
                if 4 <= len(line.strip()) <= 45
                and not line.strip().endswith((".", ";", ":", ","))
                and line.strip()[0].isupper()
            ]
            for cl in candidate_lines:
                clean_cl = re.sub(r"^[0-9\.\-\*\#\s]+", "", cl).strip()
                if len(clean_cl) >= 4 and clean_cl.lower() not in seen_names and clean_cl.lower() not in ["slide", "notes", "agenda"]:
                    seen_names.add(clean_cl.lower())
                    found_topics.append({
                        "name": clean_cl,
                        "description": f"Core theoretical and practical aspects of {clean_cl}.",
                    })
                if len(found_topics) >= 5:
                    break

        # Fallback to course-scoped foundational topics if document text is unstructured
        if len(found_topics) < 2:
            base_name = course_name.strip() if course_name else "Course Study"
            found_topics = [
                {
                    "name": f"{base_name} Foundations",
                    "description": f"Core definitions, fundamental theorems, and baseline principles of {base_name}.",
                },
                {
                    "name": f"{base_name} Core Methodologies",
                    "description": f"Essential algorithms, analytical models, and operational frameworks for {base_name}.",
                },
                {
                    "name": f"{base_name} Practical Applications",
                    "description": f"Real-world case implementations, problem solving, and evaluation in {base_name}.",
                },
            ]

        return found_topics[:6]
