/**
 * TickerSearch.jsx — Reusable ticker search input with dropdown
 *
 * Uses position:fixed for the dropdown so it always renders above every
 * parent container regardless of overflow:hidden or z-index stacking.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { searchSymbols } from "../api/client";

export default function TickerSearch({ onSelect, placeholder = "Search ticker or company…", autoFocus = false, inputStyle = {} }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [active,  setActive]  = useState(-1);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0, upward: false });

  const rootRef  = useRef(null);
  const timerRef = useRef(null);

  // Position the fixed dropdown — flips upward when near the bottom of the viewport
  const updatePos = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const dropHeight = Math.min(320, 52 * 8 + 16); // max dropdown height
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUpward = spaceBelow < dropHeight && rect.top > dropHeight;
    setDropPos({
      top:    openUpward ? rect.top - dropHeight - 4 : rect.bottom + 4,
      left:   rect.left,
      width:  Math.max(rect.width, 300),
      upward: openUpward,
    });
  }, []);

  useEffect(() => {
    if (autoFocus) rootRef.current?.querySelector("input")?.focus();
  }, [autoFocus]);

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.trim().length < 1) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchSymbols(query);
        setResults(data);
        if (data.length > 0) { updatePos(); setOpen(true); }
        else setOpen(false);
        setActive(-1);
      } catch {
        setResults([]); setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reposition if window scrolls/resizes while open
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  function pick(item) {
    onSelect(item.symbol, item.name);
    setQuery(""); setResults([]); setOpen(false); setActive(-1);
  }

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); pick(results[active >= 0 ? active : 0]); }
    else if (e.key === "Escape")    { setOpen(false); }
  }

  const baseInput = {
    width: "100%",
    padding: "7px 10px",
    fontSize: "13px",
    fontFamily: "var(--font-body)",
    color: "var(--kite-body)",
    background: "var(--kite-cream)",
    border: "1px solid var(--kite-border)",
    borderRadius: "var(--radius-sm)",
    outline: "none",
    boxSizing: "border-box",
    ...inputStyle,
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { updatePos(); results.length > 0 && setOpen(true); }}
        placeholder={placeholder}
        style={baseInput}
        autoComplete="off"
        spellCheck={false}
      />

      {loading && (
        <div style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", color: "var(--kite-muted)" }}>
          ···
        </div>
      )}

      {/* Fixed-position dropdown — renders above all parent containers */}
      {open && (
        <div
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            background: "var(--kite-surface)",
            border: "1px solid var(--kite-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: dropPos.upward
              ? "0 -8px 24px rgba(61,46,15,0.15)"
              : "0 8px 24px rgba(61,46,15,0.15)",
            zIndex: 9999,
            overflow: "hidden",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {results.map((item, i) => (
            <div
              key={`${item.symbol}-${i}`}
              onMouseDown={() => pick(item)}
              onMouseEnter={() => setActive(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                background: active === i ? "var(--kite-amber-wash)" : "transparent",
                cursor: "pointer",
                borderBottom: i < results.length - 1 ? "1px solid var(--kite-border)" : "none",
              }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "700", color: "var(--kite-amber-dark)", letterSpacing: "0.04em", minWidth: "56px" }}>
                {item.symbol}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", color: "var(--kite-heading)", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
                <div style={{ fontSize: "10px", color: "var(--kite-muted)", marginTop: "1px" }}>
                  {item.exchange}{item.type ? ` · ${item.type}` : ""}
                </div>
              </div>
              {item.country && (
                <div style={{ fontSize: "10px", color: "var(--kite-muted)", flexShrink: 0 }}>{item.country}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
