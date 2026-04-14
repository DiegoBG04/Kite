"""
reasoner.py — Claude API Caller and Answer Formatter

Purpose: Takes retrieved document chunks from retriever.py, formats them
into a numbered context block, and calls the Claude API to generate a
grounded answer with inline source citations. Parses the response to build
the structured SourceItem list required by the /query API contract.

Model selection:
    - claude-haiku-4-5-20251001  — fast, cheap, good for simple lookups
    - claude-sonnet-4-6          — slower, higher quality for complex questions

The output of reason() maps directly to QueryResponse in models.py.
The /query API contract (answer + sources + sourced) must never change.

This is the second half of the RAG pipeline:
    retriever.py → reasoner.py (this file)
"""

import os
import logging

import anthropic

from backend.agent.prompts import KITE_SYSTEM_PROMPT
from backend.models import QueryResponse, SourceItem

logger = logging.getLogger(__name__)

# Default model — haiku is fast and cheap, good for MVP
DEFAULT_MODEL = "claude-haiku-4-5-20251001"

# Max tokens Claude can return in its answer
MAX_TOKENS = 1024


def _build_context_block(chunks: list[dict]) -> str:
    """
    Format retrieved chunks into a numbered context block for the Claude prompt.

    Each chunk is labelled with its index (matching the citation format
    [source_label, chunk_index] from the system prompt) and its source label
    so Claude knows what to cite.

    Example output:
        [1] Source: 10-K FY2024 (AAPL)
        Apple's revenue for fiscal year 2024 was $391 billion...

        [2] Source: 10-K FY2024 (AAPL)
        The company faces significant competition in all its markets...
    """
    lines = []
    for i, chunk in enumerate(chunks, start=1):
        lines.append(
            f"[{i}] Source: {chunk['source_label']} ({chunk['ticker']})\n"
            f"{chunk['content'].strip()}"
        )
    return "\n\n".join(lines)


def _build_sources(chunks: list[dict]) -> list[SourceItem]:
    """
    Convert retrieved chunks into SourceItem objects for the API response.

    Each SourceItem gives the frontend everything it needs to render a
    SourcePill: label, URL, ticker, doc type, page number, and an excerpt.
    """
    sources = []
    for chunk in chunks:
        # Excerpt: first 120 characters of the chunk content
        excerpt = chunk["content"].strip()[:120]
        if len(chunk["content"].strip()) > 120:
            excerpt += "..."

        sources.append(SourceItem(
            label=chunk["source_label"],
            ticker=chunk["ticker"],
            doc_type=chunk["doc_type"],
            source_url=chunk.get("source_url", ""),
            page_number=chunk.get("page_number"),
            timestamp=chunk.get("metadata", {}).get("timestamp"),
            published_at=chunk.get("metadata", {}).get("published_at"),
            excerpt=excerpt,
        ))
    return sources


def reason(
    question: str,
    chunks: list[dict],
    model: str = DEFAULT_MODEL,
) -> QueryResponse:
    """
    Call Claude with retrieved chunks and return a cited answer.

    Builds a prompt containing the user's question and the retrieved context
    passages, calls Claude, and returns a structured QueryResponse with the
    answer text, the list of source citations, and a 'sourced' flag.

    If no chunks are provided, returns a response telling the user there are
    no sources available — Claude is never called without context.

    Args:
        question: The user's original question.
        chunks:   Retrieved chunks from retriever.retrieve(). Each must have
                  ticker, source_label, source_url, chunk_index, content.
        model:    Claude model ID to use. Defaults to haiku for speed.

    Returns:
        QueryResponse matching the /query API contract:
            answer  — Claude's response with inline [label, index] citations
            sources — list of SourceItem objects for the frontend
            sourced — True if at least one source chunk was provided
    """
    # If there are no relevant chunks, don't call Claude — just return a clear message.
    # This avoids hallucination and saves API cost.
    if not chunks:
        logger.warning("[REASONER] No chunks provided — returning no-source response")
        return QueryResponse(
            answer="I don't have a source for that.",
            sources=[],
            sourced=False,
        )

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "ANTHROPIC_API_KEY is not set in your .env file."
        )

    client = anthropic.Anthropic(api_key=api_key)

    # Build the context block from retrieved chunks
    context = _build_context_block(chunks)

    # User message: the context passages + the question
    user_message = (
        f"Here are the relevant source passages:\n\n"
        f"{context}\n\n"
        f"Question: {question}"
    )

    logger.info(
        f"[REASONER] Calling {model} with {len(chunks)} chunks "
        f"({len(context)} chars of context)"
    )

    message = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system=KITE_SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_message}
        ],
    )

    answer = message.content[0].text.strip()

    logger.info(
        f"[REASONER] Response received "
        f"(input tokens: {message.usage.input_tokens}, "
        f"output tokens: {message.usage.output_tokens})"
    )

    # Build source list from all retrieved chunks
    sources = _build_sources(chunks)

    # sourced=True as long as we had chunks and Claude didn't just say
    # "I don't have a source for that"
    sourced = len(chunks) > 0 and "I don't have a source for that" not in answer

    return QueryResponse(
        answer=answer,
        sources=sources,
        sourced=sourced,
    )
