"""
main.py — FastAPI Application Entry Point

Purpose: Defines all API routes for the Kite backend and wires together
the ingestion, retrieval, and output modules into HTTP endpoints.

Routes:
    GET  /health              — health check for Railway uptime monitoring
    POST /ingest              — download + embed SEC filings for given tickers
    POST /query               — RAG query, returns cited answer from Claude
    GET  /portfolio/{ticker}  — live price, change %, sparkline, metrics
    GET  /briefing/{date}     — daily portfolio briefing (stub for now)
    GET  /news                — news feed with ticker and filter params (stub)

Start locally with:
    uvicorn backend.main:app --reload --port 8000

The frontend Vite dev server runs on port 5173 and calls this on port 8000.
"""

import logging

from dotenv import load_dotenv
load_dotenv()  # Load .env before anything else reads environment variables

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.models import (
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
    PortfolioResponse,
    BriefingResponse,
    FinancialsResponse,
    NewsResponse,
)

from contextlib import asynccontextmanager
from backend.scheduler import scheduler, setup_jobs

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    setup_jobs()
    scheduler.start()
    logger.info("[STARTUP] Scheduler started")
    yield
    scheduler.shutdown(wait=False)
    logger.info("[SHUTDOWN] Scheduler stopped")


app = FastAPI(
    title="Kite API",
    description="AI-powered portfolio intelligence backend",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow the Vite dev server and Vercel preview URLs to call this API.
# Update the production Railway URL here before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict:
    """
    Health check endpoint.
    Railway pings this to verify the server is running.
    Returns a simple JSON object — no database calls.
    """
    return {"status": "ok", "service": "kite-backend"}


# ---------------------------------------------------------------------------
# POST /ingest
# ---------------------------------------------------------------------------

@app.post("/ingest", response_model=IngestResponse)
async def ingest(request: IngestRequest) -> IngestResponse:
    """
    Download, chunk, embed, and store SEC filings for a list of tickers.

    This runs the full ingestion pipeline:
        edgar.download_and_extract → chunker.chunk_documents
        → embedder.embed_chunks → store.upsert_chunks

    This can take several minutes for large filings. In production this
    would be moved to a background task (APScheduler), but for MVP it
    runs synchronously so you can see progress in the logs.

    Request body:
        { "tickers": ["AAPL", "MSFT"], "filing_types": ["10-K", "10-Q"] }
    """
    from backend.ingestion.edgar import download_and_extract
    from backend.pipeline.chunker import chunk_documents
    from backend.pipeline.embedder import embed_chunks
    from backend.pipeline.store import upsert_chunks

    tickers_processed = []
    total_chunks = 0

    from backend.ingestion.xbrl import fetch_financial_facts
    from backend.pipeline.financial_store import upsert_financials

    for ticker in request.tickers:
        try:
            logger.info(f"[INGEST] Starting pipeline for {ticker}")

            # Stage 1: Download and extract text from EDGAR
            docs = download_and_extract(
                ticker=ticker,
                filing_types=request.filing_types,
                limit_per_type=2,
            )
            if not docs:
                logger.warning(f"[INGEST] No documents found for {ticker} — skipping")
                continue

            # Stage 2: Chunk into ~500-token pieces
            chunks = chunk_documents(docs)

            # Stage 3: Generate embeddings
            chunks = embed_chunks(chunks)

            # Stage 4: Upsert into pgvector
            n = upsert_chunks(chunks)
            total_chunks += n
            tickers_processed.append(ticker)

            logger.info(f"[INGEST] ✓ {ticker} filings complete — {n} chunks stored")

        except Exception as exc:
            logger.error(f"[INGEST] Failed for {ticker}: {exc}")

    # Stage 5: Ingest financial facts from EDGAR XBRL for all processed tickers
    for ticker in tickers_processed:
        try:
            logger.info(f"[INGEST] Fetching XBRL financials for {ticker}")
            facts = fetch_financial_facts(ticker)
            all_periods = facts["annual"] + facts["quarterly"]
            upsert_financials(ticker, all_periods)
            logger.info(f"[INGEST] ✓ {ticker} financials stored")
        except Exception as exc:
            logger.warning(f"[INGEST] XBRL failed for {ticker} (non-fatal): {exc}")

    return IngestResponse(
        status="ok" if tickers_processed else "error",
        tickers_processed=tickers_processed,
        total_chunks=total_chunks,
    )


# ---------------------------------------------------------------------------
# POST /query
# ---------------------------------------------------------------------------

@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest) -> QueryResponse:
    """
    Answer a natural language question about a portfolio using RAG.

    Retrieves the most semantically relevant chunks from pgvector,
    sends them to Claude with the system prompt, and returns a cited answer.

    Request body:
        {
          "question": "What are Apple's main risk factors?",
          "tickers": ["AAPL"]   // optional — restricts search to these tickers
        }

    Response:
        {
          "answer": "Apple faces risk from... [10-K FY2024, 42]",
          "sources": [...],
          "sourced": true
        }
    """
    from backend.agent.retriever import retrieve
    from backend.agent.reasoner import reason

    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Retrieve relevant chunks, filtered to the user's portfolio tickers if provided
    chunks = retrieve(
        question=request.question,
        ticker_filter=request.tickers,
    )

    # Generate cited answer with Claude
    response = reason(question=request.question, chunks=chunks)
    return response


