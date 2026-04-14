"""
embedder.py — Sentence Embedding Generator

Purpose: Converts text chunks into 384-dimensional vector embeddings using
the sentence-transformers library with the all-MiniLM-L6-v2 model. This model
runs entirely locally (no API calls, no cost) and produces embeddings that
match the vector(384) column in the Supabase pgvector table.

The same model and normalization settings MUST be used for both ingestion
(embedding chunks) and retrieval (embedding user queries). If they ever diverge,
similarity scores become meaningless.

This is Stage 3 of the Kite ingestion pipeline:
    edgar.py → chunker.py → embedder.py → store.py

The main functions to call from outside this module are:
    embed_chunks(chunks)   — for ingestion (adds 'embedding' key to each chunk)
    embed_text(text)       — for query time (returns a single vector)
"""

import logging
from typing import Optional

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# The embedding model. 384 dimensions, fast, free, runs locally.
# all-MiniLM-L6-v2 is a strong general-purpose model for semantic similarity.
MODEL_NAME = "all-MiniLM-L6-v2"

# Singleton: loaded once on first use, reused for all subsequent calls.
# Loading the model takes a few seconds; we don't want to do it on every request.
_model: Optional[SentenceTransformer] = None


def _get_model() -> SentenceTransformer:
    """
    Load the sentence-transformers model, caching it after the first load.

    Thread-safe in practice because the FastAPI server uses a single process
    and the model is read-only after loading.
    """
    global _model
    if _model is None:
        logger.info(f"[EMBEDDER] Loading model '{MODEL_NAME}' (first time only)...")
        _model = SentenceTransformer(MODEL_NAME)
        logger.info(f"[EMBEDDER] Model loaded. Output dimension: {_model.get_sentence_embedding_dimension()}")
    return _model


def embed_text(text: str) -> list[float]:
    """
    Embed a single text string into a 384-dimensional vector.

    Used at query time to embed the user's question so it can be compared
    against the stored chunk embeddings via cosine similarity.

    The normalization setting (normalize_embeddings=True) MUST match what
    was used during ingestion — otherwise cosine similarity scores will be wrong.

    Args:
        text: The text to embed (e.g. a user's question)

    Returns:
        List of 384 floats. Ready to pass to store.similarity_search().
    """
    model = _get_model()
    # normalize_embeddings=True makes cosine similarity equivalent to dot product,
    # which is what pgvector's <=> operator computes.
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def embed_chunks(chunks: list[dict], batch_size: int = 64) -> list[dict]:
    """
    Add a 384-dimensional 'embedding' key to each chunk dict in place.

    Processes chunks in batches for efficiency. The sentence-transformers library
    handles the batching internally and can use a GPU if one is available,
    but it runs fine on CPU for MVP scale.

    Args:
        chunks:     List of chunk dicts from chunker.py. Each must have a 'content' key.
        batch_size: How many chunks to encode in one pass. Tune down if you hit RAM limits.

    Returns:
        The same list of chunk dicts, each now also containing:
            embedding (list[float]): 384-dimensional vector, L2-normalized.

    Example:
        chunks = chunker.chunk_documents(docs)
        chunks = embed_chunks(chunks)
        # chunks[0]['embedding'] is now a list of 384 floats
    """
    if not chunks:
        logger.warning("[EMBEDDER] embed_chunks() called with empty list — nothing to do")
        return chunks

    model = _get_model()
    texts = [chunk["content"] for chunk in chunks]

    logger.info(
        f"[EMBEDDER] Embedding {len(texts)} chunks "
        f"(batch_size={batch_size}) — this may take a moment..."
    )

    # show_progress_bar helps during large ingestion runs so you know it's not frozen
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=len(texts) > 50,
        convert_to_numpy=True,  # Numpy arrays are easier to serialize to lists
    )

    # Write embedding into each chunk dict
    for chunk, embedding in zip(chunks, embeddings):
        chunk["embedding"] = embedding.tolist()

    logger.info(
        f"[EMBEDDER] Done. {len(chunks)} embeddings generated "
        f"(shape: {embeddings.shape}, dtype: {embeddings.dtype})"
    )
    return chunks
