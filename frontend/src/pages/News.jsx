/**
 * News.jsx — News Feed Page
 *
 * Purpose: Displays a filterable news feed of articles relevant to the
 * user's portfolio. Filters: My Portfolio | Trending | Top | Recent.
 * Additional per-ticker filter buttons let the user focus on one stock.
 *
 * Calls GET /news?tickers=...&filter=... via client.getNews().
 *
 * TODO (Step 9): Wire up getNews() from client.js.
 */

import { useState, useEffect } from "react";

const FILTER_OPTIONS = ["portfolio", "trending", "top", "recent"];
const DEFAULT_TICKERS = ["AAPL", "MSFT", "NVDA"]; // same as Dashboard — replace post-auth

export default function News() {
  const [filter, setFilter] = useState("portfolio");
  const [tickerFilter, setTickerFilter] = useState(null); // null means all tickers
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // TODO (Step 9): Replace with real API call
    // async function load() {
    //   setLoading(true);
    //   try {
    //     const tickers = tickerFilter ? [tickerFilter] : DEFAULT_TICKERS;
    //     const result = await getNews({ tickers, filter });
    //     setArticles(result.items);
    //   } catch (err) {
    //     setError(err.message);
    //   } finally {
    //     setLoading(false);
    //   }
    // }
    // load();
  }, [filter, tickerFilter]);

  return (
    <div>
      {/* Feed type filter buttons */}
      <div>
        {FILTER_OPTIONS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} disabled={f === filter}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Per-ticker filter buttons */}
      <div>
        <button onClick={() => setTickerFilter(null)} disabled={tickerFilter === null}>
          All
        </button>
        {DEFAULT_TICKERS.map((t) => (
          <button key={t} onClick={() => setTickerFilter(t)} disabled={tickerFilter === t}>
            {t}
          </button>
        ))}
      </div>

      {/* News feed */}
      {loading && <div>Loading news...</div>}
      {error   && <div>Error: {error}</div>}

      {articles.length === 0 && !loading && (
        <div>No articles found. Wire up the API in Step 9.</div>
      )}

      {/* TODO (Step 8): Replace with NewsCard components */}
      {articles.map((article, i) => (
        <div key={i}>{article.title}</div>
      ))}
    </div>
  );
}
