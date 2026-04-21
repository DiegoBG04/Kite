import { useState, useEffect } from "react";

const STORAGE_KEY = "kite_portfolios_v2";
const ACTIVE_KEY  = "kite_active_portfolio";

function loadPortfolios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
    const legacy = JSON.parse(localStorage.getItem("kite_holdings") || "[]");
    return [{ id: "default", name: "My Portfolio", holdings: legacy }];
  } catch {
    return [{ id: "default", name: "My Portfolio", holdings: [] }];
  }
}

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState(loadPortfolios);
  const [activeId, setActiveId] = useState(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      const ps = loadPortfolios();
      return (saved && ps.some((p) => p.id === saved)) ? saved : (ps[0]?.id || "default");
    } catch {
      return "default";
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
  }, [portfolios]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  const activePortfolio =
    portfolios.find((p) => p.id === activeId) ||
    portfolios[0] ||
    { id: "default", name: "My Portfolio", holdings: [] };

  function createPortfolio(name) {
    const id = `p_${Date.now()}`;
    setPortfolios((prev) => [...prev, { id, name: name.trim() || "New Portfolio", holdings: [] }]);
    setActiveId(id);
    return id;
  }

  function deletePortfolio(id) {
    setPortfolios((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const result = next.length > 0 ? next : [{ id: "default", name: "My Portfolio", holdings: [] }];
      if (activeId === id) setActiveId(result[0].id);
      return result;
    });
  }

  function renamePortfolio(id, name) {
    setPortfolios((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
    );
  }

  function replaceHoldings(portfolioId, newHoldings) {
    setPortfolios((prev) =>
      prev.map((p) => (p.id === portfolioId ? { ...p, holdings: newHoldings } : p))
    );
  }

  return {
    portfolios,
    activePortfolio,
    activeId,
    setActiveId,
    createPortfolio,
    deletePortfolio,
    renamePortfolio,
    replaceHoldings,
  };
}
