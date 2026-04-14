"""
test_pipeline.py — Integration Test: Full Ingestion Pipeline

Purpose: Verifies that the complete ingestion pipeline works end-to-end:
    EDGAR download → text extraction → chunking → embedding → pgvector storage

Uses AAPL 10-K as the test case (the most reliably available filing).

Run from the kite/ directory:
    python test_pipeline.py

Prerequisites:
    1. pip install -r backend/requirements.txt
    2. Run the SQL in supabase_schema.sql on your Supabase database
    3. Copy .env and fill in DATABASE_URL and EDGAR_USER_AGENT at minimum
       (ANTHROPIC_API_KEY and NEWS_API_KEY are NOT required for this test)

What this test confirms:
    ✓ sec-edgar-downloader can reach EDGAR and download the filing
    ✓ HTML stripping extracts readable text (not boilerplate)
    ✓ tiktoken chunker produces correctly-sized chunks with full metadata
    ✓ sentence-transformers produces 384-dim embeddings
    ✓ psycopg2 can connect to Supabase and write vector data
    ✓ The documents table has the right schema (vector column, unique constraint)
"""

import logging
import os
import sys

# Load .env before importing any backend modules
from dotenv import load_dotenv
load_dotenv()

# Add kite/ root to path so "backend.*" imports work when run from kite/
sys.path.insert(0, os.path.dirname(__file__))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Test configuration — change TICKER or LIMIT to test with a different filing
# ---------------------------------------------------------------------------
TICKER = "AAPL"
FILING_TYPE = "10-K"
LIMIT = 1       # Download 1 filing to keep the test fast


def run() -> None:
    logger.info("=" * 60)
    logger.info(f"  Kite Pipeline Test — {TICKER} {FILING_TYPE}")
    logger.info("=" * 60)

    # ------------------------------------------------------------------
    # Stage 1: Download and extract text from EDGAR
    # ------------------------------------------------------------------
    logger.info("\n[Stage 1] Downloading from EDGAR...")
    from backend.ingestion.edgar import download_and_extract

    docs = download_and_extract(
        ticker=TICKER,
        filing_types=[FILING_TYPE],
        limit_per_type=LIMIT,
    )

    assert len(docs) > 0, (
        f"No documents returned for {TICKER} {FILING_TYPE}. "
        "Check EDGAR_USER_AGENT in .env and your internet connection."
    )

    doc = docs[0]
    logger.info(f"  ✓ Downloaded: {doc['source_label']}")
    logger.info(f"  ✓ Text length: {len(doc['text']):,} characters")
    logger.info(f"  ✓ Source URL:  {doc['source_url']}")

    # Sanity check: extracted text should be meaningful, not just tags
    assert len(doc["text"]) > 5_000, (
        f"Extracted text is suspiciously short ({len(doc['text'])} chars). "
        "HTML stripping may have gone wrong."
    )
    assert "Apple" in doc["text"] or "AAPL" in doc["text"], (
        "The text doesn't mention Apple — extraction may have failed."
    )

    # ------------------------------------------------------------------
    # Stage 2: Chunk into ~500-token pieces
    # ------------------------------------------------------------------
    logger.info("\n[Stage 2] Chunking...")
    from backend.pipeline.chunker import chunk_documents

    chunks = chunk_documents(docs)

    assert len(chunks) > 0, "Chunker returned no chunks."
    logger.info(f"  ✓ {len(chunks)} chunks created")
    logger.info(f"  ✓ Sample chunk ({chunks[0]['token_count']} tokens):")
    logger.info(f"    \"{chunks[0]['content'][:120]}...\"")
    logger.info(f"  ✓ Metadata: ticker={chunks[0]['ticker']}, "
                f"doc_type={chunks[0]['doc_type']}, "
                f"chunk_index={chunks[0]['chunk_index']}")

    # Token counts should be at or below the target size
    oversized = [c for c in chunks if c["token_count"] > 550]
    assert len(oversized) == 0, (
        f"{len(oversized)} chunks exceed 550 tokens — check CHUNK_SIZE in chunker.py"
    )

    # ------------------------------------------------------------------
    # Stage 3: Generate embeddings
    # ------------------------------------------------------------------
    logger.info("\n[Stage 3] Embedding (may take 1–2 minutes on CPU)...")
    from backend.pipeline.embedder import embed_chunks

    chunks = embed_chunks(chunks)

    assert "embedding" in chunks[0], "embed_chunks() did not add 'embedding' key."
    assert len(chunks[0]["embedding"]) == 384, (
        f"Expected 384-dim embedding, got {len(chunks[0]['embedding'])}. "
        "Is the model all-MiniLM-L6-v2?"
    )
    logger.info(f"  ✓ Embeddings: {len(chunks)} × 384 dimensions")
    logger.info(f"  ✓ Sample value: {chunks[0]['embedding'][:3]} ...")

    # ------------------------------------------------------------------
    # Stage 4: Upsert into pgvector
    # ------------------------------------------------------------------
    logger.info("\n[Stage 4] Upserting into pgvector...")

    # Check DATABASE_URL is set before attempting the connection
    if not os.environ.get("DATABASE_URL"):
        logger.error(
            "DATABASE_URL is not set in .env — cannot connect to Supabase.\n"
            "Get it from: Supabase Dashboard → Settings → Database → "
            "Connection string (URI mode)"
        )
        sys.exit(1)

    from backend.pipeline.store import upsert_chunks

    n = upsert_chunks(chunks)
    assert n > 0, "upsert_chunks() returned 0 — nothing was written."
    logger.info(f"  ✓ {n} chunks upserted")

    # ------------------------------------------------------------------
    # Verification: Query the DB directly to confirm rows are there
    # ------------------------------------------------------------------
    logger.info("\n[Verification] Querying pgvector directly...")
    import psycopg2
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM documents WHERE ticker = %s AND doc_type = %s",
            (TICKER, FILING_TYPE),
        )
        count = cur.fetchone()[0]
    conn.close()

    assert count > 0, f"No rows found in documents table for {TICKER} {FILING_TYPE}."
    logger.info(f"  ✓ {count} {TICKER} {FILING_TYPE} chunks confirmed in pgvector")

    # ------------------------------------------------------------------
    # Done
    # ------------------------------------------------------------------
    logger.info("\n" + "=" * 60)
    logger.info("  ALL TESTS PASSED ✓")
    logger.info("=" * 60)
    logger.info(
        f"\nNext step: run test_query.py to test retrieval and Claude answering.\n"
    )


if __name__ == "__main__":
    run()
