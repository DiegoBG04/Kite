/**
 * Dashboard.jsx — Main Portfolio Dashboard
 */

import { useState, useEffect } from "react";
import { getQuotes } from "../api/client";
import { useHoldings } from "../hooks/useHoldings";
import { useWatchlist } from "../hooks/useWatchlist";
import PortfolioTable from "../components/PortfolioTable";
import WatchlistPanel from "../components/WatchlistPanel";
import ChatWidget from "../components/ChatWidget";
import CompanyDrawer from "../components/CompanyDrawer";
import PortfolioEditModal from "../components/PortfolioEditModal";

export default function Dashboard() {
  const { holdings, replaceHoldings }                      = useHoldings();
  const { watchlist, addToWatchlist, removeFromWatchlist, reorderWatchlist } = useWatchlist();
  const [portfolioData, setPortfolioData]                  = useState({});
  const [drawerStock, setDrawerStock]                      = useState(null);
  const [selectedTicker, setSelectedTicker]                = useState(null);
  const [showEditModal, setShowEditModal]                   = useState(false);

  const holdingTickers   = holdings.map((h) => h.ticker);
  const watchlistTickers = watchlist.map((w) => w.ticker).filter((t) => !holdingTickers.includes(t));
  const allTickers       = [...new Set([...holdingTickers, ...watchlistTickers])];

  // Fetch lightweight quote data (1 API call per ticker) for all tickers.
  // Chart data is loaded separately by CompanyDrawer only when a stock is opened.
  useEffect(() => {
    if (allTickers.length === 0) return;
    getQuotes(allTickers).then((stocks) => {
      setPortfolioData((prev) => {
        const next = { ...prev };
        stocks.forEach((s) => { next[s.ticker] = s; });
        return next;
      });
    });
  }, [allTickers.join(",")]);

  function handleSelect(stock) {
    setSelectedTicker(stock.ticker);
    setDrawerStock(stock);
  }

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--kite-cream)" }}>

      {/* Center — portfolio table */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <PortfolioTable
          holdings={holdings}
          portfolioData={portfolioData}
          onSelectStock={handleSelect}
          selectedTicker={selectedTicker}
          onEditPortfolio={() => setShowEditModal(true)}
        />
      </div>

      {/* Right — watchlist */}
      <WatchlistPanel
        watchlist={watchlist}
        portfolioData={portfolioData}
        onSelect={handleSelect}
        onAdd={addToWatchlist}
        onRemove={removeFromWatchlist}
        onReorder={reorderWatchlist}
      />

      <ChatWidget tickers={holdingTickers.length ? holdingTickers : ["AAPL", "MSFT", "NVDA"]} />

      <CompanyDrawer
        stock={drawerStock}
        onClose={() => { setDrawerStock(null); setSelectedTicker(null); }}
        portfolioData={portfolioData}
      />

      {showEditModal && (
        <PortfolioEditModal
          holdings={holdings}
          portfolioData={portfolioData}
          onSave={replaceHoldings}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
