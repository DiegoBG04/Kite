"""
scheduler.py — Nightly Background Job Scheduler

Runs alongside FastAPI using APScheduler. Jobs:
  - 2:00 AM UTC daily: Re-fetch EDGAR XBRL financials for all ingested tickers
  - (Future) Midnight UTC: Re-ingest SEC filings
  - (Future) Hourly: Refresh news

Wire into main.py lifespan — see setup_jobs() below.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def setup_jobs() -> None:
    """
    Register all recurring background jobs.
    Called once at app startup from main.py lifespan.
    """
    scheduler.add_job(
        _refresh_all_financials,
        trigger="cron",
        hour=2,
        minute=0,
        id="nightly_financials",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered nightly financials refresh (2:00 AM UTC)")


async def _refresh_all_financials() -> None:
    """
    Re-fetch EDGAR XBRL financial data for every ticker in the financials table.
    Runs nightly so the charts always show up-to-date quarterly/annual data.
    """
    from backend.ingestion.xbrl import fetch_financial_facts
    from backend.pipeline.financial_store import upsert_financials, get_all_ingested_tickers

    tickers = get_all_ingested_tickers()
    if not tickers:
        logger.info("[SCHEDULER] No tickers to refresh")
        return

    logger.info(f"[SCHEDULER] Refreshing financials for {len(tickers)} tickers: {tickers}")

    for ticker in tickers:
        try:
            facts = fetch_financial_facts(ticker)
            all_periods = facts["annual"] + facts["quarterly"]
            upsert_financials(ticker, all_periods)
            logger.info(f"[SCHEDULER] ✓ {ticker} refreshed")
        except Exception as exc:
            logger.warning(f"[SCHEDULER] Failed to refresh {ticker}: {exc}")
