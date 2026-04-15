/**
 * SourcePill.jsx — Clickable Source Citation Badge
 */

export default function SourcePill({ label, url, timestamp, publishedAt }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        background: "var(--kite-cream)",
        border: "1px solid var(--kite-border)",
        borderRadius: "100px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        color: "var(--kite-amber-dark)",
        textDecoration: "none",
        whiteSpace: "nowrap",
        transition: "border-color 0.15s",
      }}
    >
      {label}
      {timestamp && <span style={{ color: "var(--kite-muted)" }}>· {timestamp}</span>}
      {publishedAt && <span style={{ color: "var(--kite-muted)" }}>· {publishedAt}</span>}
    </a>
  );
}
