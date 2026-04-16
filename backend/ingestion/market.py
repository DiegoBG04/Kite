"""
market.py — Market Data Fetcher (Twelve Data)

Purpose: Pulls current price, percentage change, sparkline, and chart data
for a given ticker using the Twelve Data API (free tier).

Free tier: 800 calls/day, 8 calls/minute.
Supports multiple symbols in one call — very efficient for portfolio loading.
Data is real-time delayed (15 min on free tier).

Results are cached in memory for 15 minutes to avoid redundant API calls.

Requires: TWELVE_DATA_API_KEY in your .env / Railway environment variables.
"""

import logging
import os
import time

import requests

logger = logging.getLogger(__name__)

TWELVE_BASE = "https://api.twelvedata.com"

CACHE_TTL_SECONDS = 900  # 15 minutes
_cache: dict[str, dict] = {}  # ticker → {"data": ..., "expires": float}

FIN_CACHE_TTL = 3600  # 1 hour — DB reads are fast, cache to avoid hammering Supabase
_fin_cache: dict[str, dict] = {}  # ticker → {"data": ..., "expires": float}

# Chart period definitions: (interval, outputsize)
CHART_PERIODS = {
    "1D": ("5min",   78),   # ~1 trading day of 5-min bars
    "1W": ("1h",     35),   # 5 trading days of hourly bars
    "1M": ("1day",   30),
    "3M": ("1day",   90),
    "6M": ("1day",  180),
    "1Y": ("1week",  52),
    "6Y": ("1month", 72),
    "MAX": ("1month", 240),
}


def get_portfolio_data(ticker: str) -> dict:
    """
    Fetch current price, change %, sparkline, and chart data for a single ticker.

    Results are cached for CACHE_TTL_SECONDS to respect the rate limit.

    Args:
        ticker: Stock ticker symbol e.g. "AAPL"

    Returns:
        Dict matching PortfolioResponse schema in models.py.

    Raises:
        ValueError: If TWELVE_DATA_API_KEY is not set or ticker returns no data.
    """
    api_key = os.getenv("TWELVE_DATA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("TWELVE_DATA_API_KEY environment variable is not set")

    ticker = ticker.upper()

    cached = _cache.get(ticker)
    if cached and cached["expires"] > time.time():
        logger.info(f"[MARKET] {ticker}: returning cached data")
        return cached["data"]

    logger.info(f"[MARKET] Fetching Twelve Data for {ticker}")

    # --- Quote: price, change %, name (1 API call) ---
    price, change_pct, name = _get_quote(ticker, api_key)

    # --- Chart data per period (1 API call each) ---
    chart_data: dict[str, list[float]] = {}
    for label, (interval, outputsize) in CHART_PERIODS.items():
        chart_data[label] = _get_time_series(ticker, api_key, interval, outputsize)

    # Reuse 1M daily data for sparkline — no extra API call
    sparkline_data = chart_data["1M"][-30:]

    logger.info(f"[MARKET] {ticker}: ${price} ({change_pct:+.2f}%)")

    result = {
        "ticker": ticker,
        "name": name or ticker,
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


def get_financials(ticker: str) -> dict:
    """
    Return quarterly and annual income statement data for a ticker.
    Reads from the Supabase 'financials' table — data is pre-ingested
    via xbrl.fetch_financial_facts() during the /ingest pipeline.

    Results are cached in memory for 1 hour to avoid redundant DB queries.
    """
    ticker = ticker.upper()
    cached = _fin_cache.get(ticker)
    if cached and cached["expires"] > time.time():
        logger.info(f"[FINANCIALS] {ticker}: returning cached data")
        return cached["data"]

    from backend.pipeline.financial_store import get_financials_from_db
    result = get_financials_from_db(ticker)

    _fin_cache[ticker] = {"data": result, "expires": time.time() + FIN_CACHE_TTL}
    return result


def _get_quote(ticker: str, api_key: str) -> tuple[float, float, str]:
    """
    Fetch current price, percent change, and company name in one call.
    Uses /quote endpoint which supports multiple symbols.
    """
    resp = requests.get(f"{TWELVE_BASE}/quote", params={
        "symbol": ticker,
        "apikey": api_key,
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") == "error":
        raise ValueError(f"Twelve Data error for {ticker}: {data.get('message')}")

    price = float(data.get("close") or data.get("previous_close") or 0)
    change_pct = float(data.get("percent_change") or 0)
    name = data.get("name") or ticker

    if not price:
        raise ValueError(f"No price data returned for {ticker}")

    return price, change_pct, name


def _get_time_series(
    ticker: str,
    api_key: str,
    interval: str,
    outputsize: int,
) -> list[float]:
    """
    Fetch historical close prices for a given interval and output size.
    Returns closes in chronological order (oldest → newest).
    """
    try:
        resp = requests.get(f"{TWELVE_BASE}/time_series", params={
            "symbol": ticker,
            "interval": interval,
            "outputsize": outputsize,
            "apikey": api_key,
        }, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") == "error":
            logger.warning(f"[MARKET] Twelve Data error ({interval}) for {ticker}: {data.get('message')}")
            return []

        values = data.get("values") or []
        # API returns newest first — reverse to chronological order
        closes = [round(float(v["close"]), 2) for v in reversed(values)]
        return closes

    except Exception as exc:
        logger.warning(f"[MARKET] Could not fetch {interval} series for {ticker}: {exc}")
        return []
