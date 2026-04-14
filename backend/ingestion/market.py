"""
market.py — Market Data Fetcher (yfinance)

Purpose: Pulls current price, percentage change, sparkline data, and key
financial metrics (P/E ratio, revenue change) for a given ticker using
yfinance. This data feeds StockRow, StockChart, and MetricsRow on the
frontend dashboard.

Unlike the EDGAR/news pipeline, market data is NOT embedded into pgvector.
It is fetched fresh on each request directly from Yahoo Finance.

Uses fast_info for price data (lighter endpoint, less rate-limiting) and
yf.download() for historical price history (separate endpoint from info).
"""

import logging
import requests
import yfinance as yf

logger = logging.getLogger(__name__)

# Browser-like headers so Yahoo Finance doesn't block our requests
_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
})

# Period definitions for StockChart time buttons
# (period string for yf.download, interval for candle size)
CHART_PERIODS = {
    "1D": ("1d", "5m"),
    "1W": ("5d", "1h"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "1Y": ("1y", "1wk"),
}


def get_portfolio_data(ticker: str) -> dict:
    """
    Fetch current price, change %, sparkline, chart data, and metrics
    for a single ticker.

    Args:
        ticker: Stock ticker symbol e.g. "AAPL"

    Returns:
        Dict matching PortfolioResponse schema in models.py.

    Raises:
        ValueError: If the ticker is invalid or yfinance returns no data.
    """
    ticker = ticker.upper()
    logger.info(f"[MARKET] Fetching data for {ticker}")

    # Pass the browser-like session so Yahoo doesn't block the request
    stock = yf.Ticker(ticker, session=_SESSION)

    # --- Price data via history() — uses the session, avoids rate-limit blocks ---
    try:
        recent = stock.history(period="5d")
        if recent.empty:
            raise ValueError(f"No price data returned for {ticker} — ticker may be invalid")
        closes = recent["Close"].dropna().values.flatten()
        current_price = float(closes[-1])
        previous_close = float(closes[-2]) if len(closes) >= 2 else current_price
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Could not fetch price data for {ticker}: {exc}")

    change_pct = 0.0
    if previous_close and previous_close != 0:
        change_pct = ((current_price - previous_close) / previous_close) * 100

    # --- Company name and P/E ratio from info (best-effort, may be rate-limited) ---
    pe_ratio = None
    try:
        info = stock.info
        name = info.get("longName") or info.get("shortName") or ticker
        pe_ratio = info.get("trailingPE") or info.get("forwardPE") or None
    except Exception:
        # info endpoint gets rate-limited more aggressively — not critical
        logger.warning(f"[MARKET] Could not fetch info for {ticker} (rate limited?) — using ticker as name")
        name = ticker

    # --- Revenue change YoY (best-effort) ---
    revenue_change = None
    try:
        financials = stock.financials
        if financials is not None and not financials.empty and "Total Revenue" in financials.index:
            revenues = financials.loc["Total Revenue"].dropna()
            if len(revenues) >= 2:
                recent = revenues.iloc[0]
                prior = revenues.iloc[1]
                if prior and prior != 0:
                    revenue_change = ((recent - prior) / abs(prior)) * 100
    except Exception:
        pass

    # --- Historical price data via yf.download() (different endpoint from info) ---
    # Sparkline: last 30 trading days
    sparkline_data: list[float] = []
    try:
        hist = stock.history(period="1mo")
        if not hist.empty:
            closes = hist["Close"].tail(30)
            sparkline_data = [round(float(v), 2) for v in closes.values.flatten()]
    except Exception as exc:
        logger.warning(f"[MARKET] Could not fetch sparkline for {ticker}: {exc}")

    # --- Chart data for each time period button ---
    chart_data: dict[str, list[float]] = {}
    for period_label, (period, interval) in CHART_PERIODS.items():
        try:
            hist = stock.history(period=period, interval=interval)
            if not hist.empty:
                chart_data[period_label] = [round(float(v), 2) for v in hist["Close"].values.flatten()]
            else:
                chart_data[period_label] = []
        except Exception as exc:
            logger.warning(f"[MARKET] Could not fetch {period_label} chart for {ticker}: {exc}")
            chart_data[period_label] = []

    result = {
        "ticker": ticker,
        "name": name,
        "price": round(current_price, 2),
        "change_pct": round(change_pct, 2),
        "sparkline_data": sparkline_data,
        "chart_data": chart_data,
        "pe_ratio": round(pe_ratio, 2) if pe_ratio else None,
        "revenue_change": round(revenue_change, 2) if revenue_change else None,
        "risk_flags": 0,
        "last_filing": None,
        "yahoo_url": f"https://finance.yahoo.com/quote/{ticker}",
    }

    logger.info(f"[MARKET] {ticker}: ${result['price']} ({result['change_pct']:+.2f}%)")
    return result
