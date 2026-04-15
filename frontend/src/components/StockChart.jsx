/**
 * StockChart.jsx — Right Panel Price Chart
 *
 * Purpose: Displays a line chart for the selected stock with period
 * selector buttons. Chart colour is green if the stock is up for the
 * selected period, red if down. Shows Y-axis price scale and X-axis
 * time labels approximated from the period and data point count.
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

const PERIODS = ["1D", "1W", "1M", "3M", "6M", "1Y", "6Y", "MAX"];

// How many ms each data point represents per period
const INTERVAL_MS = {
  "1D":  5 * 60 * 1000,           // 5-min bars
  "1W":  60 * 60 * 1000,          // 1-hour bars
  "1M":  24 * 60 * 60 * 1000,     // daily
  "3M":  24 * 60 * 60 * 1000,     // daily
  "6M":  24 * 60 * 60 * 1000,     // daily
  "1Y":  7 * 24 * 60 * 60 * 1000, // weekly
  "6Y":  30 * 24 * 60 * 60 * 1000,// monthly
  "MAX": 30 * 24 * 60 * 60 * 1000,// monthly
};

function formatXLabel(date, period) {
  if (period === "1D") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  if (period === "1W") {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  if (period === "1M" || period === "3M" || period === "6M") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (period === "1Y") {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  // 6Y, MAX
  return date.getFullYear().toString();
}

// How many X-axis ticks to show per period
const TICK_COUNT = {
  "1D": 6, "1W": 5, "1M": 5, "3M": 6,
  "6M": 6, "1Y": 6, "6Y": 6, "MAX": 6,
};

export default function StockChart({ ticker, name, price, change, chartData = {}, period, onPeriodChange }) {
  const isPositive = change >= 0;
  const color = isPositive ? "#22c55e" : "#ef4444";

  const prices = chartData[period] || [];
  const now = Date.now();
  const intervalMs = INTERVAL_MS[period] || 24 * 60 * 60 * 1000;
  const totalPoints = prices.length;

  // Build recharts data with approximate timestamps
  const data = prices.map((value, i) => {
    const ts = now - (totalPoints - 1 - i) * intervalMs;
    return { i, value, ts };
  });

  // Determine which indices to show as X-axis ticks
  const numTicks = TICK_COUNT[period] || 6;
  const tickIndices = totalPoints > 0
    ? Array.from({ length: numTicks }, (_, k) => Math.round((k / (numTicks - 1)) * (totalPoints - 1)))
    : [];

  const xTickFormatter = (i) => {
    const point = data[i];
    if (!point) return "";
    return formatXLabel(new Date(point.ts), period);
  };

  // Y-axis: price range with a little padding
  const values = prices.filter(Boolean);
  const minPrice = values.length ? Math.min(...values) : 0;
  const maxPrice = values.length ? Math.max(...values) : 0;
  const padding = (maxPrice - minPrice) * 0.05 || 1;
  const yDomain = [minPrice - padding, maxPrice + padding];

  return (
    <div>
      {/* Header */}
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
            <LineChart data={data} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <XAxis
                dataKey="i"
                ticks={tickIndices}
                tickFormatter={xTickFormatter}
                tick={{ fontSize: 11, fill: "#888" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                tick={{ fontSize: 11, fill: "#888" }}
                axisLine={false}
                tickLine={false}
                width={52}
                orientation="right"
              />
              <Tooltip
                formatter={(value) => [`$${value.toFixed(2)}`, ticker]}
                labelFormatter={(i) => {
                  const point = data[i];
                  return point ? formatXLabel(new Date(point.ts), period) : "";
                }}
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
