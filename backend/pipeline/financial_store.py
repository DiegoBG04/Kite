"""
financial_store.py — Supabase Storage for Financial Statement Data

Purpose: Reads and writes income statement, cash flow, and balance sheet data
to the 'financials' table in Supabase. Called during ingestion (write) and by
the /financials API route (read).

Run this migration in Supabase SQL editor before deploying:

    ALTER TABLE financials
    ADD COLUMN IF NOT EXISTS operating_cash_flow FLOAT,
    ADD COLUMN IF NOT EXISTS capital_expenditure  FLOAT,
    ADD COLUMN IF NOT EXISTS free_cash_flow       FLOAT,
    ADD COLUMN IF NOT EXISTS cash_and_equivalents FLOAT,
    ADD COLUMN IF NOT EXISTS total_debt           FLOAT;
"""

import logging
from backend.db import get_pg_conn

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def upsert_financials(ticker: str, periods: list[dict]) -> int:
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
                         fiscal_year, revenue, gross_profit, operating_income, net_income,
                         operating_cash_flow, capital_expenditure, free_cash_flow,
                         cash_and_equivalents, total_debt)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (ticker, fiscal_date, period_type)
                    DO UPDATE SET
                        fiscal_period        = EXCLUDED.fiscal_period,
                        fiscal_year          = EXCLUDED.fiscal_year,
                        revenue              = EXCLUDED.revenue,
                        gross_profit         = EXCLUDED.gross_profit,
                        operating_income     = EXCLUDED.operating_income,
                        net_income           = EXCLUDED.net_income,
                        operating_cash_flow  = EXCLUDED.operating_cash_flow,
                        capital_expenditure  = EXCLUDED.capital_expenditure,
                        free_cash_flow       = EXCLUDED.free_cash_flow,
                        cash_and_equivalents = EXCLUDED.cash_and_equivalents,
                        total_debt           = EXCLUDED.total_debt
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
                    p.get("operating_cash_flow"),
                    p.get("capital_expenditure"),
                    p.get("free_cash_flow"),
                    p.get("cash_and_equivalents"),
                    p.get("total_debt"),
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
    ticker = ticker.upper()
    conn   = get_pg_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT fiscal_date, period_type,
                       revenue, gross_profit, operating_income, net_income,
                       operating_cash_flow, capital_expenditure, free_cash_flow,
                       cash_and_equivalents, total_debt
                FROM financials
                WHERE ticker = %s
                ORDER BY fiscal_date DESC
            """, (ticker,))
            rows = cur.fetchall()

        annual    = []
        quarterly = []
        for row in rows:
            (fiscal_date, period_type,
             revenue, gross_profit, op_income, net_income,
             op_cf, capex, fcf, cash, debt) = row

            entry = {
                "date":                str(fiscal_date) if fiscal_date else "",
                "revenue":             revenue,
                "gross_profit":        gross_profit,
                "operating_income":    op_income,
                "net_income":          net_income,
                "operating_cash_flow": op_cf,
                "capital_expenditure": capex,
                "free_cash_flow":      fcf,
                "cash_and_equivalents": cash,
                "total_debt":          debt,
            }
            if period_type == "annual":
                annual.append(entry)
            else:
                quarterly.append(entry)

        logger.info(f"[FIN_STORE] {ticker}: {len(annual)} annual, {len(quarterly)} quarterly from DB")
        return {"ticker": ticker, "annual": annual, "quarterly": quarterly}

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def get_all_ingested_tickers() -> list[str]:
    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT ticker FROM financials ORDER BY ticker")
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()
