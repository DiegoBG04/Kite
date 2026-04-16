/**
 * useWatchlist.js — Watchlist State (localStorage)
 * Stores: [{ ticker }] — just tickers, no position data.
 */

import { useState, useEffect } from "react";

const STORAGE_KEY = "kite_watchlist";

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  function addToWatchlist(ticker) {
    const t = ticker.toUpperCase().trim();
    if (!t) return;
    setWatchlist((prev) => prev.find((w) => w.ticker === t) ? prev : [...prev, { ticker: t }]);
  }

  function removeFromWatchlist(ticker) {
    setWatchlist((prev) => prev.filter((w) => w.ticker !== ticker.toUpperCase()));
  }

  return { watchlist, addToWatchlist, removeFromWatchlist };
}
