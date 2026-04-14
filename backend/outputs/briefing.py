"""
briefing.py — Daily Portfolio Briefing Generator

Purpose: For each ticker in the user's portfolio, retrieves the most recent
relevant chunks (price movements, new filings, risk signals) and calls Claude
to generate a concise daily summary with source citations.

The output feeds the BriefingBox.jsx component on the frontend dashboard.

GET /briefing/{date} in main.py calls generate_briefing().

TODO (Step 5+): Implement generate_briefing().
"""

from backend.models import BriefingResponse


def generate_briefing(tickers: list[str], date: str) -> BriefingResponse:
    """
    Generate a daily portfolio briefing for the given tickers and date.

    Args:
        tickers: List of portfolio ticker symbols e.g. ["AAPL", "MSFT"]
        date:    ISO date string e.g. "2025-04-14"

    Returns:
        BriefingResponse with a list of BriefingItems, each containing
        a cited insight and its source URL.
    """
    raise NotImplementedError("briefing.generate_briefing() — not yet implemented (Step 5+)")
