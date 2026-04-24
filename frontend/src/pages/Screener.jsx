/**
 * Screener.jsx — Stock Screener
 * Filter the market by fundamentals, technicals, and valuation.
 * Skeleton: UI shell with filter panel and results table. Data TBD.
 */

import { useState } from "react";
import CompanyLogo from "../components/CompanyLogo";
import CompanyDrawer from "../components/CompanyDrawer";

// ── Filter definitions ────────────────────────────────────────────────────────

const FILTER_GROUPS = [
  {
    label: "Valuation",
    filters: [
      { key: "pe_ratio",    label: "P/E Ratio",        unit: "×",  min: 0,    max: 100,  step: 1  },
      { key: "pb_ratio",    label: "P/B Ratio",        unit: "×",  min: 0,    max: 30,   step: 0.5 },
      { key: "ps_ratio",    label: "P/S Ratio",        unit: "×",  min: 0,    max: 50,   step: 0.5 },
      { key: "ev_ebitda",   label: "EV / EBITDA",      unit: "×",  min: 0,    max: 60,   step: 1  },
    ],
  },
  {
    label: "Growth",
    filters: [
      { key: "revenue_growth", label: "Revenue Growth (YoY)", unit: "%", min: -50, max: 200, step: 1 },
      { key: "eps_growth",     label: "EPS Growth (YoY)",     unit: "%", min: -50, max: 200, step: 1 },
      { key: "fcf_growth",     label: "FCF Growth (YoY)",     unit: "%", min: -50, max: 200, step: 1 },
    ],
  },
  {
    label: "Profitability",
    filters: [
      { key: "gross_margin",   label: "Gross Margin",     unit: "%", min: -20, max: 100, step: 1 },
      { key: "net_margin",     label: "Net Margin",       unit: "%", min: -50, max: 60,  step: 1 },
      { key: "roe",            label: "Return on Equity", unit: "%", min: -50, max: 100, step: 1 },
      { key: "roa",            label: "Return on Assets", unit: "%", min: -20, max: 50,  step: 1 },
    ],
  },
  {
    label: "Market & Risk",
    filters: [
      { key: "market_cap_b", label: "Market Cap",  unit: "B", min: 0,   max: 3000, step: 10  },
      { key: "beta",         label: "Beta",        unit: "×", min: 0,   max: 4,    step: 0.1 },
      { key: "dividend_yield",label:"Div. Yield",  unit: "%", min: 0,   max: 15,   step: 0.1 },
    ],
  },
  {
    label: "Technical",
    filters: [
      { key: "change_pct",      label: "1D Change",       unit: "%", min: -20, max: 20,  step: 0.5 },
      { key: "from_52w_high",   label: "From 52W High",   unit: "%", min: -80, max: 0,   step: 1   },
      { key: "from_52w_low",    label: "From 52W Low",    unit: "%", min: 0,   max: 200, step: 1   },
    ],
  },
];

const SECTORS = ["All", "Technology", "Healthcare", "Financials", "Consumer Discretionary", "Industrials", "Energy", "Communication Services", "Materials", "Utilities", "Real Estate", "Consumer Staples"];

const RESULT_COLS = [
  { key: "name",          label: "Company",         width: 200 },
  { key: "price",         label: "Price",           width: 80,  align: "right" },
  { key: "change_pct",    label: "1D %",            width: 70,  align: "right" },
  { key: "market_cap",    label: "Mkt Cap",         width: 90,  align: "right" },
  { key: "pe_ratio",      label: "P/E",             width: 60,  align: "right" },
  { key: "revenue_growth",label: "Rev Growth",      width: 85,  align: "right" },
  { key: "net_margin",    label: "Net Margin",      width: 85,  align: "right" },
  { key: "beta",          label: "Beta",            width: 55,  align: "right" },
];

// ── Filter Range Control ──────────────────────────────────────────────────────

