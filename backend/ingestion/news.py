"""
news.py — NewsAPI Article Fetcher

Purpose: Fetches recent news articles for a list of tickers using the
NewsAPI (newsapi.org). Returns structured article data including a
'published_at' ISO date string so the frontend can display
e.g. "Reuters · Apr 12".

Requires: NEWS_API_KEY in your .env / Railway environment variables.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

from newsapi import NewsApiClient

logger = logging.getLogger(__name__)


def fetch_news(
    tickers: list[str],
    filter_type: str = "portfolio",
    page_size: int = 20,
) -> list[dict]:
    """
    Fetch recent news articles relevant to the given tickers.

    Args:
        tickers:     List of ticker symbols e.g. ["AAPL", "MSFT"]
        filter_type: One of "portfolio", "trending", "top", "recent"
        page_size:   Max number of articles to return

    Returns:
        List of article dicts with keys:
            title, source, published_at, url, tickers
    """
    api_key = os.getenv("NEWS_API_KEY", "").strip()
    if not api_key:
        raise ValueError("NEWS_API_KEY environment variable is not set")

    client = NewsApiClient(api_key=api_key)

    # Date range: last 7 days (free tier limit is 1 month but 7 days keeps it fresh)
    from_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

    articles = []

    if filter_type == "top":
        # Top headlines — not ticker-specific
        response = client.get_top_headlines(
            category="business",
            language="en",
            page_size=page_size,
        )
        raw_articles = response.get("articles", [])
        for a in raw_articles:
            articles.append(_format_article(a, tickers=[]))

    elif filter_type == "recent":
        # Recent business/finance news, not ticker-filtered
        response = client.get_everything(
            q="stock market finance earnings",
            language="en",
            sort_by="publishedAt",
            from_param=from_date,
            page_size=page_size,
        )
        raw_articles = response.get("articles", [])
        for a in raw_articles:
            articles.append(_format_article(a, tickers=[]))

    else:
        # "portfolio" or "trending" — search per ticker and merge
        seen_urls = set()
        per_ticker = max(1, page_size // max(len(tickers), 1))

        for ticker in tickers:
            try:
                response = client.get_everything(
                    q=ticker,
                    language="en",
                    sort_by="relevancy" if filter_type == "portfolio" else "popularity",
                    from_param=from_date,
                    page_size=per_ticker,
                )
                for a in response.get("articles", []):
                    url = a.get("url", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        articles.append(_format_article(a, tickers=[ticker]))
            except Exception as exc:
                logger.warning(f"[NEWS] Failed to fetch articles for {ticker}: {exc}")

    logger.info(f"[NEWS] Fetched {len(articles)} articles (filter={filter_type})")
    return articles


def _format_article(raw: dict, tickers: list[str]) -> dict:
    """Normalize a raw NewsAPI article into the shape the frontend expects."""
    source = raw.get("source", {}).get("name") or "Unknown"
    published_at = raw.get("publishedAt") or ""

    # Trim microseconds — frontend just needs ISO date string
    if published_at:
        try:
            dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
            published_at = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass

    return {
        "title": raw.get("title") or "",
        "source": source,
        "published_at": published_at,
        "url": raw.get("url") or "",
        "tickers": tickers,
    }
