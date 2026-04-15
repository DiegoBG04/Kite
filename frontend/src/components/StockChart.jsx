/**
 * StockChart.jsx — Right Panel Price Chart
 */

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const PERIODS = ["1D", "1W", "1M", "3M", "6M", "1Y", "6Y", "MAX"];

const INTERVAL_MS = {
  "1D":  5 * 60 * 1000,
  "1W":  60 * 60 * 1000,
  "1M":  24 * 60 * 60 * 1000,
  "3M":  24 * 60 * 60 * 1000,
  "6M":  24 * 60 * 60 * 1000,
  "1Y":  7 * 24 * 60 * 60 * 1000,
  "6Y":  30 * 24 * 60 * 60 * 1000,
  "MAX": 30 * 24 * 60 * 60 * 1000,
};

const TICK_COUNT = {
  "1D": 6, "1W": 5, "1M": 5, "3M": 6,
  "6M": 6, "1Y": 6, "6Y": 6, "MAX": 6,
};

function formatXLabel(date, period) {
  if (period === "1D") return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (period === "1W") return date.toLocaleDateString("en-US", { weekday: "short" });
  if (["1M", "3M", "6M"].includes(period)) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (period === "1Y") return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return date.getFullYear().toString();
}

export default function StockChart({ ticker, name, price, change, chartData = {}, period, onPeriodChange }) {
  const isPositive = change >= 0;
  const strokeColor = isPositive ? "#2D6A4F" : "#B54040";
  const changeColor = isPositive ? "var(--kite-positive)" : "var(--kite-negative)";

  const prices = chartData[period] || [];
  const now = Date.now();
  const intervalMs = INTERVAL_MS[period] || 24 * 60 * 60 * 1000;
  const totalPoints = prices.length;

  const data = prices.map((value, i) => ({
    i,
    value,
    ts: now - (totalPoints - 1 - i) * intervalMs,
  }));

  const numTicks = TICK_COUNT[period] || 6;
  const tickIndices = totalPoints > 0
    ? Array.from({ length: numTicks }, (_, k) =>
        Math.round((k / (numTicks - 1)) * (totalPoints - 1)))
    : [];

  const values = prices.filter(Boolean);
  const minPrice = values.length ? Math.min(...values) : 0;
  const maxPrice = values.length ? Math.max(...values) : 0;
  const padding = (maxPrice - minPrice) * 0.08 || 1;
  const yDomain = [minPrice - padding, maxPrice + padding];

  return (
    <div style={{
      background: "var(--kite-surface)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--kite-border)",
      padding: "20px 20px 12px",
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--kite-amber-dark)", letterSpacing: "0.04em" }}>
          {ticker}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--kite-heading)" }}>
          {name}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "22px", fontWeight: "500", color: "var(--kite-heading)" }}>
          ${price?.toFixed(2)}
        </span>
        <span style={{ fontSize: "13px", color: changeColor }}>
          {isPositive ? "+" : ""}{change?.toFixed(2)}%
        </span>
      </div>

      {/* Chart */}
      <div style={{ height: 200 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <XAxis
                dataKey="i"
                ticks={tickIndices}
                tickFormatter={(i) => { const p = data[i]; return p ? formatXLabel(new Date(p.ts), period) : ""; }}
                tick={{ fontSize: 11, fill: "#B0A080", fontFamily: "var(--font-body)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                tick={{ fontSize: 11, fill: "#B0A080", fontFamily: "var(--font-body)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                orientation="right"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--kite-surface)",
                  border: "1px solid var(--kite-border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  color: "var(--kite-heading)",
                  fontFamily: "var(--font-body)",
                }}
                formatter={(value) => [`$${value.toFixed(2)}`, ticker]}
                labelFormatter={(i) => { const p = data[i]; return p ? formatXLabel(new Date(p.ts), period) : ""; }}
              />
              <Line type="monotone" dataKey="value" stroke={strokeColor} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--kite-muted)", fontSize: "13px" }}>
            No chart data available
          </div>
        )}
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: "2px", marginTop: "12px", justifyContent: "center" }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            style={{
              fontSize: "11px",
              fontWeight: p === period ? "700" : "400",
              color: p === period ? "var(--kite-amber-dark)" : "var(--kite-muted)",
              background: p === period ? "var(--kite-amber-wash)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "4px 8px",
              cursor: "pointer",
              letterSpacing: "0.03em",
              transition: "all 0.15s",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
