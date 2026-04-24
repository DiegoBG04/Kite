/**
 * App.jsx — Router and Layout Shell
 */

import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import News from "./pages/News";
import Profile from "./pages/Profile";
import Portfolios from "./pages/Portfolios";
import Watchlist from "./pages/Watchlist";
import Market from "./pages/Market";
import Screener from "./pages/Screener";
import CompanyDrawer from "./components/CompanyDrawer";
import CompanyLogo from "./components/CompanyLogo";
import { useTheme } from "./hooks/useTheme";
import { searchSymbols, getQuotes } from "./api/client";

const NAV_LINKS = [
  { to: "/",          label: "Dashboard"  },
  { to: "/portfolios",label: "Portfolios" },
  { to: "/watchlist", label: "Watchlist"  },
  { to: "/market",    label: "Market"     },
  { to: "/news",      label: "News"       },
  { to: "/screener",  label: "Screener"   },
];

function GlobalSearch({ onOpen }) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [open,      setOpen]      = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(() => {
      setSearching(true);
      searchSymbols(query.trim())
        .then((r) => { setResults(r.slice(0, 8)); setOpen(true); })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function select(symbol, name) {
    setQuery(""); setResults([]); setOpen(false);
    // Fetch a lightweight quote so the drawer has real price data
    try {
      const [stock] = await getQuotes([symbol]);
      onOpen(stock ?? { ticker: symbol, name, price: 0, change_pct: 0 });
    } catch {
      onOpen({ ticker: symbol, name, price: 0, change_pct: 0 });
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", width: 260 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--kite-cream)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", padding: "0 12px", height: "34px" }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
          <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--kite-heading)" strokeWidth="1.6"/>
          <path d="M10.5 10.5L14 14" stroke="var(--kite-heading)" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies…"
          style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: "13px", color: "var(--kite-heading)" }}
        />
        {searching && <span style={{ fontSize: "10px", color: "var(--kite-muted)" }}>…</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", overflow: "hidden" }}>
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => select(r.symbol, r.name)}
              style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--kite-cream)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              <CompanyLogo ticker={r.symbol} size={22} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "700", color: "var(--kite-amber-dark)", width: 52, flexShrink: 0 }}>{r.symbol}</span>
              <span style={{ fontSize: "12px", color: "var(--kite-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <span style={{ fontSize: "10px", color: "var(--kite-border)", marginLeft: "auto", flexShrink: 0 }}>{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavAvatar() {
  return (
    <NavLink to="/profile" style={{ textDecoration: "none" }} title="Profile">
      {({ isActive }) => (
        <div style={{
          width: 34, height: 34,
          borderRadius: "50%",
          background: isActive ? "var(--kite-amber-dark)" : "var(--kite-amber-wash)",
          border: `2px solid ${isActive ? "var(--kite-amber-dark)" : "var(--kite-border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          fontWeight: "700",
          color: isActive ? "#fff" : "var(--kite-amber-dark)",
          cursor: "pointer",
          transition: "all 0.15s",
          flexShrink: 0,
        }}>
          DB
        </div>
      )}
    </NavLink>
  );
}

function Layout() {
  useTheme();
  const [drawerStock, setDrawerStock] = useState(null);

  const linkStyle = (isActive) => ({
    fontFamily: "var(--font-body)",
    fontSize: "14px",
    fontWeight: isActive ? "600" : "400",
    color: isActive ? "var(--kite-amber-dark)" : "var(--kite-muted)",
    padding: "6px 14px",
    borderRadius: "var(--radius-sm)",
    textDecoration: "none",
    transition: "color 0.15s",
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
  });

  return (
    <>
      <nav style={{
        display: "flex",
        alignItems: "center",
        gap: "0",
        padding: "0 20px",
        height: "52px",
        background: "var(--kite-surface)",
        borderBottom: "1px solid var(--kite-border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "20px", flexShrink: 0 }}>
          <img src="/kite-icon.svg" alt="Kite" style={{ width: 28, height: 28, borderRadius: 6 }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: "var(--kite-heading)", letterSpacing: "-0.01em" }}>
            Kite
          </span>
        </div>

        {/* Nav links */}
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === "/"} style={({ isActive }) => linkStyle(isActive)}>
            {label}
          </NavLink>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Global search */}
        <GlobalSearch onOpen={setDrawerStock} />

        {/* Avatar */}
        <div style={{ marginLeft: "12px" }}>
          <NavAvatar />
        </div>
      </nav>

      <main style={{ height: "calc(100vh - 52px)", overflow: "hidden" }}>
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/portfolios"  element={<Portfolios />} />
          <Route path="/watchlist"   element={<Watchlist />} />
          <Route path="/market"      element={<Market />} />
          <Route path="/news"        element={<News />} />
          <Route path="/screener"    element={<Screener />} />
          <Route path="/profile"     element={<Profile />} />
        </Routes>
      </main>

      {/* Global company drawer — opened from search */}
      {drawerStock && (
        <CompanyDrawer
          stock={drawerStock}
          onClose={() => setDrawerStock(null)}
          portfolioData={{}}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
