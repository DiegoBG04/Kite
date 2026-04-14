"""
transcripts.py — Earnings Call Transcript Scraper

Purpose: Fetches earnings call transcripts for a given ticker from public
sources (Seeking Alpha, Motley Fool, etc.) and returns structured text
ready for the chunking pipeline.

Each transcript chunk must carry a 'timestamp' field (seconds into the call)
so that SourcePill.jsx can display e.g. "Earnings Q4 · 14:32".

This module is Stage 1 of the ingestion pipeline for earnings data.
Stage 2 onward (chunker, embedder, store) is shared with edgar.py.

TODO (Step 5+): Implement transcript fetching.
"""


def fetch_transcripts(ticker: str, limit: int = 4) -> list[dict]:
    """
    Fetch recent earnings call transcripts for a ticker.

    Args:
        ticker: Stock ticker symbol e.g. "AAPL"
        limit:  Max number of transcripts to fetch

    Returns:
        List of document dicts compatible with chunker.chunk_documents():
            text, ticker, doc_type="earnings", fiscal_year,
            source_label, source_url, timestamp (seconds into call)
    """
    raise NotImplementedError("transcripts.fetch_transcripts() — not yet implemented")
