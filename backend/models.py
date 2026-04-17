"""
models.py — Pydantic Request and Response Models

Purpose: Defines the data shapes for all FastAPI endpoints. Keeping models
in one file makes the API contract easy to read and enforce. The /query
response shape is especially important — it must never change once the
frontend depends on it.

All models use Pydantic v2 syntax.
"""

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# /ingest — POST
# ---------------------------------------------------------------------------

class IngestRequest(BaseModel):
    """Request body for POST /ingest — triggers ingestion for a list of tickers."""
    tickers: list[str] = Field(..., description="List of stock ticker symbols to ingest")
    filing_types: list[str] = Field(
        default=["10-K", "10-Q"],
        description="SEC filing types to download"
    )


class IngestResponse(BaseModel):
    """Response from POST /ingest."""
    status: str
    tickers_processed: list[str]
    total_chunks: int


# ---------------------------------------------------------------------------
# /query — POST
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    """Request body for POST /query — ask Kite a natural language question."""
    question: str = Field(..., description="Natural language question about the portfolio")
    tickers: Optional[list[str]] = Field(
        default=None,
        description="Restrict search to these tickers. None means search all."
    )


class SourceItem(BaseModel):
    """
    A single source citation returned with a /query response.
    Every claim in the answer text must be traceable to one of these sources.
    """
    label: str                          # e.g. "10-K FY2024"
    ticker: str                         # e.g. "AAPL"
    doc_type: str                       # e.g. "10-K", "earnings", "news"
    source_url: str                     # direct link to the original document
    page_number: Optional[int] = None   # page in the SEC filing, if known
    timestamp: Optional[str] = None     # for earnings calls: "14:32" into the call
    published_at: Optional[str] = None  # for news articles: ISO date "2025-04-12"
    excerpt: str                        # first 120 chars of the source chunk


class QueryResponse(BaseModel):
    """
    Response from POST /query.

    IMPORTANT: Do not change this contract. The frontend depends on this exact shape.
    """
    answer: str         # Answer text with inline [source_label, chunk_index] citations
    sources: list[SourceItem]
    sourced: bool       # True if at least one source was found and cited


# ---------------------------------------------------------------------------
# /briefing/{date} — GET
# ---------------------------------------------------------------------------

class BriefingItem(BaseModel):
    """One item in the daily briefing (a single insight with its source)."""
    text: str
    source_label: str
    source_url: str
    ticker: str


class BriefingResponse(BaseModel):
    """Response from GET /briefing/{date}."""
    date: str
    items: list[BriefingItem]


# ---------------------------------------------------------------------------
# /portfolio/{ticker} — GET
# ---------------------------------------------------------------------------

class PortfolioResponse(BaseModel):
    """Price and metric data for a single ticker — used by StockRow and StockChart."""
    ticker: str
    name: str
    price: float
    change_pct: float                       # percentage change today
    sparkline_data: list[float]             # last 30 closes for the sparkline
    chart_data: dict[str, list[float]]      # keyed by period: "1D", "1W", "1M", "3M", "1Y", etc.
    pe_ratio: Optional[float] = None
    market_cap: Optional[float] = None      # market capitalisation in USD
    revenue_change: Optional[float] = None  # YoY revenue change %
    risk_flags: int = 0                     # count of active risk flags
    last_filing: Optional[str] = None       # e.g. "10-K FY2024"
    yahoo_url: str = ""                     # https://finance.yahoo.com/quote/{ticker}
    # Intraday stats for the stats bar
    open_price: Optional[float] = None      # today's open
    day_high: Optional[float] = None        # today's high
    day_low: Optional[float] = None         # today's low
    volume: Optional[float] = None          # today's volume
    week_52_high: Optional[float] = None    # 52-week high
    week_52_low: Optional[float] = None     # 52-week low
    eps: Optional[float] = None             # earnings per share
    beta: Optional[float] = None            # beta vs S&P 500


# ---------------------------------------------------------------------------
# /news — GET
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# /financials/{ticker} — GET
# ---------------------------------------------------------------------------

class FinancialPeriod(BaseModel):
    """One period (quarter or fiscal year) of income statement, cash flow, and balance sheet data."""
    date: str
    # Income statement
    revenue: Optional[float] = None
    gross_profit: Optional[float] = None
    operating_income: Optional[float] = None
    net_income: Optional[float] = None
    # Cash flow statement
    operating_cash_flow: Optional[float] = None
    capital_expenditure: Optional[float] = None
    free_cash_flow: Optional[float] = None
    # Balance sheet
    cash_and_equivalents: Optional[float] = None
    total_debt: Optional[float] = None


class FinancialsResponse(BaseModel):
    """Response from GET /financials/{ticker}."""
    ticker: str
    quarterly: list[FinancialPeriod]
    annual: list[FinancialPeriod]


# ---------------------------------------------------------------------------
# /news — GET
# ---------------------------------------------------------------------------

class NewsItem(BaseModel):
    """One news article with its Kite-generated AI summary."""
    title: str
    source: str             # publication name e.g. "Reuters"
    published_at: str       # ISO date string
    tickers: list[str]      # tickers mentioned
    summary: str = ""       # Kite AI summary (generated by reasoner.py — empty until implemented)
    url: str                # direct link to the full article
    image_url: str = ""     # thumbnail image from NewsAPI


class NewsResponse(BaseModel):
    """Response from GET /news."""
    items: list[NewsItem]
    filter: str             # which filter was applied: "portfolio", "trending", "top", "recent"
