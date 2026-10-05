"""Hybrid retrieval engine combining dense semantic search, sparse keyword overlap, and citation alignment."""

import re
import json
import logging
from typing import List, Optional, Tuple, Dict, Any
from app.rag.embeddings import EmbeddingEngine, STOP_WORDS
from app.models.document import DocumentChunk
from app.schemas.rag import SourceCitation

logger = logging.getLogger(__name__)


class HybridRetriever:
    """
    RAG retriever executing hybrid dense semantic search and sparse BM25/keyword scoring
    with exact multimodal citation coordinates.
    """

    @classmethod
    def _extract_snippet(cls, content: str, query_terms: List[str], max_chars: int = 1000) -> str:
        """Extract the most relevant excerpt snippet centered on query terms without cutting off vital details."""
        clean_content = content.strip()
        if len(clean_content) <= max_chars:
            return clean_content

        content_lower = clean_content.lower()
        best_pos = 0

        # Find position with highest term density
        for term in query_terms:
            pos = content_lower.find(term)
            if pos != -1:
                best_pos = pos
                break

        start = max(0, best_pos - 80)
        end = min(len(clean_content), start + max_chars)

        snippet = clean_content[start:end].strip()
        if start > 0:
            snippet = "..." + snippet
        if end < len(clean_content):
            snippet = snippet + "..."
        return snippet

    @classmethod
    def _format_citation_label(
        cls,
        doc_idx: int,
        filename: str,
        page_number: Optional[int],
        slide_number: Optional[int],
        timestamp_start: Optional[str],
        timestamp_end: Optional[str],
    ) -> str:
        """Construct user-friendly source citation label with multimodal coordinates."""
        if page_number is not None:
            return f"[Doc {doc_idx}: Page {page_number}]"
        elif slide_number is not None:
            return f"[Doc {doc_idx}: Slide {slide_number}]"
        elif timestamp_start and timestamp_end:
            return f"[Doc {doc_idx}: {timestamp_start}\u2013{timestamp_end}]"
        elif timestamp_start:
            return f"[Doc {doc_idx}: @{timestamp_start}]"
        else:
            return f"[Doc {doc_idx}: {filename[:20]}]"

    @classmethod
    def retrieve(
        cls,
        query: str,
        chunks: List[DocumentChunk],
        topic_filter: Optional[str] = None,
        top_k: int = 4,
    ) -> List[SourceCitation]:
        """
        Execute hybrid search across course chunks and return ranked source citations.
        """
        if not chunks:
            return []

        # 1. Query preprocessing with stop word removal
        query_vector = EmbeddingEngine.embed_text(query)
        all_terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
        query_terms = [t for t in all_terms if t not in STOP_WORDS]
        if not query_terms:
            query_terms = all_terms

        scored_candidates: List[Tuple[float, float, float, DocumentChunk]] = []

        for chunk in chunks:
            # Topic filtering if requested
            if topic_filter and chunk.topic:
                if topic_filter.lower() not in chunk.topic.lower():
                    continue

            # Load or compute chunk embedding
            chunk_vector = None
            if chunk.metadata_json:
                try:
                    meta = json.loads(chunk.metadata_json)
                    chunk_vector = meta.get("embedding")
                except Exception:
                    pass

            if not chunk_vector:
                chunk_vector = EmbeddingEngine.embed_text(chunk.content)

            # A. Dense Semantic Similarity
            semantic_score = EmbeddingEngine.cosine_similarity(query_vector, chunk_vector)

            # B. Sparse Keyword Overlap (Weighted by non-stopword presence)
            content_lower = chunk.content.lower()
            keyword_hits = sum(1 for term in query_terms if term in content_lower)
            # Bonus for exact query phrase match
            phrase_bonus = 0.25 if query.lower().strip() in content_lower else 0.0
            keyword_score = min(1.0, (keyword_hits / max(len(query_terms), 1)) + phrase_bonus)

            # C. Topic Relevance Alignment
            topic_boost = 0.0
            if chunk.topic:
                topic_lower = chunk.topic.lower()
                if any(term in topic_lower for term in query_terms):
                    topic_boost = 0.15

            # If no keywords matched and semantic score is negligible, don't hallucinate high hybrid score
            if keyword_hits == 0 and semantic_score < 0.10:
                hybrid_score = 0.0
            else:
                hybrid_score = round(
                    (0.55 * semantic_score) + (0.35 * keyword_score) + (0.10 * topic_boost),
                    4,
                )

            scored_candidates.append((hybrid_score, semantic_score, keyword_score, chunk))

        # Sort descending by hybrid score
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        top_candidates = scored_candidates[:top_k]

        citations: List[SourceCitation] = []
        for rank, (score, sem_score, kw_score, chunk) in enumerate(top_candidates, start=1):
            doc = chunk.document
            doc_filename = doc.filename if doc else "Document"
            file_type = doc.file_type if doc else "text"

            label = cls._format_citation_label(
                doc_idx=rank,
                filename=doc_filename,
                page_number=chunk.page_number,
                slide_number=chunk.slide_number,
                timestamp_start=chunk.timestamp_start,
                timestamp_end=chunk.timestamp_end,
            )

            snippet = cls._extract_snippet(chunk.content, query_terms)

            citations.append(
                SourceCitation(
                    chunk_id=chunk.id,
                    document_id=chunk.document_id,
                    document_name=doc_filename,
                    file_type=file_type,
                    page_number=chunk.page_number,
                    slide_number=chunk.slide_number,
                    timestamp_start=chunk.timestamp_start,
                    timestamp_end=chunk.timestamp_end,
                    topic=chunk.topic,
                    snippet=snippet,
                    score=score,
                    semantic_score=sem_score,
                    keyword_score=kw_score,
                    citation_label=label,
                )
            )

        logger.info(
            f"Retrieved {len(citations)} source citations for query '{query[:40]}' (top score={citations[0].score if citations else 0.0})"
        )
        return citations
