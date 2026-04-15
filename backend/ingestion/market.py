"""
market.py — Market Data Fetcher (Polygon.io)

Purpose: Pulls previous close price, sparkline, and chart data for a given
ticker using the Polygon.io REST API (free tier — historical data only).

Free tier limits:
  - 5 API calls per minute
  - Historical data only (no same-day or real-time prices)

To avoid hammering the rate limit on every page load, results are cached
in memory for CACHE_TTL_SECONDS. A Railway restart clears the cache.

Requires: POLYGON_API_KEY in your .env / Railway environment variables.
"""

import logging
import os
import time
from datetime import datetime, timedelta, timezone

import requests

logger = logging.getLogger(__name__)

POLYGON_BASE = "https://api.polygon.io"

# Cache portfolio data for 15 minutes — Polygon free tier is rate-limited
CACHE_TTL_SECONDS = 900
_cache: dict[str, dict] = {}  # ticker → {"data": ..., "expires": float}

# Period definitions: (multiplier, timespan, days_back)
# All use historical ranges (no today) to stay on free tier
CHART_PERIODS = {
    "1D":  ("5",  "minute",  5),   # last 5 days of 5-min bars, frontend shows latest day
    "1W":  ("1",  "hour",    7),
    "1M":  ("1",  "day",    35),
    "3M":  ("1",  "day",    95),
    "1Y":  ("1",  "week",  370),
}


def get_portfolio_data(ticker: str) -> dict:
    """
    Fetch previous close price, sparkline, and chart data for a single ticker.

    Results are cached for CACHE_TTL_SECONDS to respect Polygon's rate limit.

    Args:
        ticker: Stock ticker symbol e.g. "AAPL"

    Returns:
        Dict matching PortfolioResponse schema in models.py.

    Raises:
        ValueError: If POLYGON_API_KEY is not set or ticker returns no data.
    """
    api_key = os.getenv("POLYGON_API_KEY", "").strip()
    if not api_key:
        raise ValueError("POLYGON_API_KEY environment variable is not set")

    ticker = ticker.upper()

    # Return cached result if still fresh
    cached = _cache.get(ticker)
    if cached and cached["expires"] > time.time():
        logger.info(f"[MARKET] {ticker}: returning cached data")
        return cached["data"]

    logger.info(f"[MARKET] Fetching Polygon data for {ticker}")

    # Previous trading day close (1 API call)
    price, change_pct = _get_prev_close(ticker, api_key)

    # Company name (1 API call)
    name = _get_name(ticker, api_key) or ticker

    # Chart data — 5 API calls (one per period)
    chart_data: dict[str, list[float]] = {}
    for label, (mult, timespan, days_back) in CHART_PERIODS.items():
        chart_data[label] = _get_aggs(ticker, api_key, mult, timespan, days_back=days_back)

    # Reuse 1M daily closes for the sparkline (no extra API call)
    sparkline_data = chart_data["1M"][-30:]

    logger.info(f"[MARKET] {ticker}: ${price} ({change_pct:+.2f}%)")

    result = {
        "ticker": ticker,
        "name": name,
        "price": round(price, 2),
        "change_pct": round(change_pct, 2),
        "sparkline_data": sparkline_data,
        "chart_data": chart_data,
        "pe_ratio": None,
        "revenue_change": None,
        "risk_flags": 0,
        "last_filing": None,
        "yahoo_url": f"https://finance.yahoo.com/quote/{ticker}",
    }

    _cache[ticker] = {"data": result, "expires": time.time() + CACHE_TTL_SECONDS}
    return result


def _get_prev_close(ticker: str, api_key: str) -> tuple[float, float]:
    """
    Fetch the previous trading day's close and compute change %.
    Uses /v2/aggs/ticker/{ticker}/prev — available on free tier.
    """
    url = f"{POLYGON_BASE}/v2/aggs/ticker/{ticker}/prev"
    resp = requests.get(url, params={"adjusted": "true", "apiKey": api_key}, timeout=10)
    resp.raise_for_status()
    results = resp.json().get("results") or []
    if not results:
        raise ValueError(f"No previous close data for {ticker}")

    bar = results[0]
    close = float(bar["c"])
    open_ = float(bar["o"])
    change_pct = ((close - open_) / open_) * 100 if open_ else 0.0

    return close, change_pct


def _get_name(ticker: str, api_key: str) -> str | None:
    """Fetch company name from the reference/tickers endpoint."""
    try:
        url = f"{POLYGON_BASE}/v3/reference/tickers/{ticker}"
        resp = requests.get(url, params={"apiKey": api_key}, timeout=10)
        resp.raise_for_status()
        return resp.json().get("results", {}).get("name")
    except Exception as exc:
        logger.warning(f"[MARKET] Could not fetch name for {ticker}: {exc}")
        return None


def _get_aggs(
    ticker: str,
    api_key: str,
    multiplier: str,
    timespan: str,
    days_back: int,
) -> list[float]:
    """
    Fetch aggregate close prices for a historical date range.
    Ends yesterday to stay within the free tier (no same-day data).
    """
    try:
        now = datetime.now(timezone.utc)
        to_date = (now - timedelta(days=1)).strftime("%Y-%m-%d")   # yesterday
        from_date = (now - timedelta(days=days_back)).strftime("%Y-%m-%d")

        url = f"{POLYGON_BASE}/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from_date}/{to_date}"
        resp = requests.get(url, params={
            "adjusted": "true",
            "sort": "asc",
            "limit": 50000,
            "apiKey": api_key,
        }, timeout=10)
        resp.raise_for_status()

        results = resp.json().get("results") or []
        return [round(float(r["c"]), 2) for r in results]

    except Exception as exc:
        logger.warning(f"[MARKET] Could not fetch {timespan} aggs for {ticker}: {exc}")
        return []
