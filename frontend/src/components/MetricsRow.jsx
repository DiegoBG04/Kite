/**
 * MetricsRow.jsx — Key Financial Metrics Row
 *
 * Purpose: Displays four metric blocks for the selected stock:
 *   P/E Ratio | Revenue Change | Risk Flags | Last Filing
 *
 * Data comes from GET /portfolio/{ticker} (PortfolioResponse in models.py).
 *
 * Used by: Dashboard.jsx (right panel, below InsightCard)
 *
 * Props:
 *   pe             (number|null)  — trailing P/E ratio
 *   revenueChange  (number|null)  — YoY revenue change as a percentage
 *   riskFlags      (number)       — count of active risk flags
 *   lastFiling     (string|null)  — e.g. "10-K FY2024"
 *
 * TODO (Step 8): Implement and style the four metric blocks.
 */

export default function MetricsRow({ pe, revenueChange, riskFlags, lastFiling }) {
  return (
    <div>
      <div>
        <span>P/E</span>
        <span>{pe != null ? pe.toFixed(1) : "—"}</span>
      </div>
      <div>
        <span>Revenue</span>
        <span>{revenueChange != null ? `${revenueChange > 0 ? "+" : ""}${revenueChange.toFixed(1)}%` : "—"}</span>
      </div>
      <div>
        <span>Risk Flags</span>
        <span>{riskFlags ?? 0}</span>
      </div>
      <div>
        <span>Last Filing</span>
        <span>{lastFiling ?? "—"}</span>
      </div>
    </div>
  );
}
