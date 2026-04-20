/**
 * WatchlistPanel.jsx — Koyfin-style Watchlist
 *
 * Right panel showing: ticker, company name, last price, 1D %
 * + Add Security button at the bottom.
 * Edit mode: drag-to-reorder and delete per row.
 */

import { useState, useRef } from "react";
import TickerSearch from "./TickerSearch";

export default function WatchlistPanel({ watchlist, portfolioData, onSelect, onAdd, onRemove, onReorder }) {
  const [adding,   setAdding]   = useState(false);
  const [editing,  setEditing]  = useState(false);
  const dragFrom   = useRef(null);
  const dragOver   = useRef(null);

  function handleSelect(symbol) {
    onAdd(symbol);
    setAdding(false);
  }

  function handleDragStart(index) {
    dragFrom.current = index;
  }

  function handleDragEnter(index) {
    dragOver.current = index;
  }

  function handleDragEnd() {
    if (dragFrom.current !== null && dragOver.current !== null && dragFrom.current !== dragOver.current) {
      onReorder(dragFrom.current, dragOver.current);
    }
    dragFrom.current = null;
    dragOver.current = null;
  }

  return (
    <div style={{
      width: "220px",
      minWidth: "220px",
      display: "flex",
      flexDirection: "column",
      borderLeft: "1px solid var(--kite-border)",
      background: "var(--kite-surface)",
      height: "100%",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 14px 10px",
        borderBottom: "1px solid var(--kite-border)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
          <div style={{
            flex: 1,
            fontSize: "12px",
            fontWeight: "700",
            color: "var(--kite-heading)",
            fontFamily: "var(--font-display)",
          }}>
            My Watchlist
          </div>
          <button
            onClick={() => { setEditing((e) => !e); setAdding(false); }}
            title={editing ? "Done editing" : "Edit watchlist"}
            style={{
              background: editing ? "var(--kite-amber-wash)" : "none",
              border: editing ? "1px solid var(--kite-border)" : "1px solid transparent",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: "11px",
              color: editing ? "var(--kite-amber-dark)" : "var(--kite-muted)",
              fontWeight: editing ? "700" : "400",
              padding: "2px 7px",
              lineHeight: 1.4,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { if (!editing) { e.currentTarget.style.color = "var(--kite-amber-dark)"; e.currentTarget.style.borderColor = "var(--kite-border)"; } }}
            onMouseLeave={(e) => { if (!editing) { e.currentTarget.style.color = "var(--kite-muted)"; e.currentTarget.style.borderColor = "transparent"; } }}
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>

        {/* Column labels */}
        {!editing && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)" }}>
              Security
            </span>
            <div style={{ display: "flex", gap: "16px" }}>
              <span style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", minWidth: "44px", textAlign: "right" }}>
                Last
              </span>
              <span style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", minWidth: "40px", textAlign: "right" }}>
                1D %
              </span>
            </div>
          </div>
        )}
        {editing && (
          <div style={{ fontSize: "9px", color: "var(--kite-muted)", letterSpacing: "0.04em" }}>
            Drag to reorder · × to remove
          </div>
        )}
      </div>

      {/* Watchlist rows */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {watchlist.length === 0 && !adding && (
          <div style={{ padding: "20px 14px", fontSize: "12px", color: "var(--kite-muted)", textAlign: "center", lineHeight: 1.5 }}>
            Add securities to track them here
          </div>
        )}

        {watchlist.map((w, index) => {
          const stock = portfolioData[w.ticker];
          const price = stock?.price;
          const chg   = stock?.change_pct;
          const isPos = (chg ?? 0) >= 0;

          if (editing) {
            return (
              <div
                key={w.ticker}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "7px 10px 7px 8px",
                  borderBottom: "1px solid var(--kite-border)",
                  gap: "6px",
                  cursor: "grab",
                  background: "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--kite-cream)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Drag handle */}
                <span style={{ color: "var(--kite-border)", fontSize: "13px", lineHeight: 1, flexShrink: 0, userSelect: "none" }}>⠿</span>

                {/* Ticker */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "700", color: "var(--kite-amber-dark)", letterSpacing: "0.04em" }}>
                    {w.ticker}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--kite-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {stock?.name ?? "—"}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => onRemove(w.ticker)}
                  style={{
                    background: "none",
                    border: "1px solid transparent",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    color: "var(--kite-muted)",
                    fontSize: "14px",
                    lineHeight: 1,
                    padding: "2px 5px",
                    flexShrink: 0,
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--kite-negative)"; e.currentTarget.style.borderColor = "var(--kite-border)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--kite-muted)"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  ×
                </button>
              </div>
            );
          }

          return (
            <div
              key={w.ticker}
              onClick={() => stock && onSelect(stock)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 14px",
                cursor: stock ? "pointer" : "default",
                borderBottom: "1px solid var(--kite-border)",
                transition: "background 0.12s",
                gap: "6px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--kite-cream)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {/* Ticker + name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "700", color: "var(--kite-amber-dark)", letterSpacing: "0.04em" }}>
                  {w.ticker}
                </div>
                <div style={{ fontSize: "10px", color: "var(--kite-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {stock?.name ?? "—"}
                </div>
              </div>

              {/* Price + change */}
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "12px", color: "var(--kite-heading)", fontVariantNumeric: "tabular-nums", minWidth: "44px", textAlign: "right" }}>
                  {price != null ? `$${price.toFixed(2)}` : "—"}
                </span>
                <span style={{ fontSize: "11px", color: isPos ? "var(--kite-positive)" : "var(--kite-negative)", fontVariantNumeric: "tabular-nums", minWidth: "40px", textAlign: "right" }}>
                  {chg != null ? `${isPos ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add security */}
      {!editing && (
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--kite-border)" }}>
          {adding ? (
            <div style={{ padding: "10px 14px" }}>
              <TickerSearch
                onSelect={handleSelect}
                placeholder="Search ticker or company…"
                autoFocus
                inputStyle={{ fontSize: "12px", padding: "6px 10px" }}
              />
              <button
                onClick={() => setAdding(false)}
                style={{ marginTop: "6px", background: "none", border: "none", fontSize: "11px", color: "var(--kite-muted)", cursor: "pointer", padding: 0 }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                color: "var(--kite-amber-dark)",
                textAlign: "left",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--kite-amber-wash)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              + Add Security to Watchlist
            </button>
          )}
        </div>
      )}
    </div>
  );
}
