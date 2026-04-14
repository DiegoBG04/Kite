/**
 * StockChart.jsx — Right Panel Price Chart
 *
 * Purpose: Displays a line chart for the selected stock with period
 * selector buttons (1D, 1W, 1M, 3M, 1Y). Chart colour is green if
 * the stock is up for the selected period, red if down.
 *
 * Uses recharts LineChart. chartData is keyed by period label.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PERIODS = ["1D", "1W", "1M", "3M", "1Y"];

export default function StockChart({ ticker, name, price, change, chartData = {}, period, onPeriodChange }) {
  const isPositive = change >= 0;
  const color = isPositive ? "#22c55e" : "#ef4444";

  // Build recharts-compatible data from the flat price array for the active period
  const prices = chartData[period] || [];
  const data = prices.map((value, i) => ({ i, value }));

  return (
    <div>

      {/* Header — ticker, name, price, change */}
      <div style={{ marginBottom: "8px" }}>
        <strong>{ticker}</strong>
        <span style={{ marginLeft: "8px", color: "#888" }}>{name}</span>
        <span style={{ marginLeft: "16px", fontSize: "1.4em" }}>${price?.toFixed(2)}</span>
        <span style={{ marginLeft: "8px", color }}>
          {isPositive ? "+" : ""}{change?.toFixed(2)}%
        </span>
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            style={{
              fontWeight: p === period ? "bold" : "normal",
              textDecoration: p === period ? "underline" : "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height: 220 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="i" hide />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip
                formatter={(value) => [`$${value.toFixed(2)}`, ticker]}
                labelFormatter={() => ""}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: "#888", paddingTop: "80px", textAlign: "center" }}>
            No chart data available
          </div>
        )}
      </div>

    </div>
  );
}
