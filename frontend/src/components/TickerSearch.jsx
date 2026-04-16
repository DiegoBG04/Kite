/**
 * TickerSearch.jsx — Reusable ticker search input with dropdown
 *
 * Props:
 *   onSelect(symbol, name) — called when the user picks a result
 *   placeholder            — input placeholder text
 *   autoFocus              — whether to focus on mount
 *   inputStyle             — style overrides for the input element
 */

import { useState, useEffect, useRef } from "react";
import { searchSymbols } from "../api/client";

export default function TickerSearch({ onSelect, placeholder = "Search ticker or company…", autoFocus = false, inputStyle = {} }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [active,  setActive]  = useState(-1); // keyboard-highlighted index
  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const timerRef  = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchSymbols(query);
        setResults(data);
        setOpen(data.length > 0);
        setActive(-1);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (!inputRef.current?.closest(".ticker-search-root")?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function pick(item) {
    onSelect(item.symbol, item.name);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && results[active]) pick(results[active]);
      else if (results[0]) pick(results[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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
    <div className="ticker-search-root" style={{ position: "relative" }}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        style={baseInput}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "10px",
          color: "var(--kite-muted)",
        }}>
          ···
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--kite-surface)",
            border: "1px solid var(--kite-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 4px 16px rgba(61,46,15,0.12)",
            zIndex: 200,
            overflow: "hidden",
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
                padding: "9px 12px",
                background: active === i ? "var(--kite-amber-wash)" : "transparent",
                cursor: "pointer",
                borderBottom: i < results.length - 1 ? "1px solid var(--kite-border)" : "none",
              }}
            >
              {/* Ticker badge */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: "700",
                color: "var(--kite-amber-dark)",
                letterSpacing: "0.04em",
                minWidth: "52px",
              }}>
                {item.symbol}
              </div>

              {/* Name + exchange */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "12px",
                  color: "var(--kite-heading)",
                  fontWeight: "500",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {item.name}
                </div>
                <div style={{ fontSize: "10px", color: "var(--kite-muted)" }}>
                  {item.exchange}{item.type ? ` · ${item.type}` : ""}
                </div>
              </div>

              {/* Country flag proxy — just show country code */}
              {item.country && (
                <div style={{ fontSize: "10px", color: "var(--kite-muted)", flexShrink: 0 }}>
                  {item.country}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
