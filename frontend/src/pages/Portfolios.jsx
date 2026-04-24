/**
 * Portfolios.jsx — Multi-portfolio manager
 * Sub-tabs: Holdings · Returns · Updates · Dividends · Analysis
 */
import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { usePortfolios } from "../hooks/usePortfolios";
import { getQuotes, getNews, getPortfolioHistory } from "../api/client";
import CompanyLogo from "../components/CompanyLogo";
import PortfolioEditModal from "../components/PortfolioEditModal";
import CompanyDrawer from "../components/CompanyDrawer";

const PIE_COLORS = ["#C4922A", "#E8B84B", "#8B6914", "#F5D88A", "#A87B20", "#D4A73A", "#6B4E0A", "#FCC844", "#9A7025", "#B89030"];
const TABS = ["Holdings", "Returns", "Updates", "Dividends", "Analysis"];

const SECTOR_MAP = {
  AAPL:"Technology", MSFT:"Technology", NVDA:"Technology", GOOGL:"Technology", GOOG:"Technology",
  META:"Technology", AVGO:"Technology", ORCL:"Technology", CRM:"Technology", ADBE:"Technology",
  INTC:"Technology", AMD:"Technology", QCOM:"Technology", TXN:"Technology", TSM:"Technology",
  AMZN:"Consumer Cyclical", TSLA:"Consumer Cyclical", HD:"Consumer Cyclical", NKE:"Consumer Cyclical",
  MCD:"Consumer Defensive", WMT:"Consumer Defensive", COST:"Consumer Defensive",
  PG:"Consumer Defensive", KO:"Consumer Defensive", PEP:"Consumer Defensive",
  JPM:"Financials", BAC:"Financials", GS:"Financials", MS:"Financials",
  V:"Financials", MA:"Financials", BRK:"Financials", AXP:"Financials",
  JNJ:"Healthcare", PFE:"Healthcare", UNH:"Healthcare", LLY:"Healthcare",
  ABBV:"Healthcare", MRK:"Healthcare", TMO:"Healthcare", ABT:"Healthcare",
  XOM:"Energy", CVX:"Energy", SLB:"Energy",
  NFLX:"Communication", DIS:"Communication", T:"Communication", VZ:"Communication",
  BA:"Industrials", CAT:"Industrials", GE:"Industrials", HON:"Industrials",
  AMT:"Real Estate", PLD:"Real Estate",
  BTC:"Crypto", ETH:"Crypto",
};

