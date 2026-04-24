/**
 * Dashboard.jsx — Morning Brief
 *
 * Layout (left→right):
 *   Main scroll area  |  Watchlist panel (220px)
 *
 * Main area (top→bottom):
 *   AI Brief  →  Snapshot row  →  two-col: News | Upcoming Events
 */

import { useState, useEffect } from "react";
import { getQuotes, getNews } from "../api/client";
import { useHoldings } from "../hooks/useHoldings";
import { useWatchlist } from "../hooks/useWatchlist";
import CompanyLogo from "../components/CompanyLogo";
import WatchlistPanel from "../components/WatchlistPanel";
import CompanyDrawer from "../components/CompanyDrawer";
import PortfolioEditModal from "../components/PortfolioEditModal";
import ChatWidget from "../components/ChatWidget";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDollar(v, decimals = 0) {
  if (v == null || isNaN(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "−$" : "$";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}${(abs / 1e6).toFixed(1)}M`;
  return `${sign}${abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtPct(v) {
  if (v == null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Mock data (replace with real API when available) ─────────────────────────

const AI_BRIEF = [
  { icon: "📈", text: "Your portfolio is outperforming SPY by 2.3% over the past 30 days. Tech exposure is the primary driver." },
  { icon: "⚠️", text: "NVDA reports earnings in 4 days. Your position represents 18% of portfolio — consider whether to reduce ahead of volatility." },
  { icon: "💡", text: "Sector rotation into defensives is accelerating. Your XLV and XLP holdings are positioned well if this continues." },
];

const UPCOMING_EVENTS = [
  { date: "Apr 29", ticker: "AAPL", name: "Apple Inc.",       event: "Q2 Earnings",            type: "earnings" },
  { date: "Apr 30", ticker: "META", name: "Meta Platforms",   event: "Q1 Earnings",            type: "earnings" },
  { date: "Apr 30", ticker: "MSFT", name: "Microsoft Corp.",  event: "Q3 FY2025 Earnings",     type: "earnings" },
  { date: "May 1",  ticker: "AMZN", name: "Amazon.com",       event: "Q1 Earnings",            type: "earnings" },
  { date: "May 1",  ticker: "GOOGL",name: "Alphabet Inc.",    event: "Q1 Earnings",            type: "earnings" },
  { date: "May 7",  ticker: "NVDA", name: "NVIDIA Corp.",     event: "GTC Developer Session",  type: "presentation" },
  { date: "May 14", ticker: "NVDA", name: "NVIDIA Corp.",     event: "Q1 FY2026 Earnings",     type: "earnings" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--kite-surface)",
      border: "1px solid var(--kite-border)",
      borderRadius: "var(--radius-md)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--kite-muted)", marginBottom: "12px" }}>
      {children}
    </div>
  );
}

// ── AI Brief ─────────────────────────────────────────────────────────────────

function AIBrief() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <Card style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--kite-amber-dark)" }}>
          AI Brief
        </div>
        <div style={{ flex: 1, height: "1px", background: "var(--kite-border)" }} />
        <div style={{ fontSize: "11px", color: "var(--kite-muted)" }}>{today}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {AI_BRIEF.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>{item.icon}</span>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--kite-heading)", lineHeight: "1.55" }}>{item.text}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "12px", fontSize: "10px", color: "var(--kite-muted)", fontStyle: "italic" }}>
        Generated at market open · Updated daily
      </div>
    </Card>
  );
}

// ── Portfolio Snapshot ────────────────────────────────────────────────────────

