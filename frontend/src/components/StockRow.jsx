/**
 * StockRow.jsx — Stock List Row with Sparkline
 */

import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function StockRow({ ticker, name, price, change, sparklineData = [], isSelected, onClick }) {
  const isPositive = change >= 0;
  const color = isPositive ? "var(--kite-positive)" : "var(--kite-negative)";

  const chartData = sparklineData.map((value, i) => ({ i, value }));

  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        background: isSelected ? "var(--kite-amber-wash)" : "transparent",
        marginBottom: "2px",
        transition: "background 0.15s",
      }}
    >
      {/* Ticker and name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          color: "var(--kite-amber-dark)",
          fontWeight: "600",
          letterSpacing: "0.04em",
        }}>
          {ticker}
        </div>
        <div style={{
          fontSize: "12px",
          color: "var(--kite-muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {name}
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ width: 64, height: 28, flexShrink: 0 }}>
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "#2D6A4F" : "#B54040"}
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Price and change */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "13px", color: "var(--kite-heading)", fontWeight: "500" }}>
          ${price?.toFixed(2)}
        </div>
        <div style={{ fontSize: "11px", color }}>
          {isPositive ? "+" : ""}{change?.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
