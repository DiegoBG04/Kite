import { useState, useEffect, useMemo } from "react";
import { getNews, getQuotes } from "../api/client";
import { useHoldings } from "../hooks/useHoldings";
import { useWatchlist } from "../hooks/useWatchlist";
import NewsCard from "../components/NewsCard";

const SENTIMENT_KEYWORDS = {
  positive: ["surge", "beat", "record", "gain", "rally", "growth", "profit", "rise", "strong", "upgrade", "soar", "jump", "high", "bullish", "outperform", "expand", "accelerate"],
  negative: ["fall", "drop", "miss", "loss", "decline", "cut", "risk", "warn", "concern", "bear", "crash", "plunge", "downgrade", "layoff", "disappoint", "weak", "slow", "deficit"],
};

function scoreSentiment(article) {
  const text = `${article.title} ${article.summary || ""}`.toLowerCase();
  const pos = SENTIMENT_KEYWORDS.positive.filter((w) => text.includes(w)).length;
  const neg = SENTIMENT_KEYWORDS.negative.filter((w) => text.includes(w)).length;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: "12px",
        fontWeight: active ? "700" : "400",
        color: active ? "var(--kite-amber-dark)" : "var(--kite-muted)",
        background: active ? "var(--kite-amber-wash)" : "transparent",
        border: active ? "1px solid var(--kite-amber-dark)" : "1px solid var(--kite-border)",
        borderRadius: "100px",
        padding: "5px 14px",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--kite-muted)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--kite-border)"; }}
    >
      {children}
    </button>
  );
}

export default function News() {
  const { holdings }  = useHoldings();
  const { watchlist } = useWatchlist();

  const holdingTickers  = holdings.map((h) => h.ticker);
  const watchlistTickers = watchlist.map((w) => w.ticker).filter((t) => !holdingTickers.includes(t));

  const [source,    setSource]    = useState("portfolio"); // portfolio | watchlist | all
  const [sortBy,    setSortBy]    = useState("relevance"); // relevance | trending | recent
  const [sentiment, setSentiment] = useState("all");       // all | positive | neutral | negative
  const [articles,  setArticles]  = useState([]);
  const [portfolioData, setPortfolioData] = useState({});
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  // Tickers to fetch news for, based on source toggle
  const activeTickers = useMemo(() => {
    if (source === "portfolio")  return holdingTickers.length  ? holdingTickers  : ["AAPL", "MSFT", "NVDA"];
    if (source === "watchlist")  return watchlistTickers.length ? watchlistTickers : holdingTickers;
    return [...new Set([...holdingTickers, ...watchlistTickers])].length
      ? [...new Set([...holdingTickers, ...watchlistTickers])]
      : ["AAPL", "MSFT", "NVDA"];
  }, [source, holdingTickers.join(","), watchlistTickers.join(",")]);

  // Fetch price data for ticker tags
  useEffect(() => {
    const tickers = [...new Set([...holdingTickers, ...watchlistTickers])];
    if (!tickers.length) return;
    getQuotes(tickers).then((results) => {
      const map = {};
      results.forEach((s) => { map[s.ticker] = s; });
      setPortfolioData(map);
    }).catch(() => {});
  }, [holdingTickers.join(","), watchlistTickers.join(",")]);

  // Map sortBy to API filter param
  const apiFilter = sortBy === "trending" ? "trending" : sortBy === "recent" ? "recent" : "portfolio";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getNews({ tickers: activeTickers, filter: apiFilter });
        setArticles(result.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeTickers.join(","), apiFilter]);

  // Client-side: score sentiment + sort by recent
  const displayed = useMemo(() => {
    let items = articles.map((a) => ({ ...a, sentiment: scoreSentiment(a) }));

    if (sentiment !== "all") {
      items = items.filter((a) => a.sentiment === sentiment);
    }

    if (sortBy === "recent") {
      items = [...items].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    }

    return items;
  }, [articles, sentiment, sortBy]);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--kite-cream)" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "28px 24px 60px" }}>

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: "600", color: "var(--kite-heading)" }}>
            News
          </h1>
          {!loading && (
            <span style={{ fontSize: "11px", color: "var(--kite-muted)" }}>
              {displayed.length} article{displayed.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "24px", flexWrap: "wrap" }}>

          {/* Source toggle */}
          <div style={{ display: "flex", background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "100px", overflow: "hidden" }}>
            {[["portfolio", "Portfolio"], ["watchlist", "Watchlist"], ["all", "All"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSource(val)}
                style={{
                  fontSize: "12px",
                  fontWeight: source === val ? "700" : "400",
                  color: source === val ? "var(--kite-amber-dark)" : "var(--kite-muted)",
                  background: source === val ? "var(--kite-amber-wash)" : "transparent",
                  border: "none",
                  padding: "6px 14px",
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sentiment filter */}
          <div style={{ display: "flex", gap: "6px" }}>
            {[["all", "All"], ["positive", "▲ Positive"], ["neutral", "Neutral"], ["negative", "▼ Negative"]].map(([val, label]) => (
              <Pill key={val} active={sentiment === val} onClick={() => setSentiment(val)}>
                {label}
              </Pill>
            ))}
          </div>

          {/* Sort by */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--kite-muted)", whiteSpace: "nowrap" }}>Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                fontSize: "12px",
                color: "var(--kite-heading)",
                background: "var(--kite-surface)",
                border: "1px solid var(--kite-border)",
                borderRadius: "var(--radius-sm)",
                padding: "5px 10px",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              <option value="relevance">Relevance</option>
              <option value="trending">Trending</option>
              <option value="recent">Recent</option>
            </select>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div style={{ color: "var(--kite-muted)", fontSize: "13px", padding: "40px 0", textAlign: "center" }}>
            Loading news…
          </div>
        )}
        {error && (
          <div style={{ color: "var(--kite-negative)", fontSize: "13px" }}>Error: {error}</div>
        )}
        {!loading && !error && displayed.length === 0 && (
          <div style={{ color: "var(--kite-muted)", fontSize: "13px", padding: "40px 0", textAlign: "center" }}>
            No articles found.
          </div>
        )}

        {/* 3-column grid */}
        {!loading && displayed.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
          }}>
            {displayed.map((article, i) => (
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
                sentiment={article.sentiment}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