# ---------------------------------------------------------------------------
# GET /portfolio/{ticker}
# ---------------------------------------------------------------------------

# Realistic mock data for local development — used when yfinance is rate-limited.
# Replace with real data once deployed to Railway (different IP, no rate-limiting).
_MOCK_PORTFOLIO = {
    "AAPL": {"name": "Apple Inc.",       "price": 198.15, "change_pct": -1.23, "pe_ratio": 31.2, "revenue_change":  4.1, "market_cap": 3.05e12, "eps": 6.42,  "beta": 1.24, "open_price": 200.10, "day_high": 201.50, "day_low": 197.20, "volume": 52_300_000, "week_52_high": 237.49, "week_52_low": 164.08},
    "MSFT": {"name": "Microsoft Corp.",  "price": 415.32, "change_pct":  0.87, "pe_ratio": 36.5, "revenue_change": 17.6, "market_cap": 3.08e12, "eps": 11.45, "beta": 0.90, "open_price": 411.80, "day_high": 416.90, "day_low": 410.30, "volume": 18_700_000, "week_52_high": 468.35, "week_52_low": 344.79},
    "NVDA": {"name": "NVIDIA Corp.",     "price": 875.40, "change_pct":  2.14, "pe_ratio": 68.1, "revenue_change": 122.4,"market_cap": 2.15e12, "eps": 12.96, "beta": 1.68, "open_price": 857.00, "day_high": 882.30, "day_low": 854.10, "volume": 41_200_000, "week_52_high": 974.00, "week_52_low": 462.37},
    "TSLA": {"name": "Tesla Inc.",       "price": 162.50, "change_pct": -3.45, "pe_ratio": 45.2, "revenue_change":  8.2, "market_cap": 5.18e11, "eps":  3.60, "beta": 2.31, "open_price": 168.40, "day_high": 169.10, "day_low": 161.80, "volume": 97_800_000, "week_52_high": 299.29, "week_52_low": 138.80},
    "GOOGL": {"name": "Alphabet Inc.",   "price": 165.20, "change_pct":  1.05, "pe_ratio": 22.8, "revenue_change": 15.1, "market_cap": 2.03e12, "eps":  7.25, "beta": 1.06, "open_price": 163.50, "day_high": 166.40, "day_low": 163.00, "volume": 23_400_000, "week_52_high": 207.05, "week_52_low": 140.53},
    "AMZN": {"name": "Amazon.com Inc.",  "price": 185.75, "change_pct":  0.62, "pe_ratio": 42.1, "revenue_change": 11.0, "market_cap": 1.94e12, "eps":  4.41, "beta": 1.15, "open_price": 184.20, "day_high": 186.90, "day_low": 183.70, "volume": 34_100_000, "week_52_high": 242.52, "week_52_low": 151.61},
}

def _mock_prices(base_price: float, change_pct: float, points: int, volatility: float = 0.008) -> list[float]:
    """Generate a plausible price series ending at base_price with the given trend."""
    import random
    random.seed(int(base_price * 100))
    trend = change_pct / points
    # Start further back so the series ends near base_price
    price = base_price / (1 + change_pct / 100)
    prices = []
    for _ in range(points):
        price *= (1 + trend / 100 + random.uniform(-volatility, volatility))
        prices.append(round(price, 2))
    return prices

