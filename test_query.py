"""
test_query.py — Integration Test: RAG Query Pipeline

Purpose: Verifies that the full query pipeline works end-to-end:
    User question → embedding → pgvector search → Claude → cited answer

Run from the kite/ directory (with .venv active):
    python test_query.py

Prerequisites:
    - test_pipeline.py must have passed first (AAPL chunks in pgvector)
    - ANTHROPIC_API_KEY must be set in .env
    - DATABASE_URL must be set in .env
"""

import logging
import os
import sys

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

TEST_QUESTION = "What are Apple's main risk factors?"
TICKER_FILTER = ["AAPL"]


def run() -> None:
    logger.info("=" * 60)
    logger.info("  Kite Query Test — RAG Pipeline")
    logger.info("=" * 60)

    # ------------------------------------------------------------------
    # Step 1: Retrieve relevant chunks
    # ------------------------------------------------------------------
    logger.info(f"\n[Step 1] Retrieving chunks for: \"{TEST_QUESTION}\"")
    from backend.agent.retriever import retrieve

    chunks = retrieve(question=TEST_QUESTION, ticker_filter=TICKER_FILTER)

    assert len(chunks) > 0, (
        "No chunks returned. Make sure test_pipeline.py passed and "
        "AAPL chunks are in pgvector."
    )
    logger.info(f"  ✓ {len(chunks)} chunks retrieved")
    logger.info(f"  ✓ Top chunk: {chunks[0]['ticker']} {chunks[0]['source_label']} "
                f"(score: {chunks[0]['similarity_score']:.4f})")
    logger.info(f"  ✓ Excerpt: \"{chunks[0]['content'][:100]}...\"")

    # ------------------------------------------------------------------
    # Step 2: Generate cited answer with Claude
    # ------------------------------------------------------------------
    logger.info(f"\n[Step 2] Calling Claude...")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.error(
            "ANTHROPIC_API_KEY is not set in .env — cannot call Claude.\n"
            "Get your key from console.anthropic.com"
        )
        sys.exit(1)

    from backend.agent.reasoner import reason

    response = reason(question=TEST_QUESTION, chunks=chunks)

    assert response.answer, "Empty answer returned from Claude"
    assert len(response.sources) > 0, "No sources in response"

    # ------------------------------------------------------------------
    # Print results
    # ------------------------------------------------------------------
    logger.info("\n" + "=" * 60)
    logger.info("  ANSWER")
    logger.info("=" * 60)
    print(f"\n{response.answer}\n")

    logger.info("=" * 60)
    logger.info("  SOURCES")
    logger.info("=" * 60)
    for i, src in enumerate(response.sources, 1):
        print(f"[{i}] {src.label} — {src.ticker}")
        print(f"     URL: {src.source_url}")
        print(f"     Excerpt: \"{src.excerpt}\"\n")

    logger.info(f"sourced: {response.sourced}")
    logger.info("\n" + "=" * 60)
    logger.info("  ALL TESTS PASSED ✓")
    logger.info("=" * 60)


if __name__ == "__main__":
    run()
