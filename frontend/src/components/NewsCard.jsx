function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

import { useState } from "react";

export default function NewsCard({ title, source, publishedAt, tickers = [], summary, url, imageUrl, portfolioData = {}, sentiment }) {
  const [imgFailed, setImgFailed] = useState(false);
  const sentimentColor = sentiment === "positive" ? "var(--kite-positive)"
    : sentiment === "negative" ? "var(--kite-negative)"
    : "var(--kite-muted)";
  const sentimentLabel = sentiment === "positive" ? "▲ Positive"
    : sentiment === "negative" ? "▼ Negative"
    : "Neutral";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--kite-surface)",
        border: "1px solid var(--kite-border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        textDecoration: "none",
        cursor: "pointer",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(61,46,15,0.10)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Thumbnail */}
      <div style={{
        width: "100%",
        height: "130px",
        background: "var(--kite-border)",
        flexShrink: 0,
        overflow: "hidden",
      }}>
        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "var(--kite-amber-wash)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "24px", opacity: 0.25 }}>◈</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Source + time + sentiment */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "10px", color: "var(--kite-muted)" }}>
            {source}{publishedAt ? ` · ${timeAgo(publishedAt)}` : ""}
          </span>
          {sentiment && (
            <span style={{ fontSize: "9px", fontWeight: "700", color: sentimentColor, letterSpacing: "0.04em" }}>
              {sentimentLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: "13px",
          fontWeight: "600",
          color: "var(--kite-heading)",
          lineHeight: "1.4",
          marginBottom: "6px",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          flex: 1,
        }}>
          {title}
        </div>

        {/* Summary */}
        {summary && (
          <div style={{
            fontSize: "11px",
            color: "var(--kite-body)",
            lineHeight: "1.5",
            marginBottom: "10px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {summary}
          </div>
        )}

        {/* Ticker tags */}
        {tickers.length > 0 && (
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "auto", paddingTop: "8px" }}>
            {tickers.map((t) => {
              const stock = portfolioData[t];
              const change = stock?.change_pct;
              const isPositive = (change ?? 0) >= 0;
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
    </a>
  );
}
