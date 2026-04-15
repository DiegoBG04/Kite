/**
 * MetricsRow.jsx — Key Financial Metrics Row
 */

export default function MetricsRow({ pe, revenueChange, riskFlags, lastFiling }) {
  const metrics = [
    {
      label: "P / E Ratio",
      value: pe != null ? pe.toFixed(1) : "—",
      color: "var(--kite-heading)",
    },
    {
      label: "Revenue YoY",
      value: revenueChange != null
        ? `${revenueChange > 0 ? "+" : ""}${revenueChange.toFixed(1)}%`
        : "—",
      color: revenueChange == null ? "var(--kite-heading)"
        : revenueChange > 0 ? "var(--kite-positive)" : "var(--kite-negative)",
    },
    {
      label: "Risk Flags",
      value: riskFlags ?? 0,
      color: riskFlags > 0 ? "var(--kite-amber-dark)" : "var(--kite-heading)",
    },
    {
      label: "Last Filing",
      value: lastFiling ?? "—",
      color: "var(--kite-heading)",
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "12px",
    }}>
      {metrics.map(({ label, value, color }) => (
        <div key={label} style={{
          background: "var(--kite-surface)",
          border: "1px solid var(--kite-border)",
          borderRadius: "var(--radius-md)",
          padding: "14px 16px",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{
            fontSize: "10px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--kite-muted)",
            marginBottom: "6px",
          }}>
            {label}
          </div>
          <div style={{
            fontSize: "18px",
            fontFamily: "var(--font-display)",
            color,
          }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
