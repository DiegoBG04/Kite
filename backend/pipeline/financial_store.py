"""
financial_store.py — Supabase Storage for Financial Statement Data

Purpose: Reads and writes income statement data to the 'financials' table
in Supabase. Called during ingestion (write) and by the /financials API
route (read). Uses psycopg2 for consistency with the rest of the pipeline.

Run the SQL in supabase_schema.sql to create the table before using this.
"""

import logging
from datetime import date

from backend.db import get_pg_conn

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def upsert_financials(ticker: str, periods: list[dict]) -> int:
    """
    Insert or update financial periods for a ticker in the 'financials' table.

    Args:
        ticker:  Ticker symbol e.g. "AAPL"
        periods: List of period dicts from xbrl.fetch_financial_facts().
                 Each must have: date, period_type, fiscal_period, fiscal_year,
                 revenue, gross_profit, operating_income, net_income.

    Returns:
        Number of rows upserted.
    """
    if not periods:
        logger.warning(f"[FIN_STORE] No periods to upsert for {ticker}")
        return 0

    ticker = ticker.upper()
    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            for p in periods:
                cur.execute("""
                    INSERT INTO financials
                        (ticker, fiscal_date, period_type, fiscal_period,
                         fiscal_year, revenue, gross_profit, operating_income, net_income)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (ticker, fiscal_date, period_type)
                    DO UPDATE SET
                        fiscal_period    = EXCLUDED.fiscal_period,
                        fiscal_year      = EXCLUDED.fiscal_year,
                        revenue          = EXCLUDED.revenue,
                        gross_profit     = EXCLUDED.gross_profit,
                        operating_income = EXCLUDED.operating_income,
                        net_income       = EXCLUDED.net_income
                """, (
                    ticker,
                    p["date"] or None,
                    p["period_type"],
                    p.get("fiscal_period"),
                    p.get("fiscal_year"),
                    p.get("revenue"),
                    p.get("gross_profit"),
                    p.get("operating_income"),
                    p.get("net_income"),
                ))

        conn.commit()
        logger.info(f"[FIN_STORE] Upserted {len(periods)} periods for {ticker}")
        return len(periods)

    except Exception as exc:
        conn.rollback()
        logger.error(f"[FIN_STORE] upsert_financials failed for {ticker}: {exc}")
        raise

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_financials_from_db(ticker: str) -> dict:
    """
    Read financial periods for a ticker from the 'financials' table.

    Returns:
        {
          "ticker": "AAPL",
          "annual":    [ { date, revenue, gross_profit, operating_income, net_income }, ... ],
          "quarterly": [ ... ]
        }
        Both lists are sorted newest-first.
        Returns empty lists if no data has been ingested yet.
    """
    ticker = ticker.upper()
    conn   = get_pg_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT fiscal_date, period_type, revenue, gross_profit,
                       operating_income, net_income
                FROM financials
                WHERE ticker = %s
                ORDER BY fiscal_date DESC
            """, (ticker,))
            rows = cur.fetchall()

        annual    = []
        quarterly = []
        for fiscal_date, period_type, revenue, gross_profit, op_income, net_income in rows:
            entry = {
                "date":             str(fiscal_date) if fiscal_date else "",
                "revenue":          revenue,
                "gross_profit":     gross_profit,
                "operating_income": op_income,
                "net_income":       net_income,
            }
            if period_type == "annual":
                annual.append(entry)
            else:
                quarterly.append(entry)

        logger.info(
            f"[FIN_STORE] {ticker}: {len(annual)} annual, {len(quarterly)} quarterly from DB"
        )
        return {"ticker": ticker, "annual": annual, "quarterly": quarterly}

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def get_all_ingested_tickers() -> list[str]:
    """
    Return all tickers that have data in the financials table.
    Used by the nightly scheduler to know which tickers to refresh.
    """
    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT ticker FROM financials ORDER BY ticker")
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()
