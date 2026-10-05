"""Semantic chunking strategy with citation preservation and topic tagging."""

import re
from typing import List, Dict, Any, Optional


class SemanticChunker:
    """
    Chunks structured learning material into citation-aligned retrieval passages.
    Preserves document, page, slide, or timestamp ranges.
    """

    DEFAULT_CHUNK_SIZE = 500  # characters
    DEFAULT_CHUNK_OVERLAP = 60

    @classmethod
    def chunk_extracted_units(
        cls,
        extracted_units: List[Dict[str, Any]],
        course_topics: Optional[List[str]] = None,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    ) -> List[Dict[str, Any]]:
        """
        Split extracted pages/slides/transcripts into semantic chunks
        while maintaining source attribution metadata.
        """
        chunks = []
        global_index = 0

        for unit in extracted_units:
            raw_text = unit.get("content", "").strip()
            if not raw_text:
                continue

            page_number = unit.get("page_number")
            slide_number = unit.get("slide_number")
            timestamp_start = unit.get("timestamp_start")
            timestamp_end = unit.get("timestamp_end")

            # If text is small enough, keep as a single chunk
            if len(raw_text) <= chunk_size:
                topic = cls._detect_topic(raw_text, course_topics)
                chunks.append({
                    "chunk_index": global_index,
                    "content": raw_text,
                    "page_number": page_number,
                    "slide_number": slide_number,
                    "timestamp_start": timestamp_start,
                    "timestamp_end": timestamp_end,
                    "topic": topic,
                })
                global_index += 1
                continue

            # Split by paragraph or sentences first to avoid arbitrary breaks
            paragraphs = [p.strip() for p in raw_text.split("\n") if p.strip()]
            current_buffer = ""

            for p in paragraphs:
                if len(current_buffer) + len(p) + 1 <= chunk_size:
                    current_buffer = f"{current_buffer}\n{p}".strip()
                else:
                    if current_buffer:
                        topic = cls._detect_topic(current_buffer, course_topics)
                        chunks.append({
                            "chunk_index": global_index,
                            "content": current_buffer,
                            "page_number": page_number,
                            "slide_number": slide_number,
                            "timestamp_start": timestamp_start,
                            "timestamp_end": timestamp_end,
                            "topic": topic,
                        })
                        global_index += 1
                        # Retain overlap from end of current buffer
                        current_buffer = current_buffer[-chunk_overlap:] + " " + p
                    else:
                        # Single paragraph exceeds chunk size -> split by sentences
                        sentences = re.split(r"(?<=[.!?])\s+", p)
                        for s in sentences:
                            if len(current_buffer) + len(s) + 1 <= chunk_size:
                                current_buffer = f"{current_buffer} {s}".strip()
                            else:
                                if current_buffer:
                                    topic = cls._detect_topic(current_buffer, course_topics)
                                    chunks.append({
                                        "chunk_index": global_index,
                                        "content": current_buffer,
                                        "page_number": page_number,
                                        "slide_number": slide_number,
                                        "timestamp_start": timestamp_start,
                                        "timestamp_end": timestamp_end,
                                        "topic": topic,
                                    })
                                    global_index += 1
                                current_buffer = s

            if current_buffer:
                topic = cls._detect_topic(current_buffer, course_topics)
                chunks.append({
                    "chunk_index": global_index,
                    "content": current_buffer,
                    "page_number": page_number,
                    "slide_number": slide_number,
                    "timestamp_start": timestamp_start,
                    "timestamp_end": timestamp_end,
                    "topic": topic,
                })
                global_index += 1

        return chunks

    @staticmethod
    def _detect_topic(text: str, course_topics: Optional[List[str]]) -> Optional[str]:
        """Auto-associate chunk with a curriculum topic if keyword matches."""
        if not course_topics:
            return None
        text_lower = text.lower()
        for topic in course_topics:
            if topic.lower() in text_lower:
                return topic
        return None
