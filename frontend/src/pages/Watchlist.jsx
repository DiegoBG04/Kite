/**
 * Watchlist.jsx — In-depth watchlist with full metrics for tracked securities
 */
import { useState, useEffect } from "react";
import { getQuotes, searchSymbols } from "../api/client";
import CompanyLogo from "../components/CompanyLogo";
import CompanyDrawer from "../components/CompanyDrawer";
import { useWatchlist } from "../hooks/useWatchlist";

function fmt(v, dec = 2) {
  if (v == null || isNaN(v)) return "—";
  return "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtShort(v) {
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  return "$" + v.toFixed(0);
}
const pnlColor = (v) => v == null ? "var(--kite-muted)" : v >= 0 ? "var(--kite-positive)" : "var(--kite-negative)";
const sign = (v) => (v != null && v >= 0 ? "+" : "");

const COL_DEFS = [
  { key: "name",           label: "Company",         width: 220 },
  { key: "price",          label: "Price",           width: 90,  align: "right" },
  { key: "change_pct",     label: "Day %",           width: 80,  align: "right" },
  { key: "market_cap",     label: "Mkt Cap",         width: 100, align: "right" },
  { key: "pe_ratio",       label: "P/E",             width: 70,  align: "right" },
  { key: "eps",            label: "EPS",             width: 70,  align: "right" },
  { key: "beta",           label: "Beta",            width: 60,  align: "right" },
  { key: "revenue_change", label: "Rev Growth",      width: 90,  align: "right" },
  { key: "week_52_high",   label: "52W High",        width: 90,  align: "right" },
  { key: "week_52_low",    label: "52W Low",         width: 90,  align: "right" },
];

