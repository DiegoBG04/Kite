"""
retriever.py — Semantic Retriever

Purpose: Embeds a user's natural language question using the same model
used during ingestion (all-MiniLM-L6-v2), then queries pgvector for the
top-K most semantically similar chunks. The retrieved chunks are passed
directly to reasoner.py which calls Claude to generate a cited answer.

This is the first half of the RAG pipeline:
    retriever.py (find relevant chunks) → reasoner.py (generate answer)

The only function to call from outside this module is retrieve().
"""

import logging
from typing import Optional

from backend.pipeline.embedder import embed_text
from backend.pipeline.store import similarity_search

logger = logging.getLogger(__name__)

# Default number of chunks to retrieve. 8 gives Claude enough context
# without blowing up the prompt size or cost.
DEFAULT_TOP_K = 8


def retrieve(
    question: str,
    top_k: int = DEFAULT_TOP_K,
    ticker_filter: Optional[list[str]] = None,
) -> list[dict]:
    """
    Find the most relevant document chunks for a natural language question.

    Embeds the question with the same model used at ingestion time, then
    runs a cosine similarity search against the pgvector documents table.
    Results are ordered by relevance — most similar chunk first.

    Args:
        question:      The user's question in plain English.
        top_k:         How many chunks to return. More chunks = more context
                       for Claude but higher token cost per query.
        ticker_filter: If provided, only search chunks belonging to these
                       tickers. Pass the user's portfolio tickers to keep
                       answers focused. None means search all tickers.

    Returns:
        List of chunk dicts ordered by similarity (best match first).
        Each dict has: ticker, doc_type, fiscal_year, source_label,
        source_url, page_number, chunk_index, content, similarity_score.
        Empty list if no relevant chunks are found.

    Example:
        chunks = retrieve("What are Apple's main risk factors?", ticker_filter=["AAPL"])
        # Pass chunks to reasoner.reason(question, chunks)
    """
    logger.info(
        f"[RETRIEVER] Retrieving top {top_k} chunks for: \"{question[:80]}...\""
        if len(question) > 80 else
        f"[RETRIEVER] Retrieving top {top_k} chunks for: \"{question}\""
    )

    # Embed the question using the same model and normalization as ingestion.
    # If the models or normalization diverge, similarity scores become meaningless.
    query_embedding = embed_text(question)

    # Run cosine similarity search in pgvector
    chunks = similarity_search(
        query_embedding=query_embedding,
        top_k=top_k,
        ticker_filter=ticker_filter,
    )

    if not chunks:
        logger.warning("[RETRIEVER] No chunks returned — vector store may be empty")
    else:
        logger.info(
            f"[RETRIEVER] Retrieved {len(chunks)} chunks. "
            f"Top match: {chunks[0]['ticker']} {chunks[0]['source_label']} "
            f"(score: {chunks[0]['similarity_score']:.4f})"
        )

    return chunks
