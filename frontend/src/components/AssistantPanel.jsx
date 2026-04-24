/**
 * AssistantPanel.jsx — "Ask Kite" AI Assistant
 *
 * Collapsible right-side panel. Persists across all pages.
 * Parses assistant responses for ticker mentions and navigation cues,
 * then surfaces them as clickable action chips.
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { queryKite, getQuotes } from "../api/client";
import SourcePill from "./SourcePill";
import CompanyLogo from "./CompanyLogo";

// ── Suggested starter prompts ─────────────────────────────────────────────────

const SUGGESTIONS = [
  "What are the biggest risks in my portfolio right now?",
  "Which of my holdings has the strongest revenue growth?",
  "Summarise Apple's latest 10-K",
  "Compare NVDA and AMD on valuation",
  "What sectors am I most exposed to?",
];

// ── Action detection ──────────────────────────────────────────────────────────

const NAV_ACTIONS = [
  { pattern: /\bmarket\b|\bmovers?\b|\bindex\b|\bsector\b/i,    label: "Open Market",     to: "/market"     },
  { pattern: /\bscreener?\b|\bfilter\b|\bscreen\b/i,            label: "Open Screener",   to: "/screener"   },
  { pattern: /\bwatchlist\b/i,                                   label: "Open Watchlist",  to: "/watchlist"  },
  { pattern: /\bportfolio\b|\bholdings?\b/i,                    label: "Open Portfolios", to: "/portfolios" },
  { pattern: /\bnews\b|\bheadlines?\b/i,                        label: "Open News",       to: "/news"       },
];

const TICKER_RE = /\b([A-Z]{1,5})\b/g;

// Tickers worth treating as actionable (common large-caps + user's holdings passed in)
const COMMON_TICKERS = new Set([
  "AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","AMD","JPM","V","UNH",
  "LLY","XOM","GS","BA","WMT","ORCL","AVGO","CSCO","COP","CVX","HD","PG",
  "MRK","DHR","ISRG","GE","HON","LMT","RTX","DE","TMUS","SPY","QQQ","DIA","IWM",
]);

function detectActions(text, portfolioTickers = []) {
  const knownTickers = new Set([...COMMON_TICKERS, ...portfolioTickers.map((t) => t.toUpperCase())]);
  const foundTickers = new Set();
  for (const [, t] of text.matchAll(TICKER_RE)) {
    if (knownTickers.has(t)) foundTickers.add(t);
  }

  const navActions = NAV_ACTIONS
    .filter((a) => a.pattern.test(text))
    .slice(0, 2);

  return { tickers: [...foundTickers].slice(0, 4), navActions };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UserBubble({ text }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        maxWidth: "82%",
        background: "var(--kite-amber-wash)",
        border: "1px solid var(--kite-border)",
        borderRadius: "14px 14px 4px 14px",
        padding: "9px 13px",
        fontSize: "13px",
        color: "var(--kite-heading)",
        lineHeight: "1.5",
      }}>
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text, sources, sourced, actions, onOpenTicker, onNavigate }) {
  const { tickers, navActions } = actions;
  const hasActions = tickers.length > 0 || navActions.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <img src="/kite-icon.svg" alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />
        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--kite-amber-dark)", fontFamily: "var(--font-display)" }}>
          Kite
        </span>
        {sourced && (
          <span style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.06em", background: "var(--kite-amber-wash)", color: "var(--kite-amber-dark)", border: "1px solid var(--kite-border)", borderRadius: "4px", padding: "1px 5px" }}>
            SOURCED
          </span>
        )}
      </div>

      {/* Text */}
      <div style={{ fontSize: "13px", color: "var(--kite-heading)", lineHeight: "1.65", whiteSpace: "pre-wrap" }}>
        {text}
      </div>

      {/* Source pills */}
      {sourced && sources?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {sources.map((src, i) => (
            <SourcePill key={i} label={src.label} url={src.source_url} timestamp={src.timestamp} publishedAt={src.published_at} />
          ))}
        </div>
      )}

      {/* Action chips */}
      {hasActions && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
          {tickers.map((t) => (
            <button
              key={t}
              onClick={() => onOpenTicker(t)}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "20px", cursor: "pointer", fontSize: "11px", fontWeight: "700", color: "var(--kite-amber-dark)", fontFamily: "var(--font-mono)", transition: "all 0.12s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--kite-amber-wash)"; e.currentTarget.style.borderColor = "var(--kite-amber-dark)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--kite-surface)"; e.currentTarget.style.borderColor = "var(--kite-border)"; }}
            >
              <CompanyLogo ticker={t} size={14} />
              {t} ↗
            </button>
          ))}
          {navActions.map((a) => (
            <button
              key={a.to}
              onClick={() => onNavigate(a.to)}
              style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "20px", cursor: "pointer", fontSize: "11px", color: "var(--kite-muted)", transition: "all 0.12s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--kite-cream)"; e.currentTarget.style.color = "var(--kite-heading)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--kite-surface)"; e.currentTarget.style.color = "var(--kite-muted)"; }}
            >
              {a.label} →
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function AssistantPanel({ open, onClose, portfolioTickers = [], onOpenStock }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const navigate   = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await queryKite(q, portfolioTickers);
      const actions = detectActions(res.answer, portfolioTickers);
      setMessages((prev) => [...prev, {
        role: "kite",
        text: res.answer,
        sources: res.sources,
        sourced: res.sourced,
        actions,
      }]);
    } catch (err) {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenTicker(ticker) {
    try {
      const [stock] = await getQuotes([ticker]);
      onOpenStock?.(stock ?? { ticker, name: ticker, price: 0, change_pct: 0 });
    } catch {
      onOpenStock?.({ ticker, name: ticker, price: 0, change_pct: 0 });
    }
  }

  function handleNavigate(to) {
    navigate(to);
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Backdrop (subtle, only on mobile or narrow) */}
      {open && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 119, background: "transparent", pointerEvents: "none" }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: "fixed",
        top: "52px",           // below nav
        right: 0,
        bottom: 0,
        width: 380,
        background: "var(--kite-surface)",
        borderLeft: "1px solid var(--kite-border)",
        boxShadow: open ? "-6px 0 32px rgba(61,46,15,0.10)" : "none",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        zIndex: 120,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--kite-border)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, background: "var(--kite-surface)" }}>
          <img src="/kite-icon.svg" alt="" style={{ width: 24, height: 24, borderRadius: 5 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--kite-heading)" }}>Ask Kite</div>
            <div style={{ fontSize: "10px", color: "var(--kite-muted)", marginTop: "1px" }}>AI assistant · portfolio-aware</div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              style={{ fontSize: "11px", color: "var(--kite-muted)", background: "none", border: "none", cursor: "pointer", padding: "3px 6px" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--kite-heading)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--kite-muted)"; }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: "none", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--kite-muted)", fontSize: "14px", lineHeight: 1, padding: "4px 8px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--kite-heading)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--kite-muted)"; }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {isEmpty && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <div style={{ fontSize: "13px", color: "var(--kite-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                  Ask me anything about your portfolio, a company's financials, or the market. I can also take you to the right screen.
                </div>
                <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", marginBottom: "8px" }}>
                  Try asking
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{ textAlign: "left", padding: "9px 12px", background: "var(--kite-cream)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "12px", color: "var(--kite-heading)", lineHeight: 1.4, transition: "all 0.12s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--kite-amber-dark)"; e.currentTarget.style.color = "var(--kite-amber-dark)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--kite-border)"; e.currentTarget.style.color = "var(--kite-heading)"; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user"
                ? <UserBubble text={msg.text} />
                : <AssistantBubble
                    text={msg.text}
                    sources={msg.sources}
                    sourced={msg.sourced}
                    actions={msg.actions ?? { tickers: [], navActions: [] }}
                    onOpenTicker={handleOpenTicker}
                    onNavigate={handleNavigate}
                  />
              }
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="/kite-icon.svg" alt="" style={{ width: 18, height: 18, borderRadius: 4, opacity: 0.7 }} />
              <span style={{ fontSize: "12px", color: "var(--kite-muted)", fontStyle: "italic" }}>Thinking…</span>
            </div>
          )}

          {error && (
            <div style={{ fontSize: "12px", color: "var(--kite-negative)", padding: "8px 12px", background: "rgba(181,64,64,0.06)", border: "1px solid rgba(181,64,64,0.2)", borderRadius: "var(--radius-sm)" }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--kite-border)", flexShrink: 0, background: "var(--kite-surface)" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your portfolio…"
              rows={2}
              style={{ flex: 1, resize: "none", padding: "9px 11px", fontSize: "13px", fontFamily: "var(--font-body)", color: "var(--kite-heading)", background: "var(--kite-cream)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", outline: "none", lineHeight: 1.5 }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{ padding: "0 16px", height: "58px", background: input.trim() && !loading ? "var(--kite-amber-dark)" : "var(--kite-border)", color: input.trim() && !loading ? "#fff" : "var(--kite-muted)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "13px", fontWeight: "600", cursor: input.trim() && !loading ? "pointer" : "not-allowed", transition: "background 0.15s", flexShrink: 0 }}
            >
              Send
            </button>
          </div>
          <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--kite-muted)" }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </>
  );
}
