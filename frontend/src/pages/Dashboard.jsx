/**
 * Dashboard.jsx — Main Portfolio Dashboard Page
 */

import { useState, useEffect } from "react";
import { getPortfolio, getBriefing } from "../api/client";
import BriefingBox from "../components/BriefingBox";
import StockRow from "../components/StockRow";
import ChatBox from "../components/ChatBox";
import StockChart from "../components/StockChart";
import InsightCard from "../components/InsightCard";
import MetricsRow from "../components/MetricsRow";

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
    if (fetched) return;
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

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--kite-muted)", fontFamily: "var(--font-display)", fontSize: "16px" }}>
      Loading portfolio…
    </div>
  );

  if (error) return (
    <div style={{ padding: "32px", color: "var(--kite-negative)" }}>Error: {error}</div>
  );

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--kite-cream)" }}>

      {/* Left panel */}
      <div style={{
        width: "300px",
        minWidth: "300px",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--kite-border)",
        background: "var(--kite-surface)",
        overflowY: "auto",
      }}>
        <BriefingBox items={briefing.items} />

        <div style={{ padding: "0 16px" }}>
          <div style={{
            fontSize: "10px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--kite-muted)",
            padding: "16px 0 8px",
          }}>
            Portfolio
          </div>
          {portfolio.map((stock) => (
            <StockRow
              key={stock.ticker}
              ticker={stock.ticker}
              name={stock.name}
              price={stock.price}
              change={stock.change_pct}
              sparklineData={stock.sparkline_data}
              isSelected={selected?.ticker === stock.ticker}
              onClick={() => setSelected(stock)}
            />
          ))}
        </div>

        <div style={{ flex: 1, padding: "16px", borderTop: "1px solid var(--kite-border)", marginTop: "8px" }}>
          <ChatBox tickers={DEFAULT_TICKERS} />
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", padding: "24px", gap: "16px" }}>
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
            <InsightCard insight={null} sources={[]} />
          </>
        ) : (
          <div style={{ color: "var(--kite-muted)", paddingTop: "80px", textAlign: "center", fontFamily: "var(--font-display)" }}>
            Select a stock to view details.
          </div>
        )}
      </div>

    </div>
  );
}
