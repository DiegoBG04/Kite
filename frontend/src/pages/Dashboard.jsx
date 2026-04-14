/**
 * Dashboard.jsx — Main Portfolio Dashboard Page
 *
 * Purpose: The primary view of Kite. Two panels:
 *   Left:  BriefingBox + list of StockRows + ChatBox
 *   Right: StockChart + InsightCard + MetricsRow for the selected stock
 *
 * On load, fetches live portfolio data and today's briefing from the API.
 * Clicking a StockRow updates the right panel for that stock.
 */

import { useState, useEffect } from "react";
import { getPortfolio, getBriefing } from "../api/client";
import BriefingBox from "../components/BriefingBox";
import StockRow from "../components/StockRow";
import ChatBox from "../components/ChatBox";
import StockChart from "../components/StockChart";
import InsightCard from "../components/InsightCard";
import MetricsRow from "../components/MetricsRow";

// Hardcoded for MVP — replaced with user portfolio after auth is built (Week 7)
const DEFAULT_TICKERS = ["AAPL", "MSFT", "NVDA"];

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState([]);
  const [briefing, setBriefing] = useState({ items: [] });
  const [selected, setSelected] = useState(null);
  const [period, setPeriod] = useState("1M");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (fetched) return;  // Only fetch once — prevents duplicate requests on re-render
    setFetched(true);
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [stocks, brief] = await Promise.all([
          getPortfolio(DEFAULT_TICKERS),
          getBriefing(today),
        ]);
        setPortfolio(stocks);
        setBriefing(brief);
        if (stocks.length > 0) setSelected(stocks[0]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 32 }}>Loading portfolio...</div>;
  if (error)   return <div style={{ padding: 32, color: "red" }}>Error: {error}</div>;

  return (
    <div style={{ display: "flex", gap: "24px", padding: "16px", height: "100vh", boxSizing: "border-box" }}>

      {/* Left panel */}
      <div style={{ width: 320, display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
        <BriefingBox items={briefing.items} />

        <div>
          {portfolio.map((stock) => (
            <StockRow
              key={stock.ticker}
              ticker={stock.ticker}
              name={stock.name}
              price={stock.price}
              change={stock.change_pct}
              sparklineData={stock.sparkline_data}
              onClick={() => setSelected(stock)}
            />
          ))}
        </div>

        <ChatBox tickers={DEFAULT_TICKERS} />
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
        {selected ? (
          <>
            <StockChart
              ticker={selected.ticker}
              name={selected.name}
              price={selected.price}
              change={selected.change_pct}
              chartData={selected.chart_data}
              period={period}
              onPeriodChange={setPeriod}
            />
            <MetricsRow
              pe={selected.pe_ratio}
              revenueChange={selected.revenue_change}
              riskFlags={selected.risk_flags}
              lastFiling={selected.last_filing}
            />
            <InsightCard
              insight={null}
              sources={[]}
            />
          </>
        ) : (
          <div style={{ color: "#888" }}>Select a stock to view details.</div>
        )}
      </div>

    </div>
  );
}