function RangeFilter({ filter, value, onChange }) {
  const { min, max, step, unit, label } = filter;
  const [lo, hi] = value ?? [null, null];

  function handleLo(e) { onChange([e.target.value === "" ? null : Number(e.target.value), hi]); }
  function handleHi(e) { onChange([lo, e.target.value === "" ? null : Number(e.target.value)]); }

  const active = lo != null || hi != null;

  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ fontSize: "10px", fontWeight: "600", letterSpacing: "0.04em", color: active ? "var(--kite-amber-dark)" : "var(--kite-muted)", marginBottom: "5px", display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        {active && (
          <button onClick={() => onChange([null, null])} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "10px", color: "var(--kite-muted)", padding: 0, lineHeight: 1 }}>clear</button>
        )}
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          type="number"
          placeholder={`Min`}
          value={lo ?? ""}
          min={min} max={max} step={step}
          onChange={handleLo}
          style={{ width: "72px", padding: "4px 7px", fontSize: "11px", background: "var(--kite-cream)", border: `1px solid ${active ? "var(--kite-amber-dark)" : "var(--kite-border)"}`, borderRadius: "var(--radius-sm)", color: "var(--kite-heading)", outline: "none" }}
        />
        <span style={{ fontSize: "10px", color: "var(--kite-muted)" }}>–</span>
        <input
          type="number"
          placeholder={`Max`}
          value={hi ?? ""}
          min={min} max={max} step={step}
          onChange={handleHi}
          style={{ width: "72px", padding: "4px 7px", fontSize: "11px", background: "var(--kite-cream)", border: `1px solid ${active ? "var(--kite-amber-dark)" : "var(--kite-border)"}`, borderRadius: "var(--radius-sm)", color: "var(--kite-heading)", outline: "none" }}
        />
        <span style={{ fontSize: "10px", color: "var(--kite-muted)", width: 20 }}>{unit}</span>
      </div>
    </div>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────────────

