"""
ts_store.py — Supabase cache for time series (historical close prices).

Table: time_series_cache
  ticker TEXT, interval TEXT, outputsize INT → data JSONB, fetched_at TIMESTAMPTZ
  PRIMARY KEY (ticker, interval, outputsize)

TTL: 6 hours. Historical closes from yesterday's session are valid all day;
     we don't need per-minute freshness for charts.

SQL to run in Supabase:
    CREATE TABLE IF NOT EXISTS time_series_cache (
        ticker      TEXT    NOT NULL,
        interval    TEXT    NOT NULL,
        outputsize  INTEGER NOT NULL,
        data        JSONB   NOT NULL DEFAULT '{}',
        fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (ticker, interval, outputsize)
    );
"""

import logging
import os
from datetime import datetime, timezone, timedelta

import psycopg2

logger = logging.getLogger(__name__)

STALE_HOURS = 6


def _conn():
    url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("SUPABASE_DB_URL not set")
    return psycopg2.connect(url)


def get_ts_from_db(
    tickers: list[str],
    interval: str,
    outputsize: int,
) -> dict[str, dict]:
    """
    Return cached time series rows that are still fresh (<= STALE_HOURS old).
    Returns { ticker: {"closes": [...], "dates": [...]} } for hits only.
    """
    if not tickers:
        return {}
    cutoff = datetime.now(timezone.utc) - timedelta(hours=STALE_HOURS)
    try:
        with _conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT ticker, data
                FROM time_series_cache
                WHERE ticker = ANY(%s)
                  AND interval = %s
                  AND outputsize = %s
                  AND fetched_at >= %s
                """,
                (tickers, interval, outputsize, cutoff),
            )
            rows = cur.fetchall()
        result = {}
        for ticker, data in rows:
            result[ticker] = data
        logger.info(f"[TS_STORE] DB hit: {len(result)}/{len(tickers)} tickers ({interval})")
        return result
    except Exception as exc:
        logger.warning(f"[TS_STORE] DB read failed: {exc}")
        return {}


def upsert_ts(
    series: dict[str, dict],
    interval: str,
    outputsize: int,
) -> None:
    """Write {ticker: {"closes": [...], "dates": [...]}} rows to DB."""
    if not series:
        return
    import json
    now = datetime.now(timezone.utc)
    rows = [
        (ticker, interval, outputsize, json.dumps(data), now)
        for ticker, data in series.items()
        if data.get("closes")  # don't cache empty results
    ]
    if not rows:
        return
    try:
        with _conn() as conn, conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO time_series_cache (ticker, interval, outputsize, data, fetched_at)
                VALUES (%s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (ticker, interval, outputsize)
                DO UPDATE SET data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at
                """,
                rows,
            )
        logger.info(f"[TS_STORE] Upserted {len(rows)} rows ({interval})")
    except Exception as exc:
        logger.warning(f"[TS_STORE] DB write failed: {exc}")
