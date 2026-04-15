/**
 * News.jsx — News Feed Page
 *
 * Purpose: Displays a filterable news feed of articles relevant to the
 * user's portfolio. Filters: My Portfolio | Trending | Top | Recent.
 * Additional per-ticker filter buttons let the user focus on one stock.
 *
 * Calls GET /news?tickers=...&filter=... via client.getNews().
 */

import { useState, useEffect } from "react";
import { getNews } from "../api/client";

const FILTER_OPTIONS = ["portfolio", "trending", "top", "recent"];
const DEFAULT_TICKERS = ["AAPL", "MSFT", "NVDA"];

export default function News() {
  const [filter, setFilter] = useState("portfolio");
  const [tickerFilter, setTickerFilter] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const tickers = tickerFilter ? [tickerFilter] : DEFAULT_TICKERS;
        const result = await getNews({ tickers, filter });
        setArticles(result.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filter, tickerFilter]);

  return (
    <div style={{ padding: "16px" }}>
      {/* Feed type filter buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {FILTER_OPTIONS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} disabled={f === filter}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Per-ticker filter buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button onClick={() => setTickerFilter(null)} disabled={tickerFilter === null}>
          All
        </button>
        {DEFAULT_TICKERS.map((t) => (
          <button key={t} onClick={() => setTickerFilter(t)} disabled={tickerFilter === t}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div>Loading news...</div>}
      {error && <div style={{ color: "red" }}>Error: {error}</div>}

      {!loading && !error && articles.length === 0 && (
        <div style={{ color: "#888" }}>No articles found.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {articles.map((article, i) => (
          <div key={i} style={{ borderBottom: "1px solid #eee", paddingBottom: "12px" }}>
            <a href={article.url} target="_blank" rel="noreferrer" style={{ fontWeight: "bold", textDecoration: "none" }}>
              {article.title}
            </a>
            <div style={{ fontSize: "0.85em", color: "#888", marginTop: "4px" }}>
              {article.source} · {formatDate(article.published_at)}
              {article.tickers.length > 0 && ` · ${article.tickers.join(", ")}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}
