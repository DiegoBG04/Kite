"""
news.py — NewsAPI Article Fetcher

Purpose: Fetches recent news articles for a list of tickers using the
NewsAPI (newsapi.org). Returns structured article data including a
'published_at' ISO date string so SourcePill.jsx can display
e.g. "Reuters · Apr 12".

Articles are also passed through the pipeline to generate AI summaries
(in reasoner.py) that appear in NewsCard.jsx.

Requires: NEWS_API_KEY in your .env file.

TODO (Step 5+): Implement news fetching and summary generation.
"""


def fetch_news(
    tickers: list[str],
    filter_type: str = "portfolio",
    page_size: int = 20,
) -> list[dict]:
    """
    Fetch recent news articles relevant to the given tickers.

    Args:
        tickers:     List of ticker symbols to search news for
        filter_type: One of "portfolio", "trending", "top", "recent"
        page_size:   Number of articles to return

    Returns:
        List of article dicts with:
            title, source, published_at, tickers, url, full_text
        (summary is added later by reasoner.py)
    """
    raise NotImplementedError("news.fetch_news() — not yet implemented")