@app.get("/portfolio/{ticker}", response_model=PortfolioResponse)
async def portfolio(ticker: str) -> PortfolioResponse:
    """
    Return price, percentage change, sparkline, chart data, and financial
    metrics for a single ticker.

    Currently returns mock data for local development — yfinance is rate-limited
    when hitting Yahoo Finance from a local IP. Real data will be used once
    deployed to Railway.
    """
    ticker = ticker.upper()

    # Try real yfinance data first, fall back to mock if blocked
    try:
        from backend.ingestion.market import get_portfolio_data
        data = get_portfolio_data(ticker)
        return PortfolioResponse(**data)
    except Exception as exc:
        logger.warning(f"[PORTFOLIO] yfinance failed for {ticker} ({exc}) — using mock data")

    # Fall back to mock data
    mock = _MOCK_PORTFOLIO.get(ticker)
    if not mock:
        # Unknown ticker — generate plausible placeholder
        mock = {"name": ticker, "price": 100.00, "change_pct": 0.0, "pe_ratio": None, "revenue_change": None}

    sparkline = _mock_prices(mock["price"], mock["change_pct"], 30)
    chart_data = {
        "1D":  _mock_prices(mock["price"], mock["change_pct"] / 5,  78,  volatility=0.002),
        "1W":  _mock_prices(mock["price"], mock["change_pct"],       35,  volatility=0.005),
        "1M":  _mock_prices(mock["price"], mock["change_pct"],       30,  volatility=0.008),
        "3M":  _mock_prices(mock["price"], mock["change_pct"] * 2,  90,  volatility=0.010),
        "6M":  _mock_prices(mock["price"], mock["change_pct"] * 4,  180, volatility=0.012),
        "YTD": _mock_prices(mock["price"], mock["change_pct"] * 3,  105, volatility=0.010),
        "1Y":  _mock_prices(mock["price"], mock["change_pct"] * 8,  52,  volatility=0.015),
        "2Y":  _mock_prices(mock["price"], mock["change_pct"] * 14, 104, volatility=0.018),
        "5Y":  _mock_prices(mock["price"], mock["change_pct"] * 30, 60,  volatility=0.022),
        "10Y": _mock_prices(mock["price"], mock["change_pct"] * 55, 120, volatility=0.025),
        "MAX": _mock_prices(mock["price"], mock["change_pct"] * 60, 240, volatility=0.025),
    }

    return PortfolioResponse(
        ticker=ticker,
        name=mock["name"],
        price=mock["price"],
        change_pct=mock["change_pct"],
        sparkline_data=sparkline,
        chart_data=chart_data,
        pe_ratio=mock.get("pe_ratio"),
        market_cap=mock.get("market_cap"),
        revenue_change=mock.get("revenue_change"),
        risk_flags=0,
        last_filing=None,
        yahoo_url=f"https://finance.yahoo.com/quote/{ticker}",
        open_price=mock.get("open_price"),
        day_high=mock.get("day_high"),
        day_low=mock.get("day_low"),
        volume=mock.get("volume"),
        week_52_high=mock.get("week_52_high"),
        week_52_low=mock.get("week_52_low"),
        eps=mock.get("eps"),
        beta=mock.get("beta"),
    )


# ---------------------------------------------------------------------------
# GET /financials/{ticker}
# ---------------------------------------------------------------------------

@app.get("/financials/{ticker}", response_model=FinancialsResponse)
async def financials_route(ticker: str) -> FinancialsResponse:
    """
    Return quarterly and annual income statement data for a ticker.
    Pulls revenue, gross profit, EBITDA, and net income from Twelve Data.
    Returns empty lists if the API fails (e.g. free-tier restriction).
    """
    from backend.ingestion.market import get_financials
    ticker = ticker.upper()
    try:
        data = get_financials(ticker)
        return FinancialsResponse(**data)
    except Exception as exc:
        logger.warning(f"[FINANCIALS] Failed for {ticker}: {exc}")
        return FinancialsResponse(ticker=ticker, quarterly=[], annual=[])


# ---------------------------------------------------------------------------
# POST /ingest-financials
# ---------------------------------------------------------------------------

