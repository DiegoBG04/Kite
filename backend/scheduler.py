"""
scheduler.py — Background Job Scheduler

Jobs:
  - Every 15 min during US market hours: refresh quotes for the full market
    universe and write to market_quotes table in Supabase. This means user
    requests read from DB instead of hitting TwelveData directly — one batch
    API call serves all users regardless of how many are active.
  - 2:00 AM UTC daily: re-fetch EDGAR XBRL financials for all ingested tickers.
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# Every ticker the app might ever need a quote for.
# Index/sector ETFs are always needed for the Market page.
# The large-cap universe covers most user portfolios and the movers list.
MARKET_UNIVERSE = [
    # US index ETFs
    "SPY", "QQQ", "DIA", "IWM",
    # Sector ETFs
    "XLE", "XLK", "XLF", "XLP", "XLY", "XLB", "XLV", "XLC", "XLI", "XLU", "XLRE",
    # Large-cap universe (Market Movers + common portfolio holdings)
    "AAPL", "MSFT", "NVDA", "META", "GOOGL", "AMZN", "TSLA", "AMD", "CSCO", "ORCL",
    "AVGO", "LRCX", "JPM", "GS", "V", "C", "BRK-B", "HD", "WMT", "PG",
    "LLY", "UNH", "MRK", "DHR", "ISRG", "CVX", "COP", "XOM", "BA", "GE",
    "HON", "MMM", "LMT", "RTX", "DE", "TMUS",
]


def _is_market_open() -> bool:
    """True during US equity market hours (approx 9:30am–4pm ET, Mon–Fri)."""
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:          # Saturday=5, Sunday=6
        return False
    h = now.hour + now.minute / 60
    return 13.5 <= h <= 21.0        # 9:30am–4:00pm ET in UTC


def setup_jobs() -> None:
    scheduler.add_job(
        _refresh_market_quotes,
        trigger="interval",
        minutes=15,
        id="market_quote_refresh",
        replace_existing=True,
    )
    scheduler.add_job(
        _refresh_all_financials,
        trigger="cron",
        hour=2,
        minute=0,
        id="nightly_financials",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered: market quote refresh (every 15 min), nightly financials (2:00 AM UTC)")


async def _refresh_market_quotes() -> None:
    """
    Fetch the latest quote for every ticker in MARKET_UNIVERSE plus any
    additional tickers stored in the financials table, then upsert into
    market_quotes. Runs every 15 minutes but skips the TwelveData call
    outside market hours if the DB data is less than 6 hours old.
    """
    from backend.ingestion.market import get_batch_quotes
    from backend.pipeline.quote_store import upsert_quotes
    from backend.pipeline.financial_store import get_all_ingested_tickers

    # Build full ticker list: fixed universe + user-ingested tickers
    try:
        extra = get_all_ingested_tickers()
    except Exception:
        extra = []

    all_tickers = list(dict.fromkeys(MARKET_UNIVERSE + extra))  # deduped, order preserved

    # Outside market hours we skip the live fetch — prices haven't changed.
    # The DB already holds the last closing values.
    if not _is_market_open():
        logger.info("[SCHEDULER] Market closed — skipping quote refresh")
        return

    logger.info(f"[SCHEDULER] Refreshing {len(all_tickers)} quotes…")

    try:
        quotes = get_batch_quotes(all_tickers)
        if quotes:
            upsert_quotes(quotes)
            logger.info(f"[SCHEDULER] ✓ {len(quotes)} quotes stored")
        else:
            logger.warning("[SCHEDULER] Quote refresh returned no data")
    except Exception as exc:
        logger.warning(f"[SCHEDULER] Quote refresh failed: {exc}")


async def _refresh_all_financials() -> None:
    """Re-fetch EDGAR XBRL financial data for every ingested ticker."""
    from backend.ingestion.xbrl import fetch_financial_facts
    from backend.pipeline.financial_store import upsert_financials, get_all_ingested_tickers

    tickers = get_all_ingested_tickers()
    if not tickers:
        logger.info("[SCHEDULER] No tickers to refresh")
        return

    logger.info(f"[SCHEDULER] Refreshing financials for {len(tickers)} tickers")

    for ticker in tickers:
        try:
            facts = fetch_financial_facts(ticker)
            upsert_financials(ticker, facts["annual"] + facts["quarterly"])
            logger.info(f"[SCHEDULER] ✓ {ticker} financials refreshed")
        except Exception as exc:
            logger.warning(f"[SCHEDULER] Failed to refresh {ticker}: {exc}")
