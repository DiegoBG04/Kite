/**
 * PortfolioEditModal.jsx — Edit portfolio holdings
 *
 * Opens as an overlay modal. Shows a table of current holdings with
 * editable Quantity, Cost/Share, and Purchase Date fields.
 * Changes are only committed to state when "Save Portfolio" is clicked.
 */

import { useState, useEffect } from "react";
import TickerSearch from "./TickerSearch";

const COL = {
  ticker:   { label: "Ticker",          width: "180px" },
  qty:      { label: "Quantity",         width: "120px" },
  cost:     { label: "Cost / Share",     width: "140px" },
  date:     { label: "Purchase Date",    width: "160px" },
  remove:   { label: "",                 width: "40px"  },
};

function FieldInput({ value, onChange, type = "text", placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "6px 10px",
        fontSize: "13px",
        fontFamily: "var(--font-body)",
        color: "var(--kite-heading)",
        background: "var(--kite-cream)",
        border: "1px solid var(--kite-border)",
        borderRadius: "var(--radius-sm)",
        outline: "none",
        boxSizing: "border-box",
      }}
      onFocus={(e) => { e.target.style.borderColor = "var(--kite-amber-dark)"; }}
      onBlur={(e)  => { e.target.style.borderColor = "var(--kite-border)"; }}
    />
  );
}

export default function PortfolioEditModal({ holdings, portfolioData, onSave, onClose }) {
  // Local draft — editable copy of holdings while modal is open
  const [rows, setRows] = useState(() =>
    holdings.map((h) => ({
      ticker:       h.ticker,
      name:         portfolioData[h.ticker]?.name ?? "",
      shares:       String(h.shares ?? ""),
      costBasis:    String(h.costBasis ?? ""),
      purchaseDate: h.purchaseDate ?? "",
    }))
  );
  const [addingTicker, setAddingTicker] = useState(false);

  // Keep names fresh if portfolioData loads after modal opens
  useEffect(() => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        name: portfolioData[r.ticker]?.name ?? r.name,
      }))
    );
  }, [portfolioData]);

  function updateRow(idx, field, value) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function removeRow(idx) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddTicker(symbol, name) {
    // Don't add duplicates
    if (rows.find((r) => r.ticker === symbol)) {
      setAddingTicker(false);
      return;
    }
    setRows((prev) => [...prev, { ticker: symbol, name, shares: "", costBasis: "", purchaseDate: "" }]);
    setAddingTicker(false);
  }

  function handleSave() {
    const cleaned = rows
      .filter((r) => r.ticker && r.shares)
      .map((r) => ({
        ticker:       r.ticker,
        shares:       Number(r.shares) || 0,
        costBasis:    Number(r.costBasis) || 0,
        purchaseDate: r.purchaseDate || "",
      }));
    onSave(cleaned);
    onClose();
  }

  return (
    // Overlay
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30, 20, 5, 0.45)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* Modal */}
      <div style={{
        background: "var(--kite-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--kite-border)",
        boxShadow: "0 20px 60px rgba(30,20,5,0.2)",
        width: "100%",
        maxWidth: "760px",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "18px 24px",
          borderBottom: "1px solid var(--kite-border)",
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--kite-heading)", fontFamily: "var(--font-display)" }}>
              Edit Portfolio
            </div>
            <div style={{ fontSize: "12px", color: "var(--kite-muted)", marginTop: "2px" }}>
              Changes are saved when you click Save Portfolio
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--kite-muted)", padding: "4px 8px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Table area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Column headers */}
          {rows.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `${COL.ticker.width} ${COL.qty.width} ${COL.cost.width} ${COL.date.width} ${COL.remove.width}`, gap: "8px", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid var(--kite-border)" }}>
              {Object.values(COL).map((c, i) => (
                <div key={i} style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)" }}>
                  {c.label}
                </div>
              ))}
            </div>
          )}

          {/* Rows */}
          {rows.map((row, idx) => (
            <div
              key={`${row.ticker}-${idx}`}
              style={{ display: "grid", gridTemplateColumns: `${COL.ticker.width} ${COL.qty.width} ${COL.cost.width} ${COL.date.width} ${COL.remove.width}`, gap: "8px", alignItems: "center", marginBottom: "10px" }}
            >
              {/* Ticker */}
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: "700", color: "var(--kite-amber-dark)", letterSpacing: "0.04em" }}>
                  {row.ticker}
                </div>
                <div style={{ fontSize: "11px", color: "var(--kite-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.name || "—"}
                </div>
              </div>

              {/* Quantity */}
              <FieldInput
                type="number"
                value={row.shares}
                onChange={(v) => updateRow(idx, "shares", v)}
                placeholder="0"
              />

              {/* Cost / Share */}
              <FieldInput
                type="number"
                value={row.costBasis}
                onChange={(v) => updateRow(idx, "costBasis", v)}
                placeholder="0.00"
              />

              {/* Purchase Date */}
              <FieldInput
                type="date"
                value={row.purchaseDate}
                onChange={(v) => updateRow(idx, "purchaseDate", v)}
              />

              {/* Remove */}
              <button
                onClick={() => removeRow(idx)}
                style={{
                  background: "none",
                  border: "1px solid var(--kite-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--kite-negative)",
                  fontSize: "16px",
                  cursor: "pointer",
                  padding: "4px 8px",
                  lineHeight: 1,
                  width: "32px",
                  textAlign: "center",
                }}
              >
                ×
              </button>
            </div>
          ))}

          {/* Empty state */}
          {rows.length === 0 && !addingTicker && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--kite-muted)", fontSize: "13px" }}>
              No holdings yet. Add a ticker below.
            </div>
          )}

          {/* Add Ticker row */}
          {addingTicker ? (
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <TickerSearch
                  onSelect={handleAddTicker}
                  placeholder="Search ticker or company…"
                  autoFocus
                />
              </div>
              <button
                onClick={() => setAddingTicker(false)}
                style={{ padding: "7px 12px", background: "none", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--kite-muted)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingTicker(true)}
              style={{
                marginTop: "8px",
                padding: "8px 14px",
                background: "none",
                border: "1px dashed var(--kite-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                color: "var(--kite-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--kite-amber-dark)"; e.currentTarget.style.color = "var(--kite-amber-dark)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--kite-border)"; e.currentTarget.style.color = "var(--kite-muted)"; }}
            >
              + Add Ticker
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          padding: "16px 24px",
          borderTop: "1px solid var(--kite-border)",
          flexShrink: 0,
          background: "var(--kite-cream)",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              background: "none",
              border: "1px solid var(--kite-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              color: "var(--kite-muted)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 20px",
              background: "var(--kite-amber-dark)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              fontWeight: "600",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            Save Portfolio
          </button>
        </div>
      </div>
    </div>
  );
}
