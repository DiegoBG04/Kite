/**
 * StockRow.jsx — Stock List Row with Sparkline
 *
 * Purpose: Renders one row in the portfolio stock list on the Dashboard.
 * Shows ticker, name, current price, percentage change, and a small
 * sparkline chart. Clicking the row updates the right panel.
 *
 * Uses recharts for the sparkline — no external charting dependency needed
 * beyond what's already in package.json.
 */

import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function StockRow({ ticker, name, price, change, sparklineData = [], onClick }) {
  const isPositive = change >= 0;

  // recharts needs data as array of objects
  const chartData = sparklineData.map((value, i) => ({ i, value }));

  return (
    <div onClick={onClick} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>

      {/* Ticker and name */}
      <div style={{ flex: 1 }}>
        <div><strong>{ticker}</strong></div>
        <div style={{ fontSize: "0.85em" }}>{name}</div>
      </div>

      {/* Sparkline */}
      <div style={{ width: 80, height: 32 }}>
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "#22c55e" : "#ef4444"}
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Price and change */}
      <div style={{ textAlign: "right" }}>
        <div>${price?.toFixed(2)}</div>
        <div style={{ color: isPositive ? "#22c55e" : "#ef4444", fontSize: "0.85em" }}>
          {isPositive ? "+" : ""}{change?.toFixed(2)}%
        </div>
      </div>

    </div>
  );
}
