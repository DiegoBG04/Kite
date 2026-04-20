/**
 * client.js — API Client
 *
 * Purpose: All fetch calls from the React frontend to the FastAPI backend
 * live here. Components never call fetch() directly — they import these
 * functions and get structured data back.
 *
 * The base URL reads from the VITE_API_URL environment variable:
 *   Dev:  http://localhost:8000  (set in .env.local)
 *   Prod: your Railway deployment URL
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Internal helper — fetch with JSON, throw on non-2xx responses.
 * All public functions use this so error handling is consistent.
 */
async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Fetch price, change %, sparkline, chart data, and metrics for a list of
 * tickers. Calls GET /portfolio/{ticker} for each ticker in parallel.
 *
 * @param {string[]} tickers - e.g. ["AAPL", "MSFT"]
 * @returns {Promise<Object[]>} Array of PortfolioResponse objects
 */
/**
 * Fetch lightweight quote data (price, change %, stats — no chart series) for
 * a list of tickers. Calls GET /quote/{ticker} — only 1 API call per ticker,
 * so the dashboard loads immediately without hitting rate limits.
 *
 * @param {string[]} tickers - e.g. ["AAPL", "MSFT"]
 * @returns {Promise<Object[]>} Array of PortfolioResponse objects (chart_data is empty)
 */
export async function getQuotes(tickers) {
  const results = [];
  for (const ticker of tickers) {
    try {
      const data = await apiFetch(`/quote/${ticker}`);
      results.push(data);
    } catch (err) {
      console.error(`Failed to fetch quote for ${ticker}:`, err);
    }
  }
  return results;
}

/**
 * Fetch full portfolio data (price + all chart time series) for a single ticker.
 * Called only when the user opens the CompanyDrawer for that stock.
 * Uses GET /portfolio/{ticker} — ~6 API calls, cached 15 min server-side.
 *
 * @param {string} ticker - e.g. "AAPL"
 * @returns {Promise<Object>} PortfolioResponse with chart_data populated
 */
export async function getPortfolioFull(ticker) {
  return apiFetch(`/portfolio/${ticker}`);
}

/** @deprecated Use getQuotes for dashboard loading, getPortfolioFull for drawer. */
export async function getPortfolio(tickers) {
  const results = [];
  for (const ticker of tickers) {
    try {
      const data = await apiFetch(`/portfolio/${ticker}`);
      results.push(data);
    } catch (err) {
      console.error(`Failed to fetch portfolio data for ${ticker}: ${err}`);
    }
  }
  return results;
}

/**
 * Fetch the daily portfolio briefing.
 * Calls GET /briefing/{date}
 *
 * @param {string} date - ISO date string e.g. "2025-04-14"
 * @returns {Promise<Object>} BriefingResponse: { date, items }
 */
export async function getBriefing(date) {
  return apiFetch(`/briefing/${date}`);
}

/**
 * Send a natural language question to Kite and get a cited answer.
 * Calls POST /query
 *
 * @param {string} question - The user's question
 * @param {string[]} tickers - Portfolio tickers to restrict the search to
 * @returns {Promise<Object>} QueryResponse: { answer, sources, sourced }
 */
export async function queryKite(question, tickers) {
  return apiFetch("/query", {
    method: "POST",
    body: JSON.stringify({ question, tickers }),
  });
}

/**
 * Fetch the news feed with optional filters.
 * Calls GET /news?tickers=...&filter=...
 *
 * @param {Object} filters - { tickers: string[], filter: string }
 * @returns {Promise<Object>} NewsResponse: { items, filter }
 */
export async function getNews({ tickers = [], filter = "portfolio" } = {}) {
  const params = new URLSearchParams({
    tickers: tickers.join(","),
    filter,
  });
  return apiFetch(`/news?${params}`);
}

/**
 * Fetch quarterly and annual income statement data for a ticker.
 * Calls GET /financials/{ticker}
 *
 * @param {string} ticker - e.g. "AAPL"
 * @returns {Promise<Object>} FinancialsResponse: { ticker, quarterly, annual }
 */
export async function getFinancials(ticker) {
  return apiFetch(`/financials/${ticker}`);
}

/**
 * Search for ticker symbols by name or ticker prefix.
 * Calls GET /search?q=...
 *
 * @param {string} query - e.g. "AAPL" or "apple"
 * @returns {Promise<Object[]>} Array of { symbol, name, exchange, type, country }
 */
export async function searchSymbols(query) {
  if (!query || !query.trim()) return [];
  const params = new URLSearchParams({ q: query.trim() });
  return apiFetch(`/search?${params}`);
}

/**
 * Trigger ingestion for a list of tickers.
 * Calls POST /ingest
 *
 * @param {string[]} tickers - Tickers to ingest SEC filings for
 * @returns {Promise<Object>} IngestResponse: { status, tickers_processed, total_chunks }
 */
export async function triggerIngest(tickers) {
  return apiFetch("/ingest", {
    method: "POST",
    body: JSON.stringify({ tickers }),
  });
}
