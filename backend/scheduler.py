"""
scheduler.py — Daily Cron Job Scheduler

Purpose: Uses APScheduler to run recurring background tasks without needing
Celery or a separate worker process. Starts alongside the FastAPI app and
runs jobs on a fixed daily schedule.

Scheduled jobs:
    - Midnight UTC: Re-ingest filings for all subscribed tickers
    - 6:00 AM UTC:  Generate daily portfolio briefings
    - Every hour:   Fetch latest news for subscribed tickers

APScheduler is simpler than Celery for a solo/small-team MVP. If job volume
grows or we need distributed workers, switch to Celery + Redis later.

TODO (Step 7): Wire scheduler into FastAPI lifespan events in main.py.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Scheduler instance — created here, started in main.py lifespan handler
scheduler = AsyncIOScheduler()


def setup_jobs(tickers: list[str]) -> None:
    """
    Register all recurring jobs with the scheduler.

    Call this once during app startup, passing the list of portfolio tickers
    to ingest and brief on.

    Args:
        tickers: List of ticker symbols to process e.g. ["AAPL", "MSFT", "TSLA"]
    """
    raise NotImplementedError("scheduler.setup_jobs() — not yet implemented (Step 7)")
