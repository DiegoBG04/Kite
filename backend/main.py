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
    NewsResponse,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Kite API",
    description="AI-powered portfolio intelligence backend",
    version="0.1.0",
)

# Allow the Vite dev server and Vercel preview URLs to call this API.
# Update the production Railway URL here before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",                    # Vite dev server
        "https://kite-zeta-rose.vercel.app",        # Vercel production
        "https://*.vercel.app",                     # Vercel preview deployments
    ],
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

            logger.info(f"[INGEST] ✓ {ticker} complete — {n} chunks stored")

        except Exception as exc:
            # Log the error but continue processing remaining tickers
            logger.error(f"[INGEST] Failed for {ticker}: {exc}")

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
    "AAPL": {"name": "Apple Inc.", "price": 198.15, "change_pct": -1.23, "pe_ratio": 31.2, "revenue_change": 4.1},
    "MSFT": {"name": "Microsoft Corp.", "price": 415.32, "change_pct": 0.87, "pe_ratio": 36.5, "revenue_change": 17.6},
    "NVDA": {"name": "NVIDIA Corp.", "price": 875.40, "change_pct": 2.14, "pe_ratio": 68.1, "revenue_change": 122.4},
    "TSLA": {"name": "Tesla Inc.", "price": 162.50, "change_pct": -3.45, "pe_ratio": 45.2, "revenue_change": 8.2},
    "GOOGL": {"name": "Alphabet Inc.", "price": 165.20, "change_pct": 1.05, "pe_ratio": 22.8, "revenue_change": 15.1},
    "AMZN": {"name": "Amazon.com Inc.", "price": 185.75, "change_pct": 0.62, "pe_ratio": 42.1, "revenue_change": 11.0},
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
    # Each period gets a different number of data points so switching tabs is visible
    chart_data = {
        "1D": _mock_prices(mock["price"], mock["change_pct"] / 5, 78, volatility=0.002),
        "1W": _mock_prices(mock["price"], mock["change_pct"], 5, volatility=0.005),
        "1M": _mock_prices(mock["price"], mock["change_pct"], 30, volatility=0.008),
        "3M": _mock_prices(mock["price"], mock["change_pct"] * 2, 90, volatility=0.010),
        "1Y": _mock_prices(mock["price"], mock["change_pct"] * 8, 52, volatility=0.015),
    }

    return PortfolioResponse(
        ticker=ticker,
        name=mock["name"],
        price=mock["price"],
        change_pct=mock["change_pct"],
        sparkline_data=sparkline,
        chart_data=chart_data,
        pe_ratio=mock.get("pe_ratio"),
        revenue_change=mock.get("revenue_change"),
        risk_flags=0,
        last_filing=None,
        yahoo_url=f"https://finance.yahoo.com/quote/{ticker}",
    )


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
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    logger.info(f"[NEWS] Request for tickers={ticker_list} filter={filter} (stub response)")
    return NewsResponse(items=[], filter=filter)
