"""
market.py — Market Data Fetcher (Polygon.io)

Purpose: Pulls current price, percentage change, sparkline data, and chart
data for a given ticker using the Polygon.io REST API (free tier, 15-min
delayed). Replaces yfinance which is blocked by Yahoo Finance on cloud IPs.

Free tier: unlimited calls, 15-minute delayed data.
Requires: POLYGON_API_KEY in your .env / Railway environment variables.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import requests

logger = logging.getLogger(__name__)

POLYGON_BASE = "https://api.polygon.io"

# Period definitions: (multiplier, timespan, days_back)
CHART_PERIODS = {
    "1D": ("5",  "minute", 1),
    "1W": ("1",  "hour",   5),
    "1M": ("1",  "day",   30),
    "3M": ("1",  "day",   90),
    "1Y": ("1",  "week", 365),
}


def get_portfolio_data(ticker: str) -> dict:
    """
    Fetch current price, change %, sparkline, chart data, and company name
    for a single ticker using Polygon.io.

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
    logger.info(f"[MARKET] Fetching Polygon data for {ticker}")

    # --- Snapshot: current price + today's change ---
    price, change_pct = _get_snapshot(ticker, api_key)

    # --- Company name from reference endpoint ---
    name = _get_name(ticker, api_key) or ticker

    # --- Sparkline: last 30 trading days (daily closes) ---
    sparkline_data = _get_aggs(ticker, api_key, "1", "day", days_back=35)[-30:]

    # --- Chart data per time period ---
    chart_data: dict[str, list[float]] = {}
    for label, (mult, timespan, days_back) in CHART_PERIODS.items():
        chart_data[label] = _get_aggs(ticker, api_key, mult, timespan, days_back=days_back)

    logger.info(f"[MARKET] {ticker}: ${price} ({change_pct:+.2f}%)")

    return {
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


def _get_snapshot(ticker: str, api_key: str) -> tuple[float, float]:
    """
    Fetch current price and today's change % from the snapshot endpoint.
    Falls back to previous close if today's session hasn't opened yet.
    """
    url = f"{POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/{ticker}"
    resp = requests.get(url, params={"apiKey": api_key}, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    ticker_data = data.get("ticker", {})
    if not ticker_data:
        raise ValueError(f"No snapshot data for {ticker}")

    # Try today's session close first, fall back to previous day
    day = ticker_data.get("day", {})
    prev_day = ticker_data.get("prevDay", {})

    price = day.get("c") or prev_day.get("c") or 0
    change_pct = ticker_data.get("todaysChangePerc") or 0

    if not price:
        raise ValueError(f"No price data for {ticker}")

    return float(price), float(change_pct)


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
    Fetch aggregate close prices for a given time range.

    Args:
        multiplier: Size of the aggregate e.g. "1", "5"
        timespan:   "minute", "hour", "day", "week"
        days_back:  How many calendar days back to start from

    Returns:
        List of close prices in chronological order.
    """
    try:
        now = datetime.now(timezone.utc)
        from_date = (now - timedelta(days=days_back)).strftime("%Y-%m-%d")
        to_date = now.strftime("%Y-%m-%d")

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
        logger.warning(f"[MARKET] Could not fetch aggs for {ticker} ({timespan}): {exc}")
        return []
