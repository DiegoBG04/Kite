/**
 * NewsCard.jsx — Robinhood-style News Card
 *
 * Layout:
 *   Left: source + time · title/summary · ticker tags with % change
 *   Right: thumbnail image
 */

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function NewsCard({ title, source, publishedAt, tickers = [], summary, url, imageUrl, portfolioData = {} }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        gap: "12px",
        padding: "14px 0",
        borderBottom: "1px solid var(--kite-border)",
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      {/* Left: text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Source + time */}
        <div style={{ fontSize: "11px", color: "var(--kite-muted)", marginBottom: "4px" }}>
          {source}{publishedAt ? ` · ${timeAgo(publishedAt)}` : ""}
        </div>

        {/* Title */}
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: "14px",
          color: "var(--kite-heading)",
          lineHeight: "1.4",
          marginBottom: summary ? "6px" : "8px",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {title}
        </div>

        {/* Summary if available */}
        {summary && (
          <div style={{
            fontSize: "12px",
            color: "var(--kite-body)",
            lineHeight: "1.5",
            marginBottom: "8px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {summary}
          </div>
        )}

        {/* Ticker tags with % change */}
        {tickers.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {tickers.map((t) => {
              const stock = portfolioData[t];
              const change = stock?.change_pct;
              const isPositive = change >= 0;
              return (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    padding: "2px 7px",
                    background: "var(--kite-cream)",
                    border: "1px solid var(--kite-border)",
                    borderRadius: "100px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "var(--kite-amber-dark)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {t}
                  {change != null && (
                    <span style={{ color: isPositive ? "var(--kite-positive)" : "var(--kite-negative)", fontFamily: "var(--font-body)" }}>
                      {isPositive ? "▲" : "▼"}{Math.abs(change).toFixed(2)}%
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: thumbnail */}
      {imageUrl && (
        <div style={{
          width: 80,
          height: 80,
          flexShrink: 0,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          background: "var(--kite-border)",
        }}>
          <img
            src={imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      )}
    </a>
  );
}