function SnapshotRow({ holdings, portfolioData, onEditPortfolio }) {
  const stats = holdings.reduce((acc, h) => {
    const q = portfolioData[h.ticker];
    if (!q?.price) return acc;
    const mv    = h.shares * q.price;
    const cost  = h.shares * (h.costBasis || 0);
    const dayPL = h.shares * q.price * (q.change_pct || 0) / 100;
    acc.totalValue   += mv;
    acc.totalCost    += cost;
    acc.dayPL        += dayPL;
    acc.count        += 1;
    return acc;
  }, { totalValue: 0, totalCost: 0, dayPL: 0, count: 0 });

  const totalPL    = stats.totalValue - stats.totalCost;
  const totalPLPct = stats.totalCost > 0 ? (totalPL / stats.totalCost) * 100 : null;
  const dayPLPct   = stats.totalValue > 0 ? (stats.dayPL / (stats.totalValue - stats.dayPL)) * 100 : null;

  const tiles = [
    { label: "Portfolio Value",  value: fmtDollar(stats.totalValue, 2),  sub: null,                                    accent: false },
    { label: "Day P&L",          value: fmtDollar(stats.dayPL, 2),       sub: fmtPct(dayPLPct),                        accent: true, pos: stats.dayPL >= 0 },
    { label: "Total Return",     value: fmtDollar(totalPL, 2),           sub: fmtPct(totalPLPct),                      accent: true, pos: totalPL >= 0 },
    { label: "Holdings",         value: stats.count || holdings.length,   sub: null,                                    accent: false },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
      {tiles.map(({ label, value, sub, accent, pos }) => (
        <Card key={label} style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", marginBottom: "6px" }}>
            {label}
          </div>
          <div style={{ fontSize: "22px", fontWeight: "500", lineHeight: 1.1, color: accent ? (pos ? "var(--kite-positive)" : "var(--kite-negative)") : "var(--kite-heading)" }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: "12px", marginTop: "3px", color: accent ? (pos ? "var(--kite-positive)" : "var(--kite-negative)") : "var(--kite-muted)" }}>
              {sub}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── News Feed ─────────────────────────────────────────────────────────────────

function NewsFeed({ holdings, onOpen }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const tickers = holdings.map((h) => h.ticker);

  useEffect(() => {
    setLoading(true);
    getNews({ tickers, filter: "portfolio" })
      .then((r) => setItems(r.items.slice(0, 6)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tickers.join(",")]);

  return (
    <div>
      <SectionTitle>Top News</SectionTitle>
      {loading && <div style={{ fontSize: "12px", color: "var(--kite-muted)" }}>Loading…</div>}
      {!loading && items.length === 0 && (
        <div style={{ fontSize: "12px", color: "var(--kite-muted)" }}>No recent news for your portfolio.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        {items.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", display: "block" }}
          >
            <div
              style={{ padding: "10px 0", borderBottom: "1px solid var(--kite-border)", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.paddingLeft = "4px"; e.currentTarget.style.transition = "padding 0.1s"; }}
              onMouseLeave={(e) => { e.currentTarget.style.paddingLeft = "0"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                {article.image_url && (
                  <img
                    src={article.image_url}
                    alt=""
                    style={{ width: 52, height: 36, objectFit: "cover", borderRadius: "var(--radius-sm)", flexShrink: 0, background: "var(--kite-border)" }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--kite-heading)", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {article.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "10px", color: "var(--kite-muted)" }}>{article.source}</span>
                    <span style={{ fontSize: "10px", color: "var(--kite-border)" }}>·</span>
                    <span style={{ fontSize: "10px", color: "var(--kite-muted)" }}>{timeAgo(article.published_at)}</span>
                    {article.tickers?.slice(0, 3).map((t) => (
                      <span key={t} style={{ fontSize: "9px", fontWeight: "700", color: "var(--kite-amber-dark)", fontFamily: "var(--font-mono)" }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Upcoming Events ───────────────────────────────────────────────────────────

function UpcomingEvents({ holdings, onOpen, portfolioData }) {
  const holdingTickers = new Set(holdings.map((h) => h.ticker));
  const events = UPCOMING_EVENTS.map((e) => ({
    ...e,
    inPortfolio: holdingTickers.has(e.ticker),
  }));

  const TYPE_STYLE = {
    earnings:     { bg: "rgba(245,166,35,0.12)", color: "var(--kite-amber-dark)",  label: "Earnings"     },
    presentation: { bg: "rgba(91,141,184,0.12)", color: "#5B8DB8",                 label: "Presentation" },
    dividend:     { bg: "rgba(45,106,79,0.12)",  color: "var(--kite-positive)",    label: "Dividend"     },
  };

  return (
    <div>
      <SectionTitle>Upcoming Events</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {events.map((ev, i) => {
          const ts = TYPE_STYLE[ev.type] ?? TYPE_STYLE.presentation;
          return (
            <div
              key={i}
              onClick={() => {
                const q = portfolioData[ev.ticker];
                if (q) onOpen(q);
              }}
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", background: ev.inPortfolio ? "var(--kite-amber-wash)" : "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "background 0.12s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--kite-cream)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ev.inPortfolio ? "var(--kite-amber-wash)" : "var(--kite-surface)"; }}
            >
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--kite-muted)", fontFamily: "var(--font-mono)", minWidth: 42, flexShrink: 0 }}>{ev.date}</div>
              <CompanyLogo ticker={ev.ticker} size={20} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--kite-heading)", fontFamily: "var(--font-mono)" }}>{ev.ticker}</div>
                <div style={{ fontSize: "11px", color: "var(--kite-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.event}</div>
              </div>
              <div style={{ fontSize: "9px", fontWeight: "700", padding: "2px 7px", borderRadius: "4px", background: ts.bg, color: ts.color, flexShrink: 0 }}>
                {ts.label}
              </div>
              {ev.inPortfolio && (
                <div style={{ fontSize: "9px", fontWeight: "700", color: "var(--kite-amber-dark)", flexShrink: 0 }}>★</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "8px", fontSize: "10px", color: "var(--kite-muted)", fontStyle: "italic" }}>
        ★ = in your portfolio
      </div>
    </div>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────

function Alerts({ holdings, portfolioData, onOpen }) {
  const alerts = [];
  for (const h of holdings) {
    const q = portfolioData[h.ticker];
    if (!q) continue;
    if (q.week_52_high && q.price && q.price >= q.week_52_high * 0.97) {
      alerts.push({ ticker: h.ticker, q, msg: `Near 52-week high ($${q.week_52_high?.toFixed(2)})`, color: "var(--kite-positive)", icon: "▲" });
    } else if (q.week_52_low && q.price && q.price <= q.week_52_low * 1.05) {
      alerts.push({ ticker: h.ticker, q, msg: `Near 52-week low ($${q.week_52_low?.toFixed(2)})`, color: "var(--kite-negative)", icon: "▼" });
    } else if (q.change_pct && Math.abs(q.change_pct) >= 3) {
      alerts.push({ ticker: h.ticker, q, msg: `${q.change_pct >= 0 ? "+" : ""}${q.change_pct?.toFixed(2)}% today`, color: q.change_pct >= 0 ? "var(--kite-positive)" : "var(--kite-negative)", icon: q.change_pct >= 0 ? "↑" : "↓" });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <Card style={{ padding: "14px 16px" }}>
      <SectionTitle>Alerts</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {alerts.slice(0, 4).map((a, i) => (
          <div
            key={i}
            onClick={() => onOpen(a.q)}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "4px 0" }}
          >
            <span style={{ fontSize: "12px", color: a.color, fontWeight: "700", width: 14, textAlign: "center" }}>{a.icon}</span>
            <CompanyLogo ticker={a.ticker} size={20} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "700", color: "var(--kite-amber-dark)", width: 48 }}>{a.ticker}</span>
            <span style={{ fontSize: "12px", color: "var(--kite-heading)" }}>{a.msg}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { holdings, replaceHoldings }                                          = useHoldings();
  const { watchlist, addToWatchlist, removeFromWatchlist, reorderWatchlist }   = useWatchlist();
  const [portfolioData,  setPortfolioData]  = useState({});
  const [drawerStock,    setDrawerStock]    = useState(null);
  const [showEditModal,  setShowEditModal]  = useState(false);

  const holdingTickers   = holdings.map((h) => h.ticker);
  const watchlistTickers = watchlist.map((w) => w.ticker).filter((t) => !holdingTickers.includes(t));
  const allTickers       = [...new Set([...holdingTickers, ...watchlistTickers])];

  useEffect(() => {
    if (!allTickers.length) return;
    getQuotes(allTickers).then((stocks) => {
      setPortfolioData((prev) => {
        const next = { ...prev };
        stocks.forEach((s) => { next[s.ticker] = s; });
        return next;
      });
    });
  }, [allTickers.join(",")]);

  function openDrawer(stock) {
    setDrawerStock(stock);
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "var(--kite-cream)" }}>

      {/* ── Main scroll area ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* AI Brief */}
        <AIBrief />

        {/* Portfolio snapshot */}
        <SnapshotRow holdings={holdings} portfolioData={portfolioData} onEditPortfolio={() => setShowEditModal(true)} />

        {/* Alerts (only shown when there's something worth flagging) */}
        <Alerts holdings={holdings} portfolioData={portfolioData} onOpen={openDrawer} />

        {/* Two-column: News | Events */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px", alignItems: "start" }}>
          <Card style={{ padding: "18px 20px" }}>
            <NewsFeed holdings={holdings} onOpen={openDrawer} />
          </Card>
          <Card style={{ padding: "18px 16px" }}>
            <UpcomingEvents holdings={holdings} onOpen={openDrawer} portfolioData={portfolioData} />
          </Card>
        </div>

        {/* Edit link */}
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: "8px" }}>
          <button
            onClick={() => setShowEditModal(true)}
            style={{ fontSize: "12px", color: "var(--kite-muted)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--kite-amber-dark)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--kite-muted)"; }}
          >
            Edit portfolio holdings
          </button>
        </div>
      </div>

      {/* ── Watchlist panel (right) ── */}
      <WatchlistPanel
        watchlist={watchlist}
        portfolioData={portfolioData}
        onSelect={openDrawer}
        onAdd={addToWatchlist}
        onRemove={removeFromWatchlist}
        onReorder={reorderWatchlist}
      />

      {/* ── Company drawer ── */}
      <CompanyDrawer
        stock={drawerStock}
        onClose={() => setDrawerStock(null)}
        portfolioData={portfolioData}
      />

      <ChatWidget tickers={holdingTickers.length ? holdingTickers : ["AAPL", "MSFT", "NVDA"]} />

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
