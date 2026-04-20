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

import collections
import logging
import os
import threading
import time

import requests

logger = logging.getLogger(__name__)

TWELVE_BASE = "https://api.twelvedata.com"

CACHE_TTL_SECONDS = 900  # 15 minutes
_cache: dict[str, dict] = {}  # ticker → {"data": ..., "expires": float}

FIN_CACHE_TTL = 3600  # 1 hour — DB reads are fast, cache to avoid hammering Supabase
_fin_cache: dict[str, dict] = {}  # ticker → {"data": ..., "expires": float}


# ── Rate limiter ─────────────────────────────────────────────────────────────
# Twelve Data free tier: 8 calls/minute. We stay at ≤7 to leave headroom.
# Uses a global deque of call timestamps so concurrent fetches respect the limit.

_rl_lock  = threading.Lock()
_rl_times: collections.deque = collections.deque()
_RL_MAX   = 7      # max calls per window
_RL_WIN   = 61.0   # window in seconds (slightly over 60 to be safe)


def _api_call(fn):
    """Wrap an API call with the global rate limiter. Blocks if at the limit."""
    with _rl_lock:
        now = time.time()
        while _rl_times and _rl_times[0] < now - _RL_WIN:
            _rl_times.popleft()
        if len(_rl_times) >= _RL_MAX:
            wait = (_rl_times[0] + _RL_WIN) - now
            if wait > 0:
                logger.info(f"[RATE] API limit reached — waiting {wait:.1f}s")
                time.sleep(wait)
            # Re-prune after sleeping
            now = time.time()
            while _rl_times and _rl_times[0] < now - _RL_WIN:
                _rl_times.popleft()
        _rl_times.append(time.time())
    return fn()


# ── Chart period definitions ──────────────────────────────────────────────────
# Instead of 11 separate API calls (one per period), we fetch only 5 raw series
# and slice them to produce every period. 5 calls + 1 quote = 6 total per ticker.

# Raw series fetched from Twelve Data: interval → outputsize
_RAW_FETCH = {
    "5min":   78,   # 1 trading day of 5-min bars
    "1h":    120,   # ~3 weeks of hourly bars (enough for 1W at 35 bars)
    "1day":  520,   # ~2 years of daily bars  (1M / 3M / 6M / YTD / 1Y / 2Y)
    "1week": 262,   # ~5 years of weekly bars (5Y)
    "1month":480,   # ~40 years of monthly bars (10Y / MAX)
}

# How each user-facing period is built from a raw series: (raw_interval, n_bars)
_PERIOD_SLICE = {
    "1D":  ("5min",    78),
    "1W":  ("1h",      35),
    "1M":  ("1day",    22),
    "3M":  ("1day",    65),
    "6M":  ("1day",   130),
    "YTD": ("1day",   105),
    "1Y":  ("1day",   252),
    "2Y":  ("1day",   504),   # use full daily buffer
    "5Y":  ("1week",  261),
    "10Y": ("1month", 120),
    "MAX": ("1month", 480),
}


_quote_cache: dict[str, dict] = {}  # ticker → {"data": ..., "expires": float}
QUOTE_CACHE_TTL = 60  # 1 minute — refreshed often for live prices


def _parse_quote_payload(ticker: str, data: dict) -> dict:
    """Build a PortfolioResponse-compatible dict from a single /quote payload."""
    def _safe(key):
        try: return float(data[key])
        except (KeyError, TypeError, ValueError): return None

    def _safe_nested(outer, inner):
        try: return float(data[outer][inner])
        except (KeyError, TypeError, ValueError): return None

    price      = _safe("close") or _safe("previous_close") or 0.0
    change_pct = _safe("percent_change") or 0.0
    name       = data.get("name") or ticker

    if not price:
        raise ValueError(f"No price data returned for {ticker}")

    return {
        "ticker":       ticker,
        "name":         name,
        "price":        round(price, 2),
        "change_pct":   round(change_pct, 2),
        "sparkline_data": [],
        "chart_data":   {},
        "pe_ratio":     _safe("pe"),
        "market_cap":   _safe("market_cap"),
        "revenue_change": None,
        "risk_flags":   0,
        "last_filing":  None,
        "yahoo_url":    f"https://finance.yahoo.com/quote/{ticker}",
        "open_price":   _safe("open"),
        "day_high":     _safe("high"),
        "day_low":      _safe("low"),
        "volume":       _safe("volume"),
        "week_52_high": _safe_nested("fifty_two_week", "high"),
        "week_52_low":  _safe_nested("fifty_two_week", "low"),
        "eps":          _safe("eps"),
        "beta":         _safe("beta"),
    }


