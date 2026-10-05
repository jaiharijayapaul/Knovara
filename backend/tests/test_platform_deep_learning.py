"""Tests verifying Deep Learning algorithms (dense vector embeddings, semantic cosine retrieval, and knowledge modeling) in the platform programming."""

import pytest
from app.rag.embeddings import EmbeddingEngine, EMBEDDING_DIM
from app.rag.retriever import HybridRetriever
from app.models.document import DocumentChunk


def test_deep_learning_embedding_dimensions():
    """Verify semantic vector embeddings produce the expected dense vector dimensions."""
    text = "Artificial intelligence and neural network systems"
    vector = EmbeddingEngine.embed_text(text)
    assert len(vector) == EMBEDDING_DIM
    # Verify unit normalization (L2 norm is approximately 1.0)
    norm = sum(x * x for x in vector) ** 0.5
    assert abs(norm - 1.0) < 0.05


def test_deep_learning_semantic_cosine_similarity():
    """Verify semantic similarity retrieval using vector embeddings."""
    v1 = EmbeddingEngine.embed_text("convolutional neural networks for image classification")
    v2 = EmbeddingEngine.embed_text("deep neural vision models recognizing pictures")
    v3 = EmbeddingEngine.embed_text("ancient Roman history and architecture")

    sim_related = EmbeddingEngine.cosine_similarity(v1, v2)
    sim_unrelated = EmbeddingEngine.cosine_similarity(v1, v3)

    assert sim_related > sim_unrelated, "Semantically related texts should have higher cosine similarity"


def test_hybrid_retriever_dense_search():
    """Verify the hybrid dense retrieval engine ranks matching context chunks."""
    chunk1 = DocumentChunk(
        id="chunk-1",
        course_id="course-1",
        document_id="doc-1",
        chunk_index=0,
        content="Supervised learning involves training on labeled data pairs with loss minimization.",
        page_number=1,
    )
    chunk2 = DocumentChunk(
        id="chunk-2",
        course_id="course-1",
        document_id="doc-1",
        chunk_index=1,
        content="Photosynthesis is the biological process used by plants to convert light energy.",
        page_number=2,
    )

    citations = HybridRetriever.retrieve(
        query="What is supervised machine learning and loss minimization?",
        chunks=[chunk1, chunk2],
        top_k=1,
    )

    assert len(citations) >= 1
    assert citations[0].document_id == "doc-1"
    assert "Supervised learning" in citations[0].snippet
