"""
xbrl.py — SEC EDGAR XBRL Financial Data Fetcher

Purpose: Fetches structured financial statement data (revenue, gross profit,
operating income, net income) directly from the SEC EDGAR XBRL API.
Free, unlimited, no API key required. Data comes straight from company filings.

EDGAR API endpoints used:
    https://www.sec.gov/files/company_tickers.json   — ticker → CIK map
    https://data.sec.gov/api/xbrl/companyfacts/{CIK}.json — all financial facts

Called during /ingest — results are stored in the 'financials' Supabase table
and served from there. Never called on a per-request basis.
"""

import logging
import time

import requests

logger = logging.getLogger(__name__)

EDGAR_BASE = "https://data.sec.gov"
SEC_BASE   = "https://www.sec.gov"

# EDGAR requires a descriptive User-Agent or it returns 403
USER_AGENT = "Kite/0.1 portfolio-analytics (github.com/kite)"

# In-memory ticker → CIK cache, loaded once per process
_ticker_cik: dict[str, int] = {}

# XBRL tags to try for each metric, in priority order
REVENUE_TAGS = [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
]
GROSS_PROFIT_TAGS    = ["GrossProfit"]
OPERATING_INCOME_TAGS = ["OperatingIncomeLoss"]
NET_INCOME_TAGS      = [
    "NetIncomeLoss",
    "NetIncomeLossAvailableToCommonStockholdersBasic",
    "ProfitLoss",
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_financial_facts(ticker: str) -> dict:
    """
    Fetch and parse income statement data for a ticker from EDGAR XBRL.

    Returns:
        {
          "ticker": "AAPL",
          "annual":    [ { date, period_type, fiscal_period, fiscal_year,
                           revenue, gross_profit, operating_income, net_income }, ... ],
          "quarterly": [ ... ]
        }
        Annual list is newest-first, up to 8 years.
        Quarterly list is newest-first, up to 12 quarters.

    Raises:
        ValueError: If CIK cannot be resolved for the ticker.
        requests.HTTPError: If EDGAR returns a non-2xx status.
    """
    ticker = ticker.upper()
    cik    = _get_cik(ticker)
    if cik is None:
        raise ValueError(f"[XBRL] CIK not found for {ticker}")

    cik_str = str(cik).zfill(10)
    url     = f"{EDGAR_BASE}/api/xbrl/companyfacts/CIK{cik_str}.json"

    logger.info(f"[XBRL] Fetching companyfacts for {ticker} (CIK {cik})")
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()

    facts   = resp.json()
    us_gaap = facts.get("facts", {}).get("us-gaap", {})

    revenue          = _extract_metric(us_gaap, REVENUE_TAGS)
    gross_profit     = _extract_metric(us_gaap, GROSS_PROFIT_TAGS)
    operating_income = _extract_metric(us_gaap, OPERATING_INCOME_TAGS)
    net_income       = _extract_metric(us_gaap, NET_INCOME_TAGS)

    return _build_periods(ticker, revenue, gross_profit, operating_income, net_income)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_cik(ticker: str) -> int | None:
    """Return the SEC CIK integer for a ticker, loading the map if needed."""
    if not _ticker_cik:
        _load_cik_map()
    return _ticker_cik.get(ticker.upper())


def _load_cik_map() -> None:
    """Download the SEC company_tickers.json and populate the in-memory cache."""
    try:
        resp = requests.get(
            f"{SEC_BASE}/files/company_tickers.json",
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        resp.raise_for_status()
        for entry in resp.json().values():
            _ticker_cik[entry["ticker"].upper()] = entry["cik_str"]
        logger.info(f"[XBRL] Loaded CIK map: {len(_ticker_cik)} tickers")
    except Exception as exc:
        logger.error(f"[XBRL] Failed to load CIK map: {exc}")


def _extract_metric(us_gaap: dict, tag_names: list[str]) -> list[dict]:
    """
    Try each XBRL tag in order, return USD-denominated values from 10-K/10-Q
    filings only. Returns the first tag that has data.
    """
    for tag in tag_names:
        values = us_gaap.get(tag, {}).get("units", {}).get("USD", [])
        filtered = [
            v for v in values
            if v.get("form") in ("10-K", "10-Q") and v.get("fp") and v.get("end")
        ]
        if filtered:
            logger.debug(f"[XBRL] Using tag '{tag}' ({len(filtered)} entries)")
            return filtered
    return []


def _build_periods(
    ticker: str,
    revenue: list,
    gross_profit: list,
    operating_income: list,
    net_income: list,
) -> dict:
    """
    Merge all metric series into a dict of periods keyed by (fiscal_date, period_type).
    Deduplicates by taking the most recently filed value for each period.
    """
    periods: dict[tuple, dict] = {}

    def add(values: list, key: str) -> None:
        # Sort by filed date so later amendments win on conflict
        for v in sorted(values, key=lambda x: x.get("filed", "")):
            fiscal_date = v.get("end", "")
            form        = v.get("form", "")
            fp          = v.get("fp", "")

            period_type = "annual" if form == "10-K" else "quarterly"
            pk          = (fiscal_date, period_type)

            if pk not in periods:
                periods[pk] = {
                    "date":             fiscal_date,
                    "period_type":      period_type,
                    "fiscal_period":    fp,
                    "fiscal_year":      v.get("fy"),
                    "revenue":          None,
                    "gross_profit":     None,
                    "operating_income": None,
                    "net_income":       None,
                }
            periods[pk][key] = v.get("val")

    add(revenue,          "revenue")
    add(gross_profit,     "gross_profit")
    add(operating_income, "operating_income")
    add(net_income,       "net_income")

    all_periods = sorted(periods.values(), key=lambda p: p["date"], reverse=True)

    annual    = [p for p in all_periods if p["period_type"] == "annual"][:8]
    quarterly = [p for p in all_periods if p["period_type"] == "quarterly"][:12]

    logger.info(
        f"[XBRL] {ticker}: {len(annual)} annual periods, "
        f"{len(quarterly)} quarterly periods parsed"
    )
    return {"ticker": ticker, "annual": annual, "quarterly": quarterly}
