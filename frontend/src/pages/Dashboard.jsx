/**
 * Dashboard.jsx — Main Portfolio Dashboard Page
 */

import { useState, useEffect } from "react";
import { getPortfolio, getBriefing } from "../api/client";
import BriefingBox from "../components/BriefingBox";
import StockRow from "../components/StockRow";
import ChatBox from "../components/ChatBox";
import CompanyDrawer from "../components/CompanyDrawer";

const DEFAULT_TICKERS = ["AAPL", "MSFT", "NVDA"];

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState([]);
  const [briefing, setBriefing] = useState({ items: [] });
  const [selected, setSelected] = useState(null);
  const [drawerStock, setDrawerStock] = useState(null);
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
              onClick={() => { setSelected(stock); setDrawerStock(stock); }}
            />
          ))}
        </div>

        <div style={{ flex: 1, padding: "16px", borderTop: "1px solid var(--kite-border)", marginTop: "8px" }}>
          <ChatBox tickers={DEFAULT_TICKERS} />
        </div>
      </div>

      {/* Right panel — prompt to open company view */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        color: "var(--kite-muted)",
      }}>
        <div style={{ fontSize: "32px", opacity: 0.25 }}>↗</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--kite-heading)", opacity: 0.5 }}>
          Select a stock to open its analytics
        </div>
        <div style={{ fontSize: "12px", opacity: 0.6 }}>
          Price · Revenue · EBITDA · Net Income · News
        </div>
      </div>

      <CompanyDrawer
        stock={drawerStock}
        onClose={() => setDrawerStock(null)}
        portfolioData={Object.fromEntries(portfolio.map((s) => [s.ticker, s]))}
      />
    </div>
  );
}