@app.post("/ingest-financials")
async def ingest_financials(request: IngestRequest) -> dict:
    """
    Fast financial-only ingestion — fetches XBRL data from EDGAR and stores
    it in the financials table. No embeddings, no ML, no SEC filing downloads.

    Use this to populate the Financials and Trends tabs quickly.
    Full /ingest is only needed for the AI chat (RAG) feature.

    Typical time: ~5-10 seconds per ticker.
    """
    from backend.ingestion.xbrl import fetch_financial_facts
    from backend.pipeline.financial_store import upsert_financials

    results = {"ok": [], "failed": []}

    for ticker in request.tickers:
        ticker = ticker.upper().strip()
        try:
            logger.info(f"[FIN_INGEST] Fetching XBRL for {ticker}")
            facts = fetch_financial_facts(ticker)
            all_periods = facts["annual"] + facts["quarterly"]
            upsert_financials(ticker, all_periods)
            results["ok"].append(ticker)
            logger.info(f"[FIN_INGEST] ✓ {ticker} — {len(all_periods)} periods stored")
        except Exception as exc:
            logger.error(f"[FIN_INGEST] ✗ {ticker}: {exc}")
            results["failed"].append(ticker)

    return {
        "status": "ok" if results["ok"] else "error",
        "ingested": results["ok"],
        "failed":   results["failed"],
        "total":    len(results["ok"]),
    }


# ---------------------------------------------------------------------------
# GET /search
# ---------------------------------------------------------------------------

@app.get("/search")
async def search_symbols(q: str = Query(..., min_length=1, description="Ticker or company name query")) -> list[dict]:
    """
    Search for ticker symbols by name or ticker prefix.
    Proxies Twelve Data's symbol_search endpoint so the API key stays server-side.
    Returns up to 8 results: { symbol, name, exchange, type, country }
    """
    import os, requests as _req
    api_key = os.getenv("TWELVE_DATA_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Search unavailable — API key not configured")

    try:
        resp = _req.get(
            "https://api.twelvedata.com/symbol_search",
            params={"symbol": q.upper(), "outputsize": 8, "apikey": api_key},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        return [
            {
                "symbol":   item.get("symbol", ""),
                "name":     item.get("instrument_name", ""),
                "exchange": item.get("exchange", ""),
                "type":     item.get("instrument_type", ""),
                "country":  item.get("country", ""),
            }
            for item in data
        ]
    except Exception as exc:
        logger.warning(f"[SEARCH] Symbol search failed for '{q}': {exc}")
        return []


# ---------------------------------------------------------------------------
# GET /briefing/{date}
# ---------------------------------------------------------------------------

@app.get("/briefing/{date}", response_model=BriefingResponse)
async def briefing(date: str) -> BriefingResponse:
    """
    Return the daily portfolio briefing for a given date.

    Path parameter:
        date — ISO date string e.g. "2025-04-14"

    TODO: Implement briefing generation in outputs/briefing.py (Step 5+).
    Currently returns an empty briefing so the frontend can be built and tested.
    """
    logger.info(f"[BRIEFING] Request for date={date} (stub response)")
    return BriefingResponse(date=date, items=[])


# ---------------------------------------------------------------------------
# GET /news
# ---------------------------------------------------------------------------

@app.get("/news", response_model=NewsResponse)
async def news(
    tickers: str = Query(default="", description="Comma-separated ticker symbols e.g. AAPL,MSFT"),
    filter: str = Query(default="portfolio", description="One of: portfolio, trending, top, recent"),
) -> NewsResponse:
    """
    Return a filtered news feed.

    Query parameters:
        tickers — comma-separated list e.g. ?tickers=AAPL,MSFT
        filter  — one of: portfolio, trending, top, recent

    TODO: Implement news fetching in ingestion/news.py (Step 5+).
    Currently returns an empty feed so the frontend can be built and tested.
    """
    from backend.ingestion.news import fetch_news

    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    logger.info(f"[NEWS] Request for tickers={ticker_list} filter={filter}")

    try:
        items = fetch_news(tickers=ticker_list, filter_type=filter)
    except Exception as exc:
        logger.error(f"[NEWS] Failed to fetch news: {exc}")
        items = []

    return NewsResponse(items=items, filter=filter)