const MARKET_MAP = {
  AAPL:"North America", MSFT:"North America", NVDA:"North America", GOOGL:"North America",
  GOOG:"North America", META:"North America", AMZN:"North America", TSLA:"North America",
  AVGO:"North America", ORCL:"North America", CRM:"North America", ADBE:"North America",
  INTC:"North America", AMD:"North America", QCOM:"North America", TXN:"North America",
  JPM:"North America", BAC:"North America", GS:"North America", MS:"North America",
  V:"North America", MA:"North America", JNJ:"North America", PFE:"North America",
  UNH:"North America", LLY:"North America", ABBV:"North America", MRK:"North America",
  XOM:"North America", CVX:"North America", NFLX:"North America", DIS:"North America",
  WMT:"North America", COST:"North America", HD:"North America", MCD:"North America",
  NKE:"North America", BA:"North America", CAT:"North America", T:"North America",
  TSM:"Asia", BABA:"Asia", BIDU:"Asia", JD:"Asia", NIO:"Asia", PDD:"Asia",
  SONY:"Asia", TM:"Asia", HMC:"Asia", ASML:"Europe", SAP:"Europe", NVO:"Europe",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function fmt(v, dec = 2) {
  if (v == null || isNaN(v)) return "—";
  return "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtShort(v) {
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return "$" + v.toFixed(0);
}
const pnlColor = (v) => v == null ? "var(--kite-muted)" : v >= 0 ? "var(--kite-positive)" : "var(--kite-negative)";
const pnlSign = (v) => v != null && v >= 0 ? "+" : "";
//dividends
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Snowflake Chart ─────────────────────────────────────────────────────────
function snowflakeColor(avg) {
  if (avg >= 65) return "#4CAF50";   // green — strong
  if (avg >= 40) return "#C4922A";   // amber — moderate
  return "#E05252";                  // red — weak
}

function SnowflakeChart({ scores }) {
  const data = [
    { subject: "VALUE",    score: scores.value    ?? 50 },
    { subject: "FUTURE",   score: scores.future   ?? 50 },
    { subject: "PAST",     score: scores.past     ?? 50 },
    { subject: "HEALTH",   score: scores.health   ?? 50 },
    { subject: "DIVIDEND", score: scores.dividend ?? 20 },
  ];
  const avg = data.reduce((s, d) => s + d.score, 0) / data.length;
  const color = snowflakeColor(avg);
  return (
    <RadarChart cx={130} cy={118} outerRadius={90} width={260} height={236} data={data}>
      <PolarGrid stroke="var(--kite-border)" gridType="circle" />
      <PolarAngleAxis dataKey="subject"
        tick={{ fontSize: 9, fill: "var(--kite-muted)", fontWeight: "700", letterSpacing: "0.05em" }} />
      <Radar dataKey="score" stroke={color} fill={color} fillOpacity={0.28} strokeWidth={2} />
    </RadarChart>
  );
}

const PERIODS = ["1M", "3M", "6M", "YTD", "1Y"];

function fmtDate(d) {
  if (!d || typeof d !== "string") return "";
  try {
    const [y, m] = d.split("-");
    const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${mo[parseInt(m, 10) - 1]} '${y.slice(2)}`;
  } catch { return ""; }
}

// ─── Portfolio Header (top of Holdings tab) ───────────────────────────────────
function PortfolioHeader({ rows, totalValue, totalDay }) {
  const [period, setPeriod] = useState("1Y");
  const [histData, setHistData] = useState(null);
  const [histLoading, setHistLoading] = useState(false);

  const tickers = rows.map((r) => r.ticker);

  // Load history whenever tickers or period changes
  useEffect(() => {
    if (!tickers.length) return;
    setHistLoading(true);
    getPortfolioHistory(tickers, period)
      .then((data) => setHistData(data))
      .catch(() => setHistData(null))
      .finally(() => setHistLoading(false));
  }, [tickers.join(","), period]);

  // Compute % return series aligned to SPY dates
  const chartSeries = useMemo(() => {
    if (!histData) return [];
    const spyData = histData["SPY"];
    if (!spyData?.closes?.length) return [];
    const validRows = rows.filter((r) => histData[r.ticker]?.closes?.length > 0);
    if (!validRows.length) return [];

    const allLens = [spyData.closes.length, ...validRows.map((r) => histData[r.ticker].closes.length)];
    const minLen = Math.min(...allLens);
    if (minLen < 2) return [];

    const series = [];
    for (let t = 0; t < minLen; t++) {
      const portVal = validRows.reduce((sum, r) => {
        const cls = histData[r.ticker].closes;
        return sum + r.shares * cls[cls.length - minLen + t];
      }, 0);
      const spyIdx = spyData.closes.length - minLen + t;
      series.push({ portVal, spyClose: spyData.closes[spyIdx], date: spyData.dates?.[spyIdx] || "" });
    }
    const p0 = series[0].portVal || 1, s0 = series[0].spyClose || 1;
    return series.map((s) => ({
      date: s.date,
      portfolio: parseFloat(((s.portVal / p0 - 1) * 100).toFixed(2)),
      market: parseFloat(((s.spyClose / s0 - 1) * 100).toFixed(2)),
    }));
  }, [histData, rows]);

  // Current period return from chart (last point)
  const portReturn = chartSeries.length ? chartSeries[chartSeries.length - 1].portfolio : null;
  const mktReturn = chartSeries.length ? chartSeries[chartSeries.length - 1].market : null;

  // Snowflake scores
  const n = rows.length;
  const withCost = rows.filter((r) => r.totalGain != null && r.costTotal > 0);
  const totalCostA = withCost.reduce((a, r) => a + r.costTotal, 0);
  const totalGainA = withCost.reduce((a, r) => a + r.totalGain, 0);
  const retPct = totalCostA > 0 ? (totalGainA / totalCostA) * 100 : null;
  const dayPct = totalValue > 0 ? (totalDay / totalValue) * 100 : null;

  const withPE = rows.filter((r) => r.s?.pe_ratio != null && r.mv);
  const wPEtot = withPE.reduce((a, r) => a + r.mv, 0);
  const avgPE = wPEtot > 0 ? withPE.reduce((a, r) => a + r.s.pe_ratio * r.mv, 0) / wPEtot : null;
  const withBeta = rows.filter((r) => r.s?.beta != null && r.mv);
  const wBtot = withBeta.reduce((a, r) => a + r.mv, 0);
  const avgBeta = wBtot > 0 ? withBeta.reduce((a, r) => a + r.s.beta * r.mv, 0) / wBtot : null;

  const scores = {
    value: avgPE != null ? clamp(Math.round(100 - avgPE * 2), 5, 95) : 50,
    future: 50,
    past: retPct != null ? clamp(Math.round(50 + retPct), 5, 95) : 50,
    health: avgBeta != null ? clamp(Math.round(100 - avgBeta * 35), 5, 95) : 50,
    dividend: 20,
  };

  const Stat = ({ label, main, sub, color }) => (
    <div>
      <div style={{ fontSize: "20px", fontWeight: "600", fontFamily: "var(--font-display)", color: color || "var(--kite-heading)", lineHeight: 1.1 }}>{main}</div>
      {sub && <div style={{ fontSize: "11px", color: color || "var(--kite-muted)", marginTop: "2px" }}>{sub}</div>}
      <div style={{ fontSize: "10px", color: "var(--kite-muted)", marginTop: "2px", fontWeight: "500" }}>{label}</div>
    </div>
  );

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: "11px" }}>
        <div style={{ color: "var(--kite-muted)", marginBottom: "4px" }}>{fmtDate(label)}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey === "portfolio" ? "Portfolio" : "US Market"}: {p.value > 0 ? "+" : ""}{p.value.toFixed(2)}%
          </div>
        ))}
      </div>
    );
  };

  const tickInterval = Math.max(1, Math.floor((chartSeries.length - 1) / 5));

  return (
    <div style={{ display: "flex", background: "var(--kite-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--kite-border)", marginBottom: "12px", overflow: "hidden" }}>

      {/* Left — Performance + chart */}
      <div style={{ flex: 1, padding: "18px 20px", borderRight: "1px solid var(--kite-border)", minWidth: 0 }}>
        <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", marginBottom: "14px" }}>
          Performance vs Market
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
          <Stat label={`Total Value · ${n} holding${n !== 1 ? "s" : ""}`} main={fmt(totalValue)} />
          <Stat
            label="Total Returns"
            main={retPct != null ? `${pnlSign(retPct)}${retPct.toFixed(1)}%` : "—"}
            sub={totalGainA ? `${pnlSign(totalGainA)}${fmt(totalGainA)}` : null}
            color={pnlColor(retPct)}
          />
          <Stat
            label="1D Returns"
            main={dayPct != null ? `${pnlSign(dayPct)}${dayPct.toFixed(2)}%` : "—"}
            sub={`${pnlSign(totalDay)}${fmt(totalDay)}`}
            color={pnlColor(totalDay)}
          />
        </div>

        {/* Period selector + legend */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, fontSize: "11px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: 20, height: 2, background: "#C4922A", display: "inline-block", borderRadius: 1 }} />
              <span style={{ color: "var(--kite-body)", fontWeight: "600" }}>Portfolio</span>
              {portReturn != null && (
                <span style={{ color: pnlColor(portReturn) }}>{pnlSign(portReturn)}{portReturn.toFixed(1)}%</span>
              )}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: 20, height: 2, background: "var(--kite-muted)", display: "inline-block", borderRadius: 1, opacity: 0.6 }} />
              <span style={{ color: "var(--kite-muted)" }}>US Market</span>
              {mktReturn != null && (
                <span style={{ color: pnlColor(mktReturn) }}>{pnlSign(mktReturn)}{mktReturn.toFixed(1)}%</span>
              )}
            </span>
          </div>

          {/* Period pills */}
          <div style={{ display: "flex", gap: "2px" }}>
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding: "3px 8px", background: period === p ? "var(--kite-amber-dark)" : "none", border: `1px solid ${period === p ? "var(--kite-amber-dark)" : "var(--kite-border)"}`, borderRadius: "var(--radius-sm)", fontSize: "11px", fontWeight: period === p ? "700" : "400", color: period === p ? "#fff" : "var(--kite-muted)", cursor: "pointer", transition: "all 0.15s" }}
              >{p}</button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div style={{ height: 160, position: "relative" }}>
          {histLoading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--kite-muted)" }}>
              Loading chart…
            </div>
          )}
          {!histLoading && chartSeries.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--kite-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--kite-muted)" }} axisLine={false} tickLine={false}
                  interval={tickInterval} tickFormatter={fmtDate} />
                <YAxis tick={{ fontSize: 10, fill: "var(--kite-muted)" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="portfolio" stroke="#C4922A" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="market" stroke="var(--kite-muted)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} opacity={0.7} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {!histLoading && !chartSeries.length && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "12px", color: "var(--kite-muted)" }}>
              Chart loads after market data is cached (first open may take ~30s)
            </div>
          )}
        </div>
      </div>

      {/* Right — Snowflake */}
      <div style={{ width: 292, padding: "18px 16px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", alignSelf: "flex-start", marginBottom: "4px" }}>
          Portfolio Snowflake
        </div>
        <SnowflakeChart scores={scores} />
        <div style={{ display: "flex", gap: "10px", fontSize: "11px", marginTop: "4px" }}>
          {[["Value", scores.value], ["Past", scores.past], ["Health", scores.health]].map(([k, v]) => (
            <span key={k}>
              <span style={{ color: "var(--kite-amber-dark)", fontWeight: "600" }}>{k}</span>
              <span style={{ color: "var(--kite-muted)" }}> {Math.round(v)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Holdings Tab ─────────────────────────────────────────────────────────────
function HoldingsTab({ holdings, portfolioData, onSelectStock, selectedTicker, onEdit }) {
  const rows = holdings.map((h) => {
    const s = portfolioData[h.ticker];
    const price = s?.price ?? null;
    const changePct = s?.change_pct ?? null;
    const mv = price != null ? h.shares * price : null;
    const dayGain = mv != null && changePct != null ? mv * (changePct / 100) : null;
    const costTotal = h.costBasis ? h.shares * h.costBasis : null;
    const totalGain = mv != null && costTotal ? mv - costTotal : null;
    const totalPct = totalGain != null && costTotal ? (totalGain / costTotal) * 100 : null;
    return { ...h, s, price, changePct, mv, dayGain, costTotal, totalGain, totalPct };
  });

  const totalValue = rows.reduce((a, r) => a + (r.mv ?? 0), 0);
  const totalDay = rows.reduce((a, r) => a + (r.dayGain ?? 0), 0);
  const totalGainAll = rows.every((r) => r.totalGain != null)
    ? rows.reduce((a, r) => a + r.totalGain, 0) : null;

  if (holdings.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
        <div style={{ fontSize: "32px", opacity: 0.15 }}>◈</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--kite-heading)", opacity: 0.5 }}>No holdings yet</div>
        <div style={{ fontSize: "12px", color: "var(--kite-muted)", opacity: 0.7 }}>Track P&L · View financials · Ask Kite anything</div>
        <button onClick={onEdit} style={{ padding: "9px 20px", background: "var(--kite-amber-dark)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "13px", fontWeight: "600", color: "#fff", cursor: "pointer" }}>
          + Add Holdings
        </button>
      </div>
    );
  }

  const TH = ({ children, right }) => (
    <th style={{ padding: "8px 12px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", textAlign: right ? "right" : "left", borderBottom: "1px solid var(--kite-border)", whiteSpace: "nowrap", background: "var(--kite-surface)", position: "sticky", top: 0, zIndex: 1 }}>
      {children}
    </th>
  );
  const TD = ({ children, right, mono }) => (
    <td style={{ padding: "11px 12px", fontSize: "13px", color: "var(--kite-body)", textAlign: right ? "right" : "left", fontFamily: mono ? "var(--font-mono)" : "var(--font-body)", whiteSpace: "nowrap", borderBottom: "1px solid var(--kite-border)" }}>
      {children}
    </td>
  );

  return (
    <div style={{ padding: "20px 24px 60px" }}>
      <PortfolioHeader rows={rows} totalValue={totalValue} totalDay={totalDay} />

      {/* Action bar — Edit + Add */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <button onClick={onEdit}
          style={{ padding: "7px 14px", background: "none", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: "500", color: "var(--kite-body)", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "5px" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--kite-amber-dark)"; e.currentTarget.style.color = "var(--kite-amber-dark)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--kite-border)"; e.currentTarget.style.color = "var(--kite-body)"; }}
        >✎ Edit Holdings</button>
        <button onClick={onEdit}
          style={{ padding: "7px 14px", background: "var(--kite-amber-dark)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: "600", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
        >+ Add Holding</button>
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
              const isSelected = selectedTicker === r.ticker;
              const portPct = totalValue > 0 && r.mv != null ? (r.mv / totalValue) * 100 : null;
              return (
                <tr key={r.ticker}
                  onClick={() => r.s && onSelectStock(r.s)}
                  style={{ background: isSelected ? "var(--kite-amber-wash)" : "transparent", cursor: r.s ? "pointer" : "default", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--kite-cream)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <TD>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <CompanyLogo ticker={r.ticker} size={32} />
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "600", color: "var(--kite-amber-dark)" }}>{r.ticker}</div>
                        <div style={{ fontSize: "11px", color: "var(--kite-muted)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.s?.name ?? "—"}</div>
                      </div>
                    </div>
                  </TD>
                  <TD right>
                    {r.price != null ? (
                      <div>
                        <div>{fmt(r.price)}</div>
                        <div style={{ fontSize: "11px", color: pnlColor(r.changePct) }}>{pnlSign(r.changePct)}{r.changePct?.toFixed(2) ?? "—"}%</div>
                      </div>
                    ) : "—"}
                  </TD>
                  <TD right>{r.shares.toLocaleString()}</TD>
                  <TD right>{r.costBasis ? fmt(r.costBasis) : <span style={{ color: "var(--kite-muted)" }}>—</span>}</TD>
                  <TD right>{r.mv != null ? fmt(r.mv) : "—"}</TD>
                  <TD right>
                    {r.dayGain != null
                      ? <span style={{ color: pnlColor(r.dayGain) }}>{pnlSign(r.dayGain)}{fmt(r.dayGain)}</span>
                      : "—"}
                  </TD>
                  <TD right>
                    {r.totalGain != null ? (
                      <div>
                        <div style={{ color: pnlColor(r.totalGain) }}>{pnlSign(r.totalGain)}{fmt(r.totalGain)}</div>
                        {r.totalPct != null && <div style={{ fontSize: "11px", color: pnlColor(r.totalPct) }}>{pnlSign(r.totalPct)}{r.totalPct.toFixed(1)}%</div>}
                      </div>
                    ) : "—"}
                  </TD>
                  <TD right>
                    {portPct != null ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                        <div style={{ width: 36, height: 4, background: "var(--kite-border)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(portPct, 100)}%`, height: "100%", background: "var(--kite-amber)", borderRadius: 2 }} />
                        </div>
                        <span>{portPct.toFixed(1)}%</span>
                      </div>
                    ) : "—"}
                  </TD>
                  <TD right>{fmtShort(r.s?.market_cap)}</TD>
                  <TD right>{r.s?.pe_ratio != null ? r.s.pe_ratio.toFixed(1) : <span style={{ color: "var(--kite-muted)" }}>—</span>}</TD>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--kite-cream)" }}>
              <td colSpan={4} style={{ padding: "10px 12px", fontSize: "11px", fontWeight: "700", color: "var(--kite-muted)", borderTop: "2px solid var(--kite-border)" }}>TOTAL</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)", borderTop: "2px solid var(--kite-border)" }}>{fmt(totalValue)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", borderTop: "2px solid var(--kite-border)" }}>
                <span style={{ color: pnlColor(totalDay) }}>{pnlSign(totalDay)}{fmt(totalDay)}</span>
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", borderTop: "2px solid var(--kite-border)" }}>
                {totalGainAll != null ? <span style={{ color: pnlColor(totalGainAll) }}>{pnlSign(totalGainAll)}{fmt(totalGainAll)}</span> : "—"}
              </td>
              <td colSpan={3} style={{ borderTop: "2px solid var(--kite-border)" }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Returns Tab ──────────────────────────────────────────────────────────────
function ReturnsTab({ holdings, portfolioData }) {
  const rows = holdings.map((h) => {
    const s = portfolioData[h.ticker];
    const price = s?.price ?? null;
    const mv = price != null ? h.shares * price : null;
    const costTotal = h.costBasis ? h.shares * h.costBasis : null;
    const gain = mv != null && costTotal ? mv - costTotal : null;
    const gainPct = gain != null && costTotal ? (gain / costTotal) * 100 : null;
    return { ...h, s, mv, costTotal, gain, gainPct };
  });

  const totalValue = rows.reduce((a, r) => a + (r.mv ?? 0), 0);
  const totalCost = rows.reduce((a, r) => a + (r.costTotal ?? 0), 0);
  const totalGain = totalCost > 0 ? totalValue - totalCost : null;
  const totalPct = totalGain != null && totalCost > 0 ? (totalGain / totalCost) * 100 : null;

  const sorted = rows.filter((r) => r.gainPct != null).sort((a, b) => (b.gainPct ?? 0) - (a.gainPct ?? 0));
  const maxAbs = Math.max(...sorted.map((r) => Math.abs(r.gain ?? 0)), 1);

  const barData = sorted.map((r) => ({
    ticker: r.ticker,
    pct: parseFloat((r.gainPct ?? 0).toFixed(2)),
    gain: r.gain ?? 0,
  }));

  if (holdings.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ color: "var(--kite-muted)", fontSize: "14px" }}>Add holdings to see returns</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Portfolio Value", val: fmt(totalValue), pct: null, color: "var(--kite-heading)" },
          { label: "Unrealized Gain", val: totalGain != null ? `${pnlSign(totalGain)}${fmt(totalGain)}` : "—", pct: totalPct, color: pnlColor(totalGain) },
          { label: "Total Return", val: totalPct != null ? `${pnlSign(totalPct)}${totalPct.toFixed(2)}%` : "—", pct: null, color: pnlColor(totalPct) },
        ].map(({ label, val, pct, color }) => (
          <div key={label} style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-md)", padding: "16px 20px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", marginBottom: "8px" }}>{label}</div>
            <div style={{ fontSize: "22px", fontWeight: "600", fontFamily: "var(--font-display)", color }}>{val}</div>
            {pct != null && <div style={{ fontSize: "12px", color, marginTop: "2px" }}>{pnlSign(pct)}{pct.toFixed(2)}%</div>}
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-md)", padding: "20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "16px" }}>Return by Holding</div>
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--kite-border)" vertical={false} />
              <XAxis dataKey="ticker" tick={{ fontSize: 11, fill: "var(--kite-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--kite-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(v) => [`${v.toFixed(2)}%`, "Return"]}
                contentStyle={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", fontSize: "12px" }}
              />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {barData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.pct >= 0 ? "var(--kite-positive)" : "var(--kite-negative)"} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: "var(--kite-muted)", fontSize: "12px", padding: "20px 0" }}>
            Add cost basis to your holdings to see return charts.
          </div>
        )}
      </div>

      {/* Contributors list */}
      <div style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-md)", padding: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "16px" }}>Contributors to Total Return</div>
        {sorted.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {sorted.map((r) => (
              <div key={r.ticker} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: 48, fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "600", color: "var(--kite-amber-dark)", flexShrink: 0 }}>{r.ticker}</div>
                <div style={{ flex: 1, height: 6, background: "var(--kite-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(Math.abs(r.gain ?? 0) / maxAbs) * 100}%`, height: "100%", background: (r.gain ?? 0) >= 0 ? "var(--kite-positive)" : "var(--kite-negative)", borderRadius: 3 }} />
                </div>
                <div style={{ width: 90, textAlign: "right", fontSize: "12px", color: pnlColor(r.gain), fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                  {pnlSign(r.gain)}{fmt(r.gain ?? 0)}
                </div>
                <div style={{ width: 56, textAlign: "right", fontSize: "11px", color: pnlColor(r.gainPct), flexShrink: 0 }}>
                  {pnlSign(r.gainPct)}{r.gainPct?.toFixed(1) ?? "—"}%
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--kite-muted)", fontSize: "12px" }}>Add cost basis to your holdings to see contribution data.</div>
        )}
      </div>
    </div>
  );
}

// ─── Updates Tab ──────────────────────────────────────────────────────────────
const UPDATE_CATS = ["All", "Earnings", "Dividends", "Insider", "Risk", "Other"];
const CAT_KEYWORDS = {
  Earnings: ["earnings", "revenue", "profit", "loss", "eps", "quarter", "guidance", "beat", "miss", "income", "sales"],
  Dividends: ["dividend", "payout", "yield", "distribution", "ex-dividend"],
  Insider: ["insider", "purchase", "sold shares", "executive", "officer", "director", "form 4"],
  Risk: ["lawsuit", "investigation", "sec", "fraud", "risk", "downgrade", "recall", "fine", "penalty", "probe"],
};
const CAT_COLOR = { Earnings: "#4CAF50", Dividends: "#C4922A", Insider: "#9C27B0", Risk: "#E05252", Other: "var(--kite-muted)", All: "var(--kite-muted)" };

function categorize(item) {
  const text = ((item.title || "") + " " + (item.summary || "")).toLowerCase();
  for (const [cat, kws] of Object.entries(CAT_KEYWORDS)) {
    if (kws.some((kw) => text.includes(kw))) return cat;
  }
  return "Other";
}

function UpdatesTab({ tickers, portfolioData }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState("All");

  useEffect(() => {
    if (!tickers.length) return;
    setLoading(true);
    getNews({ tickers, filter: "portfolio" })
      .then((res) => setNews(res.items || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [tickers.join(",")]);

  const filtered = activeCat === "All" ? news : news.filter((item) => categorize(item) === activeCat);

  if (!tickers.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ color: "var(--kite-muted)", fontSize: "14px" }}>Add holdings to see updates</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Category sidebar */}
      <div style={{ width: 160, borderRight: "1px solid var(--kite-border)", padding: "16px 0", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--kite-muted)", padding: "0 16px", marginBottom: "6px" }}>Filter</div>
        {UPDATE_CATS.map((cat) => (
          <button key={cat} onClick={() => setActiveCat(cat)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", background: activeCat === cat ? "var(--kite-amber-wash)" : "none", border: "none", cursor: "pointer", fontSize: "13px", color: activeCat === cat ? "var(--kite-amber-dark)" : "var(--kite-body)", fontWeight: activeCat === cat ? "600" : "400" }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {loading && <div style={{ color: "var(--kite-muted)", fontSize: "13px" }}>Loading updates…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ color: "var(--kite-muted)", fontSize: "13px" }}>
            No {activeCat !== "All" ? activeCat.toLowerCase() + " " : ""}updates found for your holdings.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((item, i) => {
            const cat = categorize(item);
            const ticker = item.tickers?.[0];
            const stock = ticker ? portfolioData[ticker] : null;
            return (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-md)", padding: "14px 16px", textDecoration: "none", transition: "box-shadow 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(61,46,15,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  {ticker && <CompanyLogo ticker={ticker} size={36} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                      {ticker && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: "600", color: "var(--kite-amber-dark)" }}>{ticker}</span>
                      )}
                      <span style={{ fontSize: "9px", fontWeight: "700", color: CAT_COLOR[cat] || "var(--kite-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat}</span>
                      <span style={{ fontSize: "10px", color: "var(--kite-muted)", marginLeft: "auto" }}>
                        {item.source} · {timeAgo(item.published_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)", lineHeight: 1.4, marginBottom: item.summary ? "4px" : 0 }}>
                      {item.title}
                    </div>
                    {item.summary && (
                      <div style={{ fontSize: "12px", color: "var(--kite-body)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.summary}
                      </div>
                    )}
                  </div>
                  {stock && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)" }}>${stock.price?.toFixed(2)}</div>
                      <div style={{ fontSize: "11px", color: pnlColor(stock.change_pct) }}>{pnlSign(stock.change_pct)}{stock.change_pct?.toFixed(2)}%</div>
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Dividends Tab ────────────────────────────────────────────────────────────
function DividendsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
      <div style={{ fontSize: "48px", opacity: 0.15 }}>◈</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: "600", color: "var(--kite-heading)" }}>Dividend Tracker</div>
      <div style={{ fontSize: "13px", color: "var(--kite-muted)", maxWidth: "320px", textAlign: "center", lineHeight: 1.6 }}>
        Dividend forecasting and income tracking not implemented yet. Hi Jaime
      </div>
    </div>
  );
}

// ─── Analysis Tab ─────────────────────────────────────────────────────────────
function AnalysisTab({ holdings, portfolioData }) {
  const [hidden, setHidden] = useState(new Set());

  const rows = holdings.map((h) => {
    const s = portfolioData[h.ticker];
    const mv = s?.price != null ? h.shares * s.price : null;
    return { ...h, s, mv };
  });

  const totalMV = rows.reduce((a, r) => a + (r.mv ?? 0), 0);

  // Donut data — by market value
  const donutData = rows
    .filter((r) => r.mv != null && r.mv > 0)
    .map((r) => ({ name: r.ticker, value: parseFloat(((r.mv / totalMV) * 100).toFixed(1)) }))
    .sort((a, b) => b.value - a.value);

  // Weighted portfolio market cap (sum of each holding's share of portfolio × company MC)
  const portMC = totalMV > 0
    ? rows.filter((r) => r.s?.market_cap != null && r.mv)
        .reduce((a, r) => a + (r.mv / totalMV) * r.s.market_cap, 0)
    : null;

  // Build metric rows — values computed from available quote data; "—" where not yet in data model
  const allMetrics = [
    { key: "Market Cap",                     value: portMC != null ? fmtShort(portMC) : "—" },
    { key: "Dividend Yield",                 value: "—" },
    { key: "Revenue 5Y CAGR",               value: "—" },
    { key: "Dividend Per Share 5Y CAGR",    value: "—" },
    { key: "Operating Margin",               value: "—" },
    { key: "Return on Invested Capital",     value: "—" },
    { key: "Return on Assets",               value: "—" },
    { key: "Forward EV/Sales",               value: "—" },
    { key: "Total Enterprise Value (TEV)",   value: "—" },
    { key: "Revenue 3Y CAGR",               value: "—" },
    { key: "Diluted EPS Before Extra 3Y CAGR", value: "—" },
    { key: "EBITDA Margin",                  value: "—" },
    { key: "Net Profit Margin",              value: "—" },
    { key: "Return on Equity",               value: "—" },
  ];

  const visibleMetrics = allMetrics.filter((m) => !hidden.has(m.key));

  // Market cap tier breakdown
  const mcTiers = [
    { name: "Mega (>$200B)", color: "#C4922A", test: (mc) => mc >= 200e9 },
    { name: "Large ($10–200B)", color: "#E8B84B", test: (mc) => mc >= 10e9 && mc < 200e9 },
    { name: "Mid ($2–10B)", color: "#8B6914", test: (mc) => mc >= 2e9 && mc < 10e9 },
    { name: "Small (<$2B)", color: "#F5D88A", test: (mc) => mc < 2e9 },
  ];
  const mcBreakdown = mcTiers.map((tier) => {
    const mv = rows.filter((r) => r.s?.market_cap != null && r.mv && tier.test(r.s.market_cap))
      .reduce((a, r) => a + r.mv, 0);
    return { name: tier.name, value: parseFloat(((mv / (totalMV || 1)) * 100).toFixed(1)), color: tier.color };
  }).filter((d) => d.value > 0);

  // P/E profile breakdown
  const peBreakdown = [
    { name: "High P/E (>30)", color: "#E05252", mv: rows.filter((r) => r.s?.pe_ratio > 30 && r.mv).reduce((a, r) => a + r.mv, 0) },
    { name: "Moderate (15–30)", color: "#C4922A", mv: rows.filter((r) => r.s?.pe_ratio >= 15 && r.s?.pe_ratio <= 30 && r.mv).reduce((a, r) => a + r.mv, 0) },
    { name: "Low P/E (<15)", color: "#4CAF50", mv: rows.filter((r) => r.s?.pe_ratio != null && r.s?.pe_ratio < 15 && r.mv).reduce((a, r) => a + r.mv, 0) },
    { name: "No P/E data", color: "var(--kite-border)", mv: rows.filter((r) => r.s?.pe_ratio == null && r.mv).reduce((a, r) => a + r.mv, 0) },
  ].map((d) => ({ name: d.name, value: parseFloat(((d.mv / (totalMV || 1)) * 100).toFixed(1)), color: d.color }))
   .filter((d) => d.value > 0);

  const SmallDonutTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", padding: "7px 10px", fontSize: "11px" }}>
        <div style={{ color: "var(--kite-heading)", fontWeight: "600" }}>{d.name}</div>
        <div style={{ color: "var(--kite-muted)" }}>{d.value}%</div>
      </div>
    );
  };

  // Custom outer label for Portfolio Holdings donut
  const RADIAN = Math.PI / 180;
  const renderHoldingLabel = ({ cx, cy, midAngle, outerRadius, name, value, index }) => {
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const lx1 = cx + (outerRadius + 6) * Math.cos(-midAngle * RADIAN);
    const ly1 = cy + (outerRadius + 6) * Math.sin(-midAngle * RADIAN);
    const lx2 = cx + (outerRadius + 22) * Math.cos(-midAngle * RADIAN);
    const ly2 = cy + (outerRadius + 22) * Math.sin(-midAngle * RADIAN);
    const anchor = x > cx ? "start" : "end";
    const color = PIE_COLORS[index % PIE_COLORS.length];
    return (
      <g key={name}>
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={color} strokeWidth={1} />
        <circle cx={x} cy={y - 6} r={5} fill={color} />
        <text x={x + (anchor === "start" ? 9 : -9)} y={y - 3} fill="var(--kite-heading)" fontSize={9.5} fontWeight="700" textAnchor={anchor}>{name}</text>
        <text x={x + (anchor === "start" ? 9 : -9)} y={y + 9} fill="var(--kite-muted)" fontSize={9} textAnchor={anchor}>{value}%</text>
      </g>
    );
  };

  if (holdings.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ color: "var(--kite-muted)", fontSize: "14px" }}>Add holdings to see analysis</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Left — Metrics table */}
      <div style={{ flex: 1, overflowY: "auto", borderRight: "1px solid var(--kite-border)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--kite-border)", position: "sticky", top: 0, background: "var(--kite-bg)", zIndex: 2 }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--kite-heading)", letterSpacing: "0.02em" }}>Portfolio Metrics</div>
          <button
            onClick={() => {
              const csv = visibleMetrics.map((m) => `${m.key},${m.value}`).join("\n");
              const blob = new Blob([`Metric,Value\n${csv}`], { type: "text/csv" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "portfolio_metrics.csv"; a.click();
            }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", background: "#4CAF50", border: "none", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: "600", color: "#fff", cursor: "pointer" }}
          >
            Download ↓
          </button>
        </div>

        {/* Rows */}
        {visibleMetrics.map((m) => (
          <div key={m.key} style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--kite-border)", padding: "0 20px", height: "44px", gap: "12px" }}>
            <span style={{ color: "var(--kite-border)", fontSize: "14px", cursor: "grab", flexShrink: 0, userSelect: "none" }}>⠿</span>
            <span style={{ flex: 1, fontSize: "13px", color: "var(--kite-body)" }}>{m.key}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--kite-heading)", fontWeight: "600" }}>{m.value}</span>
            <button
              onClick={() => setHidden((prev) => new Set([...prev, m.key]))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--kite-muted)", fontSize: "14px", padding: "2px 4px", lineHeight: 1, borderRadius: "2px" }}
            >✕</button>
          </div>
        ))}

        {hidden.size > 0 && (
          <div style={{ padding: "12px 20px" }}>
            <button
              onClick={() => setHidden(new Set())}
              style={{ background: "none", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", padding: "5px 12px", fontSize: "11px", color: "var(--kite-muted)", cursor: "pointer" }}
            >Show {hidden.size} hidden metric{hidden.size !== 1 ? "s" : ""}</button>
          </div>
        )}
      </div>

      {/* Right — Charts */}
      <div style={{ width: 440, overflowY: "auto", flexShrink: 0 }}>

        {/* Portfolio Holdings donut */}
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--kite-heading)", marginBottom: "2px" }}>Portfolio Holdings</div>
          <div style={{ fontSize: "11px", color: "var(--kite-muted)", marginBottom: "12px" }}>By market value</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PieChart width={390} height={290}>
              <Pie
                data={donutData} cx={195} cy={145}
                innerRadius={62} outerRadius={105}
                dataKey="value" paddingAngle={2}
                label={renderHoldingLabel} labelLine={false}
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<SmallDonutTooltip />} />
            </PieChart>
          </div>
        </div>

        {/* Two smaller charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", borderTop: "1px solid var(--kite-border)" }}>

          {/* Market Cap Tiers */}
          <div style={{ padding: "16px", borderRight: "1px solid var(--kite-border)" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "12px" }}>Market Cap Mix</div>
            <PieChart width={180} height={130}>
              <Pie data={mcBreakdown} cx={88} cy={60} innerRadius={32} outerRadius={56} dataKey="value" paddingAngle={2}>
                {mcBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<SmallDonutTooltip />} />
            </PieChart>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "6px" }}>
              {mcBreakdown.map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                  <div style={{ fontSize: "10px", color: "var(--kite-muted)", flex: 1, lineHeight: 1.2 }}>{d.name}</div>
                  <div style={{ fontSize: "10px", fontWeight: "600", color: "var(--kite-heading)", fontFamily: "var(--font-mono)" }}>{d.value}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* P/E Profile */}
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "12px" }}>Valuation Profile</div>
            <PieChart width={180} height={130}>
              <Pie data={peBreakdown} cx={88} cy={60} innerRadius={32} outerRadius={56} dataKey="value" paddingAngle={2}>
                {peBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<SmallDonutTooltip />} />
            </PieChart>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "6px" }}>
              {peBreakdown.map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                  <div style={{ fontSize: "10px", color: "var(--kite-muted)", flex: 1, lineHeight: 1.2 }}>{d.name}</div>
                  <div style={{ fontSize: "10px", fontWeight: "600", color: "var(--kite-heading)", fontFamily: "var(--font-mono)" }}>{d.value}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Portfolios() {
  const { portfolios, activePortfolio, activeId, setActiveId, createPortfolio, deletePortfolio, renamePortfolio, replaceHoldings } = usePortfolios();
  const [activeTab, setActiveTab] = useState("Holdings");
  const [portfolioData, setPortfolioData] = useState({});
  const [drawerStock, setDrawerStock] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  const holdings = activePortfolio?.holdings || [];
  const tickers = holdings.map((h) => h.ticker);

  useEffect(() => {
    if (!tickers.length) return;
    getQuotes(tickers).then((stocks) => {
      setPortfolioData((prev) => {
        const next = { ...prev };
        stocks.forEach((s) => { next[s.ticker] = s; });
        return next;
      });
    });
  }, [tickers.join(",")]);

  // Close drawer when leaving Holdings tab
  useEffect(() => {
    if (activeTab !== "Holdings") { setDrawerStock(null); setSelectedTicker(null); }
  }, [activeTab]);

  function handleSaveHoldings(newHoldings) {
    replaceHoldings(activePortfolio.id, newHoldings);
  }

  function handleCreatePortfolio() {
    if (!newName.trim()) return;
    createPortfolio(newName);
    setNewName("");
    setCreatingNew(false);
  }

  function commitRename() {
    if (renamingId && renameVal.trim()) renamePortfolio(renamingId, renameVal);
    setRenamingId(null);
    setRenameVal("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--kite-cream)" }}>

      {/* ── Portfolio switcher bar ─────────────────────────────── */}
      <div style={{ background: "var(--kite-surface)", borderBottom: "1px solid var(--kite-border)", padding: "0 20px", display: "flex", alignItems: "center", gap: "4px", height: "44px", overflowX: "auto", flexShrink: 0 }}>
        {portfolios.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center" }}>
            {renamingId === p.id ? (
              <input autoFocus value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                style={{ fontSize: "13px", padding: "4px 8px", border: "1px solid var(--kite-amber-dark)", borderRadius: "var(--radius-sm)", background: "var(--kite-cream)", color: "var(--kite-heading)", outline: "none", width: "150px" }}
              />
            ) : (
              <button
                onClick={() => setActiveId(p.id)}
                onDoubleClick={() => { setRenamingId(p.id); setRenameVal(p.name); }}
                title="Double-click to rename"
                style={{ padding: "4px 12px", background: activeId === p.id ? "var(--kite-amber-wash)" : "none", border: activeId === p.id ? "1px solid var(--kite-amber)" : "1px solid transparent", borderRadius: "var(--radius-sm)", fontSize: "13px", fontWeight: activeId === p.id ? "600" : "400", color: activeId === p.id ? "var(--kite-amber-dark)" : "var(--kite-body)", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
              >
                {p.name}
              </button>
            )}
            {portfolios.length > 1 && (
              <button onClick={() => deletePortfolio(p.id)} title="Delete portfolio"
                style={{ padding: "2px 4px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "var(--kite-muted)", opacity: 0.4, transition: "opacity 0.15s, color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--kite-negative)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "var(--kite-muted)"; }}
              >×</button>
            )}
          </div>
        ))}

        {creatingNew ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input autoFocus value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreatePortfolio(); if (e.key === "Escape") { setCreatingNew(false); setNewName(""); } }}
              placeholder="Portfolio name…"
              style={{ fontSize: "13px", padding: "4px 8px", border: "1px solid var(--kite-amber-dark)", borderRadius: "var(--radius-sm)", background: "var(--kite-cream)", color: "var(--kite-heading)", outline: "none", width: "160px" }}
            />
            <button onClick={handleCreatePortfolio} style={{ padding: "4px 10px", background: "var(--kite-amber-dark)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: "600", color: "#fff", cursor: "pointer" }}>
              Create
            </button>
            <button onClick={() => { setCreatingNew(false); setNewName(""); }} style={{ padding: "4px 8px", background: "none", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--kite-muted)", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setCreatingNew(true)}
            style={{ padding: "4px 10px", background: "none", border: "1px dashed var(--kite-border)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--kite-muted)", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--kite-amber-dark)"; e.currentTarget.style.color = "var(--kite-amber-dark)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--kite-border)"; e.currentTarget.style.color = "var(--kite-muted)"; }}
          >
            + New
          </button>
        )}
      </div>

      {/* ── Sub-tab bar ───────────────────────────────────────── */}
      <div style={{ background: "var(--kite-surface)", borderBottom: "1px solid var(--kite-border)", padding: "0 20px", display: "flex", height: "40px", alignItems: "center", flexShrink: 0 }}>
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "0 16px", height: "100%", background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid var(--kite-amber-dark)" : "2px solid transparent", cursor: "pointer", fontSize: "13px", fontWeight: activeTab === tab ? "600" : "400", color: activeTab === tab ? "var(--kite-amber-dark)" : "var(--kite-muted)", transition: "all 0.15s", whiteSpace: "nowrap" }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Content area ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {/* Main panel */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

          {activeTab === "Holdings" && (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
              <HoldingsTab
                holdings={holdings}
                portfolioData={portfolioData}
                onSelectStock={(s) => { setSelectedTicker(s.ticker); setDrawerStock(s); }}
                selectedTicker={selectedTicker}
                onEdit={() => setShowEditModal(true)}
              />
            </div>
          )}

          {activeTab === "Returns" && (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
              <ReturnsTab holdings={holdings} portfolioData={portfolioData} />
            </div>
          )}

          {activeTab === "Updates" && (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <UpdatesTab tickers={tickers} portfolioData={portfolioData} />
            </div>
          )}

          {activeTab === "Dividends" && (
            <div style={{ position: "absolute", inset: 0 }}>
              <DividendsTab />
            </div>
          )}

          {activeTab === "Analysis" && (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
              <AnalysisTab holdings={holdings} portfolioData={portfolioData} />
            </div>
          )}
        </div>

        {/* Company Drawer (Holdings only) */}
        {activeTab === "Holdings" && drawerStock && (
          <CompanyDrawer
            stock={drawerStock}
            onClose={() => { setDrawerStock(null); setSelectedTicker(null); }}
            portfolioData={portfolioData}
          />
        )}
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <PortfolioEditModal
          holdings={holdings}
          portfolioData={portfolioData}
          onSave={handleSaveHoldings}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