def get_batch_quotes(tickers: list[str]) -> list[dict]:
    """
    Fetch quotes for multiple tickers in a single API call.
    TwelveData /quote accepts comma-separated symbols — 30 tickers = 1 call.
    Returns a list of PortfolioResponse-compatible dicts (skips failed tickers).
    """
    api_key = os.getenv("TWELVE_DATA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("TWELVE_DATA_API_KEY environment variable is not set")

    tickers = [t.upper() for t in tickers]
    now = time.time()

    # Return all from cache if still fresh
    missing = [t for t in tickers if not (_quote_cache.get(t) and _quote_cache[t]["expires"] > now)]
    cached_results = [_quote_cache[t]["data"] for t in tickers if t not in missing]

    if not missing:
        return cached_results

    logger.info(f"[BATCH_QUOTE] Fetching {len(missing)} tickers: {', '.join(missing)}")

    def _fetch():
        resp = requests.get(f"{TWELVE_BASE}/quote", params={
            "symbol": ",".join(missing),
            "apikey": api_key,
        }, timeout=15)
        resp.raise_for_status()
        return resp.json()

    raw = _api_call(_fetch)

    # Single ticker → dict directly; multiple → dict keyed by ticker
    if len(missing) == 1:
        raw = {missing[0]: raw}

    results = list(cached_results)
    for ticker in missing:
        payload = raw.get(ticker, {})
        if payload.get("status") == "error":
            logger.warning(f"[BATCH_QUOTE] Error for {ticker}: {payload.get('message')}")
            continue
        try:
            result = _parse_quote_payload(ticker, payload)
            # Derive P/E from price / EPS when TwelveData doesn't return it
            if result["pe_ratio"] is None and result["eps"] and result["eps"] > 0:
                result["pe_ratio"] = round(result["price"] / result["eps"], 2)
            _quote_cache[ticker] = {"data": result, "expires": now + QUOTE_CACHE_TTL}
            results.append(result)
        except Exception as exc:
            logger.warning(f"[BATCH_QUOTE] Skipping {ticker}: {exc}")

    return results


def get_quote_data(ticker: str) -> dict:
    """
    Lightweight quote — 1 API call only. Returns price, stats, and sparkline.
    No chart time series. Used for portfolio table and watchlist price display.
    """
    api_key = os.getenv("TWELVE_DATA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("TWELVE_DATA_API_KEY environment variable is not set")

    ticker = ticker.upper()

    cached = _quote_cache.get(ticker)
    if cached and cached["expires"] > time.time():
        return cached["data"]

    logger.info(f"[QUOTE] Fetching quote for {ticker}")
    price, change_pct, name, market_cap, pe_ratio, open_price, day_high, day_low, volume, week_52_high, week_52_low, eps, beta = \
        _api_call(lambda: _get_quote(ticker, api_key))

    # Derive P/E from price / EPS when TwelveData doesn't return it
    if pe_ratio is None and eps and eps > 0:
        pe_ratio = round(price / eps, 2)

    result = {
        "ticker": ticker,
        "name": name or ticker,
        "price": round(price, 2),
        "change_pct": round(change_pct, 2),
        "sparkline_data": [],
        "chart_data": {},
        "pe_ratio": pe_ratio,
        "market_cap": market_cap,
        "revenue_change": None,
        "risk_flags": 0,
        "last_filing": None,
        "yahoo_url": f"https://finance.yahoo.com/quote/{ticker}",
        "open_price": open_price,
        "day_high": day_high,
        "day_low": day_low,
        "volume": volume,
        "week_52_high": week_52_high,
        "week_52_low": week_52_low,
        "eps": eps,
        "beta": beta,
    }
    _quote_cache[ticker] = {"data": result, "expires": time.time() + QUOTE_CACHE_TTL}
    return result


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

    # --- Quote: 1 API call (rate-limited) ---
    price, change_pct, name, market_cap, pe_ratio, open_price, day_high, day_low, volume, week_52_high, week_52_low, eps, beta = \
        _api_call(lambda: _get_quote(ticker, api_key))

    # --- Fetch 5 raw series instead of 11 separate ones ---
    # Each raw interval feeds multiple user-facing periods (sliced on the right).
    raw: dict[str, list[float]] = {}
    for interval, outputsize in _RAW_FETCH.items():
        raw[interval] = _api_call(
            lambda iv=interval, sz=outputsize: _get_time_series(ticker, api_key, iv, sz)
        )

    # Build every user-facing period by slicing the appropriate raw series
    chart_data: dict[str, list[float]] = {}
    for period, (interval, n) in _PERIOD_SLICE.items():
        series = raw.get(interval, [])
        chart_data[period] = series[-n:] if len(series) >= n else series

    # Reuse daily data for sparkline — no extra API call
    sparkline_data = chart_data.get("1M", [])[-30:]

    logger.info(f"[MARKET] {ticker}: ${price} ({change_pct:+.2f}%)")

    result = {
        "ticker": ticker,
        "name": name or ticker,
        "price": round(price, 2),
        "change_pct": round(change_pct, 2),
        "sparkline_data": sparkline_data,
        "chart_data": chart_data,
        "pe_ratio": pe_ratio,
        "market_cap": market_cap,
        "revenue_change": None,
        "risk_flags": 0,
        "last_filing": None,
        "yahoo_url": f"https://finance.yahoo.com/quote/{ticker}",
        "open_price": open_price,
        "day_high": day_high,
        "day_low": day_low,
        "volume": volume,
        "week_52_high": week_52_high,
        "week_52_low": week_52_low,
        "eps": eps,
        "beta": beta,
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


def _get_quote(ticker: str, api_key: str) -> tuple:
    """
    Fetch current price, percent change, company name, and intraday stats in one call.
    Uses /quote endpoint which supports multiple symbols.
    Returns: (price, change_pct, name, market_cap, pe_ratio,
              open_price, day_high, day_low, volume,
              week_52_high, week_52_low, eps, beta)
    """
    resp = requests.get(f"{TWELVE_BASE}/quote", params={
        "symbol": ticker,
        "apikey": api_key,
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") == "error":
        raise ValueError(f"Twelve Data error for {ticker}: {data.get('message')}")

    price      = float(data.get("close") or data.get("previous_close") or 0)
    change_pct = float(data.get("percent_change") or 0)
    name       = data.get("name") or ticker

    def _safe(key):
        try: return float(data[key])
        except (KeyError, TypeError, ValueError): return None

    def _safe_nested(outer, inner):
        try: return float(data[outer][inner])
        except (KeyError, TypeError, ValueError): return None

    market_cap   = _safe("market_cap")
    pe_ratio     = _safe("pe")
    open_price   = _safe("open")
    day_high     = _safe("high")
    day_low      = _safe("low")
    volume       = _safe("volume")
    week_52_high = _safe_nested("fifty_two_week", "high")
    week_52_low  = _safe_nested("fifty_two_week", "low")
    eps          = _safe("eps")
    beta         = _safe("beta")

    if not price:
        raise ValueError(f"No price data returned for {ticker}")

    return price, change_pct, name, market_cap, pe_ratio, open_price, day_high, day_low, volume, week_52_high, week_52_low, eps, beta


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
