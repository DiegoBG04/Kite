"""
store.py — pgvector Storage Layer

Purpose: Handles all reads and writes to the 'documents' pgvector table in
Supabase. Uses a direct psycopg2 connection (not the Supabase REST client)
because the REST client does not support the pgvector 'vector' data type.

Two operations are exposed:
    upsert_chunks()       — insert or update embedded chunks during ingestion
    similarity_search()   — find the most relevant chunks for a query embedding

The ON CONFLICT upsert key is (ticker, doc_type, fiscal_year, chunk_index).
Re-ingesting the same filing will update existing rows, not create duplicates.

This is Stage 4 of the Kite ingestion pipeline (the final stage):
    edgar.py → chunker.py → embedder.py → store.py

NOTE: Run the SQL in supabase_schema.sql before using this module. The schema
adds fiscal_year as a column and a unique constraint not in the original spec.
"""

import json
import logging
from typing import Optional

import psycopg2
from psycopg2.extras import execute_values

from backend.db import get_pg_conn

logger = logging.getLogger(__name__)

# How many top results to return from a similarity search by default
DEFAULT_TOP_K = 8


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _embedding_to_pg(embedding: list[float]) -> str:
    """
    Format a Python list of floats as the string pgvector expects for a ::vector cast.

    Example: [0.1, -0.2, 0.3] → "[0.1,-0.2,0.3]"
    """
    return "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def upsert_chunks(chunks: list[dict]) -> int:
    """
    Insert embedded chunks into the pgvector 'documents' table.

    If a chunk with the same (ticker, doc_type, fiscal_year, chunk_index) already
    exists (e.g. from a previous ingestion run), its content, embedding, and URLs
    are updated in place instead of creating a duplicate row.

    Args:
        chunks: List of chunk dicts from embedder.embed_chunks(). Each must have:
                ticker, doc_type, fiscal_year, chunk_index, source_label,
                source_url, page_number, content, embedding (list of 384 floats).

    Returns:
        Number of rows upserted.

    Raises:
        Exception: Re-raises any database error after rolling back the transaction.
    """
    if not chunks:
        logger.warning("[STORE] upsert_chunks() called with empty list — nothing to upsert")
        return 0

    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            # Build row tuples — order must match the INSERT column list below
            rows = []
            for chunk in chunks:
                # Validate that embedding is present before trying to insert
                if "embedding" not in chunk:
                    raise ValueError(
                        f"Chunk {chunk.get('chunk_index')} for {chunk.get('ticker')} "
                        "is missing 'embedding'. Run embed_chunks() before upsert_chunks()."
                    )

                # Store any extra fields (token_count, accession_number) in the JSONB metadata column
                metadata = {
                    "token_count": chunk.get("token_count"),
                    "accession_number": chunk.get("accession_number"),
                }

                rows.append((
                    chunk["ticker"],
                    chunk["doc_type"],
                    chunk.get("fiscal_year", ""),
                    chunk.get("source_label", ""),
                    chunk.get("source_url", ""),
                    chunk.get("page_number"),       # can be None
                    chunk["chunk_index"],
                    chunk["content"],
                    _embedding_to_pg(chunk["embedding"]),   # formatted as "[0.1,0.2,...]"
                    json.dumps(metadata),
                ))

            # ON CONFLICT: update the row if it already exists (idempotent re-ingestion)
            sql = """
                INSERT INTO documents
                    (ticker, doc_type, fiscal_year, source_label, source_url,
                     page_number, chunk_index, content, embedding, metadata)
                VALUES %s
                ON CONFLICT (ticker, doc_type, fiscal_year, chunk_index)
                DO UPDATE SET
                    content      = EXCLUDED.content,
                    embedding    = EXCLUDED.embedding,
                    source_label = EXCLUDED.source_label,
                    source_url   = EXCLUDED.source_url,
                    metadata     = EXCLUDED.metadata
            """

            # The template tells psycopg2 how to cast each column.
            # embedding gets ::vector so Postgres knows it's a pgvector type.
            execute_values(
                cur,
                sql,
                rows,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s::vector, %s::jsonb)",
            )

        conn.commit()
        logger.info(f"[STORE] Upserted {len(rows)} chunks into pgvector")
        return len(rows)

    except Exception as exc:
        conn.rollback()
        logger.error(f"[STORE] upsert_chunks failed, transaction rolled back: {exc}")
        raise

    finally:
        conn.close()


def similarity_search(
    query_embedding: list[float],
    top_k: int = DEFAULT_TOP_K,
    ticker_filter: Optional[list[str]] = None,
) -> list[dict]:
    """
    Find the chunks most semantically similar to a query embedding.

    Uses pgvector's <=> cosine distance operator. Lower distance = higher
    similarity. Results are returned sorted by similarity descending
    (most relevant first).

    Args:
        query_embedding: 384-float vector from embedder.embed_text(question).
        top_k:           Number of results to return.
        ticker_filter:   If given, restrict search to these tickers only.
                         Pass the user's portfolio tickers to keep answers focused.

    Returns:
        List of chunk dicts ordered by similarity (best match first). Each has:
            id, ticker, doc_type, fiscal_year, source_label, source_url,
            page_number, chunk_index, content, metadata, similarity_score.
    """
    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            query_vec = _embedding_to_pg(query_embedding)

            if ticker_filter:
                # Build a parameterised IN clause for the ticker whitelist
                placeholders = ",".join(["%s"] * len(ticker_filter))
                sql = f"""
                    SELECT
                        id, ticker, doc_type, fiscal_year, source_label, source_url,
                        page_number, chunk_index, content, metadata,
                        1 - (embedding <=> %s::vector) AS similarity_score
                    FROM documents
                    WHERE ticker IN ({placeholders})
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """
                # query_vec appears twice: once in SELECT for the score, once in ORDER BY
                params = [query_vec] + [t.upper() for t in ticker_filter] + [query_vec, top_k]
            else:
                sql = """
                    SELECT
                        id, ticker, doc_type, fiscal_year, source_label, source_url,
                        page_number, chunk_index, content, metadata,
                        1 - (embedding <=> %s::vector) AS similarity_score
                    FROM documents
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """
                params = [query_vec, query_vec, top_k]

            cur.execute(sql, params)
            rows = cur.fetchall()

        results = []
        for row in rows:
            (
                id_, ticker, doc_type, fiscal_year, source_label, source_url,
                page_number, chunk_index, content, metadata, similarity_score
            ) = row
            results.append({
                "id": id_,
                "ticker": ticker,
                "doc_type": doc_type,
                "fiscal_year": fiscal_year,
                "source_label": source_label,
                "source_url": source_url,
                "page_number": page_number,
                "chunk_index": chunk_index,
                "content": content,
                "metadata": metadata if isinstance(metadata, dict) else {},
                "similarity_score": float(similarity_score),
            })

        if results:
            logger.info(
                f"[STORE] Similarity search returned {len(results)} results "
                f"(top score: {results[0]['similarity_score']:.4f})"
            )
        else:
            logger.warning("[STORE] Similarity search returned 0 results")

        return results

    finally:
        conn.close()