function FilterPanel({ filters, onChange, sector, onSector, onReset, activeCount }) {
  return (
    <div style={{ width: 220, minWidth: 220, background: "var(--kite-surface)", borderRight: "1px solid var(--kite-border)", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--kite-border)", flexShrink: 0, display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, fontSize: "13px", fontWeight: "700", color: "var(--kite-heading)" }}>Filters</div>
        {activeCount > 0 && (
          <button
            onClick={onReset}
            style={{ fontSize: "11px", color: "var(--kite-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--kite-negative)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--kite-muted)"; }}
          >
            Reset ({activeCount})
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px" }}>
        {/* Sector */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", marginBottom: "8px" }}>Sector</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => onSector(s)}
                style={{ fontSize: "10px", fontWeight: sector === s ? "700" : "400", padding: "3px 8px", borderRadius: "20px", border: `1px solid ${sector === s ? "var(--kite-amber-dark)" : "var(--kite-border)"}`, background: sector === s ? "var(--kite-amber-wash)" : "transparent", color: sector === s ? "var(--kite-amber-dark)" : "var(--kite-muted)", cursor: "pointer", transition: "all 0.1s", whiteSpace: "nowrap" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Metric filters */}
        {FILTER_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              {group.label}
              <div style={{ flex: 1, height: "1px", background: "var(--kite-border)" }} />
            </div>
            {group.filters.map((f) => (
              <RangeFilter
                key={f.key}
                filter={f}
                value={filters[f.key]}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Results Table ─────────────────────────────────────────────────────────────

function ResultsTable({ onOpen }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "48px 32px" }}>
      {/* Placeholder icon */}
      <div style={{ fontSize: "48px", opacity: 0.15 }}>◈</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "8px" }}>
          Screener coming soon
        </div>
        <div style={{ fontSize: "13px", color: "var(--kite-muted)", maxWidth: 400, lineHeight: 1.6 }}>
          Set filters on the left to screen the market. Results will show here with real-time data — sortable by any metric.
        </div>
      </div>

      {/* Preview of what the table will look like */}
      <div style={{ marginTop: "24px", width: "100%", maxWidth: 700, background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-md)", overflow: "hidden", opacity: 0.4, pointerEvents: "none" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--kite-surface)", height: 36 }}>
              {RESULT_COLS.map((col) => (
                <th key={col.key} style={{ padding: "0 12px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--kite-muted)", textAlign: col.align || "left", whiteSpace: "nowrap", borderBottom: "1px solid var(--kite-border)" }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {["AAPL", "MSFT", "NVDA"].map((ticker, i) => (
              <tr key={ticker} style={{ borderBottom: "1px solid var(--kite-border)", height: 44, background: i % 2 === 0 ? "var(--kite-surface)" : "transparent" }}>
                <td style={{ padding: "0 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 4, background: "var(--kite-border)" }} />
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--kite-amber-dark)", fontFamily: "var(--font-mono)" }}>{ticker}</div>
                    </div>
                  </div>
                </td>
                {RESULT_COLS.slice(1).map((col) => (
                  <td key={col.key} style={{ padding: "0 12px", textAlign: col.align }}>
                    <div style={{ width: 40, height: 10, background: "var(--kite-border)", borderRadius: 4, marginLeft: "auto" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Active filter chips ───────────────────────────────────────────────────────

function ActiveChips({ filters, sector, onChange, onSector }) {
  const chips = [];
  if (sector !== "All") chips.push({ label: `Sector: ${sector}`, clear: () => onSector("All") });
  for (const [key, val] of Object.entries(filters)) {
    if (!val) continue;
    const [lo, hi] = val;
    if (lo == null && hi == null) continue;
    const def = FILTER_GROUPS.flatMap((g) => g.filters).find((f) => f.key === key);
    const label = def ? `${def.label}: ${lo ?? "—"} – ${hi ?? "—"} ${def.unit}` : key;
    chips.push({ label, clear: () => onChange(key, [null, null]) });
  }
  if (!chips.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "10px 16px", borderBottom: "1px solid var(--kite-border)", background: "var(--kite-surface)", flexShrink: 0 }}>
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={c.clear}
          style={{ fontSize: "11px", padding: "3px 8px", background: "var(--kite-amber-wash)", border: "1px solid var(--kite-border)", borderRadius: "20px", color: "var(--kite-amber-dark)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
        >
          {c.label} <span style={{ opacity: 0.6 }}>×</span>
        </button>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Screener() {
  const [filters, setFilters] = useState({});
  const [sector,  setSector]  = useState("All");
  const [drawer,  setDrawer]  = useState(null);

  function handleFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetAll() {
    setFilters({});
    setSector("All");
  }

  const activeCount = Object.values(filters).filter((v) => v && (v[0] != null || v[1] != null)).length + (sector !== "All" ? 1 : 0);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "var(--kite-cream)" }}>

      {/* Filter panel */}
      <FilterPanel
        filters={filters}
        onChange={handleFilter}
        sector={sector}
        onSector={setSector}
        onReset={resetAll}
        activeCount={activeCount}
      />

      {/* Results area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--kite-border)", background: "var(--kite-surface)", flexShrink: 0, display: "flex", alignItems: "center", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--kite-heading)" }}>Screener</div>
            <div style={{ fontSize: "11px", color: "var(--kite-muted)", marginTop: "1px" }}>Filter {activeCount > 0 ? `with ${activeCount} active filter${activeCount > 1 ? "s" : ""}` : "the full market universe"}</div>
          </div>
        </div>

        {/* Active filter chips */}
        <ActiveChips filters={filters} sector={sector} onChange={handleFilter} onSector={setSector} />

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ResultsTable onOpen={setDrawer} />
        </div>
      </div>

      {drawer && (
        <CompanyDrawer
          stock={drawer}
          onClose={() => setDrawer(null)}
          portfolioData={{}}
        />
      )}
    </div>
  );
}
