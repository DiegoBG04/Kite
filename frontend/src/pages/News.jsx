/**
 * News.jsx — News Feed Page
 */

import { useState, useEffect } from "react";
import { getNews, getPortfolio } from "../api/client";
import NewsCard from "../components/NewsCard";

const FILTER_OPTIONS = ["portfolio", "trending", "top", "recent"];
const DEFAULT_TICKERS = ["AAPL", "MSFT", "NVDA"];

export default function News() {
  const [filter, setFilter] = useState("portfolio");
  const [tickerFilter, setTickerFilter] = useState(null);
  const [articles, setArticles] = useState([]);
  const [portfolioData, setPortfolioData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch portfolio data once for ticker % change badges
  useEffect(() => {
    getPortfolio(DEFAULT_TICKERS).then((results) => {
      const map = {};
      results.forEach((stock) => { map[stock.ticker] = stock; });
      setPortfolioData(map);
    }).catch(() => {/* silently skip if unavailable */});
  }, []);

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

  const filterBtn = (label, isActive, onClick) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        fontSize: "12px",
        fontWeight: isActive ? "700" : "400",
        color: isActive ? "var(--kite-amber-dark)" : "var(--kite-muted)",
        background: isActive ? "var(--kite-amber-wash)" : "transparent",
        border: isActive ? "1px solid var(--kite-amber-dark)" : "1px solid transparent",
        borderRadius: "100px",
        padding: "4px 12px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </button>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "24px", background: "var(--kite-cream)" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>

        {/* Page title */}
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "24px",
          color: "var(--kite-heading)",
          marginBottom: "20px",
          fontWeight: "normal",
        }}>
          News
        </h1>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map((f) => filterBtn(f, filter === f, () => setFilter(f)))}
        </div>

        {/* Ticker filter */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
          {filterBtn("All", tickerFilter === null, () => setTickerFilter(null))}
          {DEFAULT_TICKERS.map((t) => filterBtn(t, tickerFilter === t, () => setTickerFilter(t)))}
        </div>

        {/* Content */}
        {loading && (
          <div style={{ color: "var(--kite-muted)", fontSize: "13px" }}>Loading news…</div>
        )}
        {error && (
          <div style={{ color: "var(--kite-negative)", fontSize: "13px" }}>Error: {error}</div>
        )}
        {!loading && !error && articles.length === 0 && (
          <div style={{ color: "var(--kite-muted)", fontSize: "13px" }}>No articles found.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {articles.map((article, i) => (
            <NewsCard
              key={i}
              title={article.title}
              source={article.source}
              publishedAt={article.published_at}
              tickers={article.tickers}
              summary={article.summary}
              url={article.url}
              imageUrl={article.image_url}
              portfolioData={portfolioData}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
