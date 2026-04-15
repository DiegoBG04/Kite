/**
 * SourcedBadge.jsx — "SOURCED" Trust Indicator Badge
 *
 * Amber wash background, amber border — signals every Kite output
 * is traceable to a real document, not hallucinated.
 */

export default function SourcedBadge() {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      background: "var(--kite-amber-wash)",
      border: "1px solid var(--kite-amber-dark)",
      borderRadius: "100px",
      fontFamily: "var(--font-body)",
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--kite-amber-dark)",
    }}>
      Sourced
    </span>
  );
}
