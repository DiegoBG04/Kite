/**
 * useHoldings.js — Portfolio Holdings State (localStorage)
 *
 * Stores: [{ ticker, shares, costBasis, purchaseDate }]
 * Persists across sessions via localStorage.
 */

import { useState, useEffect } from "react";

const STORAGE_KEY = "kite_holdings";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useHoldings() {
  const [holdings, setHoldings] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  }, [holdings]);

  function addHolding(ticker, shares, costBasis, purchaseDate) {
    const t = ticker.toUpperCase().trim();
    if (!t || !shares) return;
    setHoldings((prev) => {
      const idx = prev.findIndex((h) => h.ticker === t);
      const entry = { ticker: t, shares: Number(shares), costBasis: Number(costBasis) || 0, purchaseDate: purchaseDate || "" };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry];
    });
  }

  function removeHolding(ticker) {
    setHoldings((prev) => prev.filter((h) => h.ticker !== ticker.toUpperCase()));
  }

  /** Replace the entire holdings list at once (used by PortfolioEditModal on save). */
  function replaceHoldings(newHoldings) {
    setHoldings(newHoldings);
  }

  return { holdings, addHolding, removeHolding, replaceHoldings };
}
