/**
 * PortfolioTable.jsx — Fiscal.ai-style Portfolio Holdings Table
 *
 * Columns: Company · Shares · Avg Cost · Market Value · Day P&L · Total P&L · % Portfolio · P/E
 * Clicking a row opens the CompanyDrawer.
 */

import CompanyLogo from "./CompanyLogo";

function fmt(v, { prefix = "$", decimals = 2, fallback = "—" } = {}) {
  if (v == null || isNaN(v)) return fallback;
  return `${prefix}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtCap(v) {
  if (v == null || isNaN(v)) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

function PnL({ value, pct, showPct = true }) {
  if (value == null) return <span style={{ color: "var(--kite-muted)" }}>—</span>;
  const pos = value >= 0;
  const color = pos ? "var(--kite-positive)" : "var(--kite-negative)";
  return (
    <span style={{ color, fontVariantNumeric: "tabular-nums" }}>
      {pos ? "+" : "−"}${Math.abs(value).toFixed(2)}
      {showPct && pct != null && (
        <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.8 }}>
          ({pos ? "+" : ""}{pct.toFixed(2)}%)
        </span>
      )}
    </span>
  );
}

const TH = ({ children, right }) => (
  <th style={{
    padding: "8px 12px",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--kite-muted)",
    textAlign: right ? "right" : "left",
    borderBottom: "1px solid var(--kite-border)",
    whiteSpace: "nowrap",
    background: "var(--kite-surface)",
    position: "sticky",
    top: 0,
  }}>
    {children}
  </th>
);

const TD = ({ children, right, mono }) => (
  <td style={{
    padding: "12px 12px",
    fontSize: "13px",
    color: "var(--kite-body)",
    textAlign: right ? "right" : "left",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--kite-border)",
  }}>
    {children}
  </td>
);

export default function PortfolioTable({ holdings, portfolioData, onSelectStock, selectedTicker, onEditPortfolio }) {
  if (holdings.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" }}>
        <div style={{ fontSize: "32px", opacity: 0.15 }}>◈</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--kite-heading)", opacity: 0.5 }}>
          No holdings yet
        </div>
        <div style={{ fontSize: "12px", color: "var(--kite-muted)", opacity: 0.7, marginBottom: "8px" }}>
          Track P&L · View financials · Ask Kite anything
        </div>
        <button
          onClick={onEditPortfolio}
          style={{
            padding: "9px 20px",
            background: "var(--kite-amber-dark)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontSize: "13px",
            fontWeight: "600",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          + Add Holdings
        </button>
      </div>
    );
  }

  // Portfolio totals
  const rows = holdings.map((h) => {
    const stock       = portfolioData[h.ticker];
    const price       = stock?.price ?? null;
    const changePct   = stock?.change_pct ?? null;
    const marketValue = price != null ? h.shares * price : null;
    const dayGain     = price != null && changePct != null ? h.shares * price * (changePct / 100) : null;
    const totalGain   = marketValue != null && h.costBasis ? marketValue - h.shares * h.costBasis : null;
    const totalGainPct = totalGain != null && h.costBasis ? (totalGain / (h.shares * h.costBasis)) * 100 : null;
    return { ...h, stock, price, changePct, marketValue, dayGain, totalGain, totalGainPct };
  });

  const totalPortfolioValue = rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  const totalDayGain        = rows.reduce((s, r) => s + (r.dayGain ?? 0), 0);
  const totalGainAll        = rows.every((r) => r.totalGain != null)
    ? rows.reduce((s, r) => s + r.totalGain, 0) : null;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "24px 24px 80px" }}>

      {/* Portfolio summary header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", marginBottom: "2px" }}>
                Portfolio Value
              </div>
              <div style={{ fontSize: "26px", fontWeight: "500", color: "var(--kite-heading)", fontFamily: "var(--font-display)" }}>
                {fmt(totalPortfolioValue)}
              </div>
            </div>
            <div style={{ paddingBottom: "2px" }}>
              <PnL value={totalDayGain} showPct={false} />
              <span style={{ fontSize: "11px", color: "var(--kite-muted)", marginLeft: "4px" }}>today</span>
            </div>
            {totalGainAll != null && (
              <div style={{ paddingBottom: "2px" }}>
                <PnL value={totalGainAll} showPct={false} />
                <span style={{ fontSize: "11px", color: "var(--kite-muted)", marginLeft: "4px" }}>total</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onEditPortfolio}
          style={{
            padding: "7px 14px",
            background: "none",
            border: "1px solid var(--kite-border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            fontWeight: "500",
            color: "var(--kite-body)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--kite-amber-dark)"; e.currentTarget.style.color = "var(--kite-amber-dark)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--kite-border)"; e.currentTarget.style.color = "var(--kite-body)"; }}
        >
          ✎ Edit Portfolio
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--kite-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <TH>Company</TH>
              <TH right>Price</TH>
              <TH right>Shares</TH>
              <TH right>Avg Cost</TH>
              <TH right>Market Value</TH>
              <TH right>Day Chg</TH>
              <TH right>Total P&L</TH>
              <TH right>% Portfolio</TH>
              <TH right>Mkt Cap</TH>
              <TH right>P/E</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isSelected  = selectedTicker === r.ticker;
              const portPct     = totalPortfolioValue > 0 && r.marketValue != null
                ? (r.marketValue / totalPortfolioValue) * 100 : null;

              return (
                <tr
                  key={r.ticker}
                  onClick={() => r.stock && onSelectStock(r.stock)}
                  style={{
                    background: isSelected ? "var(--kite-amber-wash)" : "transparent",
                    cursor: r.stock ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--kite-cream)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Company */}
                  <TD>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <CompanyLogo ticker={r.ticker} size={32} />
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "600", color: "var(--kite-amber-dark)", letterSpacing: "0.04em" }}>
                          {r.ticker}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--kite-muted)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.stock?.name ?? "—"}
                        </div>
                      </div>
                    </div>
                  </TD>

                  {/* Price */}
                  <TD right mono>
                    {r.price != null ? (
                      <div>
                        <div>{fmt(r.price)}</div>
                        <div style={{ fontSize: "11px", color: (r.changePct ?? 0) >= 0 ? "var(--kite-positive)" : "var(--kite-negative)" }}>
                          {(r.changePct ?? 0) >= 0 ? "+" : ""}{r.changePct?.toFixed(2) ?? "—"}%
                        </div>
                      </div>
                    ) : "—"}
                  </TD>

                  {/* Shares */}
                  <TD right mono>{r.shares.toLocaleString()}</TD>

                  {/* Avg Cost */}
                  <TD right>{r.costBasis ? fmt(r.costBasis) : <span style={{ color: "var(--kite-muted)" }}>—</span>}</TD>

                  {/* Market Value */}
                  <TD right>{r.marketValue != null ? fmt(r.marketValue) : <span style={{ color: "var(--kite-muted)" }}>—</span>}</TD>

                  {/* Day Chg */}
                  <TD right><PnL value={r.dayGain} pct={r.changePct} /></TD>

                  {/* Total P&L */}
                  <TD right><PnL value={r.totalGain} pct={r.totalGainPct} /></TD>

                  {/* % Portfolio */}
                  <TD right>
                    {portPct != null ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                        <div style={{ width: 40, height: 4, background: "var(--kite-border)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(portPct, 100)}%`, height: "100%", background: "var(--kite-amber)", borderRadius: 2 }} />
                        </div>
                        <span>{portPct.toFixed(1)}%</span>
                      </div>
                    ) : "—"}
                  </TD>

                  {/* Mkt Cap */}
                  <TD right>{fmtCap(r.stock?.market_cap)}</TD>

                  {/* P/E */}
                  <TD right>{r.stock?.pe_ratio != null ? r.stock.pe_ratio.toFixed(1) : <span style={{ color: "var(--kite-muted)" }}>—</span>}</TD>
                </tr>
              );
            })}
          </tbody>

          {/* Totals row */}
          <tfoot>
            <tr style={{ background: "var(--kite-cream)" }}>
              <td colSpan={4} style={{ padding: "10px 12px", fontSize: "11px", fontWeight: "700", color: "var(--kite-muted)", borderTop: "2px solid var(--kite-border)" }}>
                TOTAL
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)", borderTop: "2px solid var(--kite-border)" }}>
                {fmt(totalPortfolioValue)}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", borderTop: "2px solid var(--kite-border)" }}>
                <PnL value={totalDayGain} showPct={false} />
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", borderTop: "2px solid var(--kite-border)" }}>
                {totalGainAll != null ? <PnL value={totalGainAll} showPct={false} /> : "—"}
              </td>
              <td colSpan={3} style={{ borderTop: "2px solid var(--kite-border)" }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
