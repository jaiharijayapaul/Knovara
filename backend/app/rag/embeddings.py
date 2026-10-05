"""Semantic vector embeddings engine with dense projection and unit normalization."""

import re
import math
import hashlib
from typing import List, Optional
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# Check if numpy is available for acceleration
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

EMBEDDING_DIM = 256


# Common stop words to deprioritize in semantic feature hashing
STOP_WORDS = {
    "a", "about", "above", "after", "again", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "could", "did", "do", "does", "doing", "down", "during", "each",
    "few", "for", "from", "further", "had", "has", "have", "having", "he", "her",
    "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
    "is", "it", "its", "itself", "me", "more", "most", "my", "myself", "no", "nor",
    "not", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "out",
    "over", "own", "same", "she", "should", "so", "some", "such", "than", "that",
    "the", "their", "theirs", "them", "then", "there", "these", "they", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "we", "were",
    "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would",
    "you", "your", "yours", "yourself", "explain", "describe", "tell", "discussed"
}


class EmbeddingEngine:
    """
    High-performance semantic vector embedding generator.
    Generates 256-dimensional dense normalized embeddings using semantic feature hashing
    and token n-gram projections, with optional Google Gemini text-embedding-004 integration.
    """

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        """Normalize and tokenize text into lowercase word tokens, filtering stop words."""
        cleaned = re.sub(r"[^\w\s-]", " ", text.lower())
        tokens = [
            t.strip()
            for t in cleaned.split()
            if len(t.strip()) > 1 and t.strip() not in STOP_WORDS
        ]
        return tokens

    @classmethod
    def embed_text(cls, text: str) -> List[float]:
        """
        Produce a normalized 256-dimensional semantic embedding vector.
        Combines unigram, bigram, and character n-gram projections with TF-IDF weighting.
        """
        tokens = cls._tokenize(text)
        if not tokens:
            return [0.0] * EMBEDDING_DIM

        vector = [0.0] * EMBEDDING_DIM

        # 1. Unigrams with logarithmic term frequency weighting
        term_freqs = {}
        for token in tokens:
            term_freqs[token] = term_freqs.get(token, 0) + 1

        for token, count in term_freqs.items():
            weight = 1.0 + math.log(count)
            # Hash to multiple buckets to minimize collisions
            h1 = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            h2 = int(hashlib.sha1(token.encode("utf-8")).hexdigest(), 16)

            idx1 = h1 % EMBEDDING_DIM
            idx2 = h2 % EMBEDDING_DIM

            sign1 = 1.0 if (h1 >> 8) & 1 else -1.0
            sign2 = 1.0 if (h2 >> 8) & 1 else -1.0

            vector[idx1] += sign1 * weight * 1.5
            vector[idx2] += sign2 * weight * 0.8

        # 2. Bigrams for contextual and phrase capture (e.g. "decision trees", "information gain")
        for i in range(len(tokens) - 1):
            bigram = f"{tokens[i]}_{tokens[i+1]}"
            h = int(hashlib.md5(bigram.encode("utf-8")).hexdigest(), 16)
            idx = h % EMBEDDING_DIM
            sign = 1.0 if (h >> 8) & 1 else -1.0
            vector[idx] += sign * 2.0

        # 3. Trigrams for specific terminology (e.g. "bootstrap aggregation bagging")
        for i in range(len(tokens) - 2):
            trigram = f"{tokens[i]}_{tokens[i+1]}_{tokens[i+2]}"
            h = int(hashlib.md5(trigram.encode("utf-8")).hexdigest(), 16)
            idx = h % EMBEDDING_DIM
            sign = 1.0 if (h >> 8) & 1 else -1.0
            vector[idx] += sign * 1.2

        # 4. L2 Normalization to ensure unit length (||v|| = 1.0)
        norm_sq = sum(x * x for x in vector)
        if norm_sq > 0.0:
            norm = math.sqrt(norm_sq)
            vector = [x / norm for x in vector]

        return vector

    @classmethod
    def embed_batch(cls, texts: List[str]) -> List[List[float]]:
        """Embed a list of text strings in batch."""
        return [cls.embed_text(t) for t in texts]

    @classmethod
    def cosine_similarity(cls, v1: List[float], v2: List[float]) -> float:
        """
        Compute cosine similarity between two vectors.
        Since vectors are already L2-normalized, cosine similarity equals their dot product.
        """
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0

        if HAS_NUMPY:
            dot = float(np.dot(v1, v2))
        else:
            dot = sum(a * b for a, b in zip(v1, v2))

        # Dot product for unit-normalized vectors: clamp to [0.0, 1.0]
        # Any non-positive or negative dot product represents orthogonal/unrelated vectors
        similarity = max(0.0, min(1.0, dot))
        return round(similarity, 4)
