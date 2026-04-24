"""
quote_store.py — Persistent market quotes cache in Supabase.

Stores the latest quote snapshot for every ticker the scheduler refreshes.
The /quotes endpoint reads from here first; TwelveData is only called for
tickers that are missing or stale (> STALE_MINUTES old).

Run this migration once in the Supabase SQL Editor before deploying:

    CREATE TABLE IF NOT EXISTS market_quotes (
        ticker         TEXT PRIMARY KEY,
        name           TEXT,
        price          DOUBLE PRECISION,
        change_pct     DOUBLE PRECISION,
        market_cap     DOUBLE PRECISION,
        pe_ratio       DOUBLE PRECISION,
        eps            DOUBLE PRECISION,
        beta           DOUBLE PRECISION,
        revenue_change DOUBLE PRECISION,
        week_52_high   DOUBLE PRECISION,
        week_52_low    DOUBLE PRECISION,
        fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
"""

import logging
from backend.db import get_pg_conn

logger = logging.getLogger(__name__)

STALE_MINUTES = 60


def upsert_quotes(quotes: list[dict]) -> int:
    """Write a batch of quote dicts to market_quotes. Returns number upserted."""
    if not quotes:
        return 0
    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            for q in quotes:
                cur.execute("""
                    INSERT INTO market_quotes
                        (ticker, name, price, change_pct, market_cap, pe_ratio,
                         eps, beta, revenue_change, week_52_high, week_52_low, fetched_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (ticker) DO UPDATE SET
                        name           = EXCLUDED.name,
                        price          = EXCLUDED.price,
                        change_pct     = EXCLUDED.change_pct,
                        market_cap     = EXCLUDED.market_cap,
                        pe_ratio       = EXCLUDED.pe_ratio,
                        eps            = EXCLUDED.eps,
                        beta           = EXCLUDED.beta,
                        revenue_change = EXCLUDED.revenue_change,
                        week_52_high   = EXCLUDED.week_52_high,
                        week_52_low    = EXCLUDED.week_52_low,
                        fetched_at     = NOW()
                """, (
                    q.get("ticker", "").upper(),
                    q.get("name"),
                    q.get("price"),
                    q.get("change_pct"),
                    q.get("market_cap"),
                    q.get("pe_ratio"),
                    q.get("eps"),
                    q.get("beta"),
                    q.get("revenue_change"),
                    q.get("week_52_high"),
                    q.get("week_52_low"),
                ))
        conn.commit()
        logger.info(f"[QUOTE_STORE] Upserted {len(quotes)} quotes")
        return len(quotes)
    except Exception as exc:
        conn.rollback()
        logger.error(f"[QUOTE_STORE] upsert failed: {exc}")
        raise
    finally:
        conn.close()


def get_quotes_from_db(tickers: list[str]) -> dict[str, dict]:
    """
    Return fresh quotes from DB for the given tickers.
    Only rows where fetched_at is within STALE_MINUTES are returned.
    Result is a dict keyed by ticker — missing or stale tickers are absent.
    """
    if not tickers:
        return {}
    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ticker, name, price, change_pct, market_cap, pe_ratio,
                       eps, beta, revenue_change, week_52_high, week_52_low
                FROM market_quotes
                WHERE ticker = ANY(%s)
                  AND fetched_at > NOW() - (%s * INTERVAL '1 minute')
            """, (tickers, STALE_MINUTES))
            rows = cur.fetchall()

        result = {}
        for row in rows:
            (ticker, name, price, change_pct, market_cap, pe_ratio,
             eps, beta, revenue_change, week_52_high, week_52_low) = row
            result[ticker] = {
                "ticker":         ticker,
                "name":           name,
                "price":          price,
                "change_pct":     change_pct,
                "market_cap":     market_cap,
                "pe_ratio":       pe_ratio,
                "eps":            eps,
                "beta":           beta,
                "revenue_change": revenue_change,
                "week_52_high":   week_52_high,
                "week_52_low":    week_52_low,
                "sparkline_data": [],
                "chart_data":     {},
                "yahoo_url":      f"https://finance.yahoo.com/quote/{ticker}",
            }
        return result
    finally:
        conn.close()


def get_all_cached_tickers() -> list[str]:
    """Return all tickers currently stored in market_quotes."""
    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT ticker FROM market_quotes ORDER BY ticker")
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()
