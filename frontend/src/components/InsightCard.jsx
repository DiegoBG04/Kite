/**
 * InsightCard.jsx — Key Insight with Source Pills
 */

import SourcedBadge from "./SourcedBadge";
import SourcePill from "./SourcePill";

export default function InsightCard({ insight, sources = [] }) {
  if (!insight) {
    return (
      <div style={{
        background: "var(--kite-surface)",
        border: "1px solid var(--kite-border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        boxShadow: "var(--shadow-card)",
      }}>
        <div style={{
          fontSize: "10px",
          fontWeight: "700",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--kite-muted)",
          marginBottom: "10px",
        }}>
          AI Insight
        </div>
        <p style={{ color: "var(--kite-muted)", fontSize: "13px" }}>
          Ask Kite a question below to see cited insights here.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--kite-surface)",
      border: "1px solid var(--kite-border)",
      borderRadius: "var(--radius-lg)",
      padding: "20px",
      boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div style={{
          fontSize: "10px",
          fontWeight: "700",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--kite-muted)",
        }}>
          AI Insight
        </div>
        <SourcedBadge />
      </div>

      <p style={{
        fontSize: "14px",
        color: "var(--kite-body)",
        lineHeight: "1.7",
        marginBottom: "14px",
      }}>
        {insight}
      </p>

      {sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sources.map((source, i) => (
            <SourcePill
              key={i}
              label={source.label}
              url={source.source_url}
              timestamp={source.timestamp}
              publishedAt={source.published_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}