export default function Watchlist() {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const tickers = watchlist.map((w) => w.ticker);
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [drawerStock, setDrawerStock] = useState(null);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);

  // Fetch quotes whenever tickers change
  useEffect(() => {
    if (!tickers.length) { setData({}); return; }
    setLoading(true);
    getQuotes(tickers)
      .then((stocks) => {
        const map = {};
        stocks.forEach((s) => { map[s.ticker] = s; });
        setData(map);
      })
      .finally(() => setLoading(false));
  }, [tickers.join(",")]);

  // Search as user types
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      searchSymbols(query.trim())
        .then(setResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function addTicker(symbol) {
    addToWatchlist(symbol);
    setQuery(""); setResults([]);
  }

  function removeTicker(symbol) {
    removeFromWatchlist(symbol);
    if (drawerStock?.ticker === symbol) setDrawerStock(null);
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => -d);
    else { setSortKey(key); setSortDir(1); }
  }

  const rows = tickers
    .map((t) => ({ ticker: t, ...(data[t] || {}) }))
    .sort((a, b) => {
      const av = a[sortKey] ?? (typeof a[sortKey] === "string" ? "" : -Infinity);
      const bv = b[sortKey] ?? (typeof b[sortKey] === "string" ? "" : -Infinity);
      if (av < bv) return -sortDir;
      if (av > bv) return sortDir;
      return 0;
    });

  function cellVal(row, key) {
    const v = row[key];
    switch (key) {
      case "name":           return null; // rendered separately
      case "price":          return v != null ? fmt(v) : "—";
      case "change_pct":     return v != null ? `${sign(v)}${v.toFixed(2)}%` : "—";
      case "market_cap":     return fmtShort(v);
      case "pe_ratio":       return v != null ? v.toFixed(1) : "—";
      case "eps":            return v != null ? fmt(v) : "—";
      case "beta":           return v != null ? v.toFixed(2) : "—";
      case "revenue_change": return v != null ? `${sign(v)}${v.toFixed(1)}%` : "—";
      case "week_52_high":   return v != null ? fmt(v) : "—";
      case "week_52_low":    return v != null ? fmt(v) : "—";
      default:               return "—";
    }
  }

  function cellColor(row, key) {
    if (key === "change_pct") return pnlColor(row[key]);
    if (key === "revenue_change") return pnlColor(row[key]);
    return "var(--kite-heading)";
  }

  const thStyle = (key) => ({
    padding: "0 12px",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: sortKey === key ? "var(--kite-amber-dark)" : "var(--kite-muted)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
    textAlign: key === "name" ? "left" : "right",
  });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "var(--kite-cream)" }}>

      {/* Main table */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header bar */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--kite-border)", background: "var(--kite-surface)", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--kite-heading)" }}>Watchlist</div>
            <div style={{ fontSize: "11px", color: "var(--kite-muted)", marginTop: "1px" }}>{tickers.length} securit{tickers.length === 1 ? "y" : "ies"} tracked</div>
          </div>

          {/* Search / add */}
          <div style={{ position: "relative" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) addTicker(query.trim()); }}
              placeholder="Add ticker (e.g. AAPL)…"
              style={{ padding: "7px 12px", width: "220px", background: "var(--kite-cream)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", fontSize: "13px", color: "var(--kite-heading)", outline: "none" }}
            />
            {results.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", zIndex: 50, maxHeight: "240px", overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
                {results.slice(0, 8).map((r) => (
                  <button key={r.symbol} onClick={() => addTicker(r.symbol)}
                    style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--kite-cream)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                  >
                    <CompanyLogo ticker={r.symbol} size={20} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "700", color: "var(--kite-amber-dark)", width: 52 }}>{r.symbol}</span>
                    <span style={{ fontSize: "12px", color: "var(--kite-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tickers.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px" }}>
              <div style={{ fontSize: "32px" }}>👁</div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--kite-heading)" }}>Your watchlist is empty</div>
              <div style={{ fontSize: "12px", color: "var(--kite-muted)" }}>Search for a ticker above to start tracking</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--kite-surface)", borderBottom: "1px solid var(--kite-border)", height: "36px" }}>
                  {COL_DEFS.map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} style={thStyle(col.key)}>
                      {col.label}{sortKey === col.key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.ticker}
                    onClick={() => setDrawerStock({ ticker: row.ticker, name: row.name || row.ticker, price: row.price || 0, change_pct: row.change_pct || 0, ...data[row.ticker] })}
                    style={{ borderBottom: "1px solid var(--kite-border)", height: "48px", cursor: "pointer", background: drawerStock?.ticker === row.ticker ? "var(--kite-amber-wash)" : i % 2 === 0 ? "var(--kite-surface)" : "transparent" }}
                    onMouseEnter={(e) => { if (drawerStock?.ticker !== row.ticker) e.currentTarget.style.background = "var(--kite-cream)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = drawerStock?.ticker === row.ticker ? "var(--kite-amber-wash)" : i % 2 === 0 ? "var(--kite-surface)" : "transparent"; }}
                  >
                    {COL_DEFS.map((col) => (
                      <td key={col.key} style={{ padding: "0 12px", fontSize: "13px", color: cellColor(row, col.key), textAlign: col.align || "left", fontFamily: col.key !== "name" ? "var(--font-mono)" : "inherit", whiteSpace: "nowrap" }}>
                        {col.key === "name" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <CompanyLogo ticker={row.ticker} size={28} />
                            <div>
                              <div style={{ fontWeight: "700", color: "var(--kite-amber-dark)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>{row.ticker}</div>
                              <div style={{ fontSize: "11px", color: "var(--kite-muted)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name || "—"}</div>
                            </div>
                          </div>
                        ) : (
                          cellVal(row, col.key)
                        )}
                      </td>
                    ))}
                    <td style={{ padding: "0 8px", textAlign: "center" }}>
                      <button onClick={(e) => { e.stopPropagation(); removeTicker(row.ticker); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--kite-muted)", fontSize: "16px", lineHeight: 1, padding: "4px" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "var(--kite-negative)"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "var(--kite-muted)"}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {loading && (
          <div style={{ padding: "8px 20px", fontSize: "11px", color: "var(--kite-muted)", background: "var(--kite-surface)", borderTop: "1px solid var(--kite-border)", flexShrink: 0 }}>
            Refreshing data…
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {drawerStock && (
        <CompanyDrawer
          stock={drawerStock}
          onClose={() => setDrawerStock(null)}
          portfolioData={data}
        />
      )}
    </div>
  );
}
