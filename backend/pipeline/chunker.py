"""
chunker.py — Document Text Chunker

Purpose: Splits large filing texts into smaller token-bounded chunks (~500 tokens)
using tiktoken for precise token counting. Each chunk is a self-contained dict
that carries all the metadata needed to build a source citation later — ticker,
doc type, fiscal year, EDGAR URL, page number, and chunk index.

Chunks overlap slightly (50 tokens) at their boundaries so that sentences split
across two chunk boundaries don't lose context in either chunk.

This is Stage 2 of the Kite ingestion pipeline:
    edgar.py → chunker.py → embedder.py → store.py

The main function to call from outside this module is chunk_documents().
"""

import logging
from typing import Optional

import tiktoken

logger = logging.getLogger(__name__)

# Target size for each chunk in tokens
CHUNK_SIZE = 500

# How many tokens to overlap between consecutive chunks.
# Overlap ensures that a sentence split across two chunks is still fully
# present in at least one of them, improving retrieval quality.
CHUNK_OVERLAP = 50

# Tokenizer name — cl100k_base is what Claude and GPT-4 use, so token counts
# will be consistent if we ever want to estimate prompt costs.
ENCODING = "cl100k_base"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_encoder() -> tiktoken.Encoding:
    """Return the tiktoken encoder (cached by tiktoken internally)."""
    return tiktoken.get_encoding(ENCODING)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chunk_document(
    text: str,
    ticker: str,
    doc_type: str,
    fiscal_year: str,
    source_label: str,
    source_url: str,
    page_number: Optional[int] = None,
) -> list[dict]:
    """
    Split one document's text into token-bounded chunks with full metadata.

    Args:
        text:         Full plain text of the document (from edgar.py or similar)
        ticker:       Uppercase stock ticker e.g. "AAPL"
        doc_type:     Filing type e.g. "10-K", "10-Q", "news"
        fiscal_year:  4-digit fiscal year e.g. "2024"
        source_label: Human-readable citation label e.g. "10-K FY2024"
        source_url:   Direct URL to the source document
        page_number:  Starting page number of the document, if known

    Returns:
        List of chunk dicts. Each chunk has the keys required by store.upsert_chunks():
            ticker, doc_type, fiscal_year, chunk_index, source_label,
            source_url, page_number, content, token_count
    """
    enc = _get_encoder()

    # Tokenize the full document text
    all_tokens = enc.encode(text)
    total_tokens = len(all_tokens)

    if total_tokens == 0:
        logger.warning(f"[CHUNKER] Empty text for {ticker} {doc_type} — nothing to chunk")
        return []

    expected_chunks = max(1, total_tokens // CHUNK_SIZE)
    logger.info(
        f"[CHUNKER] {ticker} {doc_type} FY{fiscal_year}: "
        f"{total_tokens:,} tokens → ~{expected_chunks} chunks"
    )

    chunks = []
    chunk_index = 0
    start = 0

    while start < total_tokens:
        end = min(start + CHUNK_SIZE, total_tokens)
        chunk_tokens = all_tokens[start:end]

        # Decode back to text — tiktoken handles partial UTF-8 gracefully
        chunk_text = enc.decode(chunk_tokens)

        chunks.append({
            "ticker": ticker.upper(),
            "doc_type": doc_type,
            "fiscal_year": fiscal_year,
            "chunk_index": chunk_index,
            "source_label": source_label,
            "source_url": source_url,
            "page_number": page_number,
            "content": chunk_text,
            "token_count": len(chunk_tokens),
        })

        chunk_index += 1

        # Advance by (CHUNK_SIZE - CHUNK_OVERLAP) so consecutive chunks share
        # CHUNK_OVERLAP tokens of context at their boundary.
        if end >= total_tokens:
            break  # Reached end of document
        start = end - CHUNK_OVERLAP

    logger.info(
        f"[CHUNKER] Created {len(chunks)} chunks for {ticker} {doc_type} FY{fiscal_year}"
    )
    return chunks


def chunk_documents(documents: list[dict]) -> list[dict]:
    """
    Chunk a list of extracted documents into a flat list of all chunks.

    Accepts the output of edgar.download_and_extract() (or other ingestion
    modules) and runs each document through chunk_document().

    Args:
        documents: List of document dicts. Each must have:
                   text, ticker, doc_type, fiscal_year, source_label, source_url.
                   page_number is optional.

    Returns:
        Flat list of all chunk dicts across all documents, ready for embedder.py.
    """
    all_chunks: list[dict] = []

    for i, doc in enumerate(documents):
        logger.info(
            f"[CHUNKER] Processing document {i + 1}/{len(documents)}: "
            f"{doc.get('ticker')} {doc.get('doc_type')} FY{doc.get('fiscal_year')}"
        )
        chunks = chunk_document(
            text=doc["text"],
            ticker=doc["ticker"],
            doc_type=doc["doc_type"],
            fiscal_year=doc["fiscal_year"],
            source_label=doc["source_label"],
            source_url=doc["source_url"],
            page_number=doc.get("page_number"),
        )
        all_chunks.extend(chunks)

    logger.info(
        f"[CHUNKER] Total: {len(all_chunks)} chunks across {len(documents)} document(s)"
    )
    return all_chunks
