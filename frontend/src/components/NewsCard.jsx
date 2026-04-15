/**
 * NewsCard.jsx — News Feed Card
 */

export default function NewsCard({ title, source, publishedAt, tickers = [], summary, url }) {
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  return (
    <div style={{
      background: "var(--kite-surface)",
      border: "1px solid var(--kite-border)",
      borderRadius: "var(--radius-md)",
      padding: "16px",
      boxShadow: "var(--shadow-card)",
    }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          color: "var(--kite-heading)",
          textDecoration: "none",
          lineHeight: "1.4",
          display: "block",
          marginBottom: "8px",
        }}
      >
        {title}
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: summary ? "10px" : "0" }}>
        <span style={{ fontSize: "12px", color: "var(--kite-body)" }}>{source}</span>
        {dateStr && (
          <>
            <span style={{ color: "var(--kite-border)" }}>·</span>
            <span style={{ fontSize: "12px", color: "var(--kite-muted)" }}>{dateStr}</span>
          </>
        )}
        {tickers.map((t) => (
          <span key={t} style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--kite-amber-dark)",
            background: "var(--kite-amber-wash)",
            padding: "1px 6px",
            borderRadius: "100px",
            letterSpacing: "0.04em",
          }}>
            {t}
          </span>
        ))}
      </div>

      {summary && (
        <p style={{ fontSize: "13px", color: "var(--kite-body)", lineHeight: "1.65" }}>
          {summary}
        </p>
      )}
    </div>
  );
}
