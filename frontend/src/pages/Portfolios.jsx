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

const PIE_COLORS = ["#C4922A","#E8B84B","#8B6914","#F5D88A","#A87B20","#D4A73A","#6B4E0A","#FCC844","#9A7025","#B89030"];
const TABS = ["Holdings", "Returns", "Updates", "Dividends", "Analysis"];

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
  if (a >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  return "$" + v.toFixed(0);
}
const pnlColor = (v) => v == null ? "var(--kite-muted)" : v >= 0 ? "var(--kite-positive)" : "var(--kite-negative)";
const pnlSign  = (v) => v != null && v >= 0 ? "+" : "";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Gauge Chart ─────────────────────────────────────────────────────────────
function polarToXY(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function GaugeChart({ score = 0, label, sublabel }) {
  const cx = 60, cy = 62, r = 44;
  const s = clamp(score, 0, 100);
  // Arc goes clockwise from 180° (left) through 270° (top) to 360° (right)
  // score 0→100 maps to needleAngle 180°→360°
  const needleAngle = 180 + s * 1.8;
  const bgStart  = polarToXY(cx, cy, r, 180);
  const bgEnd    = polarToXY(cx, cy, r, 0);   // same as 360°
  const scoreEnd = polarToXY(cx, cy, r, needleAngle);
  const needlePt = polarToXY(cx, cy, 34, needleAngle);
  const color    = s >= 70 ? "#4CAF50" : s >= 40 ? "#C4922A" : "#E05252";

  const arc = (end) =>
    `M ${bgStart.x.toFixed(1)} ${bgStart.y.toFixed(1)} A ${r} ${r} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;

  return (
    <div style={{ textAlign: "center", width: 140 }}>
      <svg width="120" height="72" viewBox="0 0 120 72">
        <path d={arc(bgEnd)}    fill="none" stroke="var(--kite-border)" strokeWidth="8" strokeLinecap="round" />
        {s > 0 && (
          <path d={arc(scoreEnd)} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
        )}
        <line x1={cx} y1={cy} x2={needlePt.x.toFixed(1)} y2={needlePt.y.toFixed(1)}
          stroke="var(--kite-heading)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3" fill="var(--kite-heading)" />
      </svg>
      <div style={{ fontSize: "20px", fontWeight: "700", color, fontFamily: "var(--font-display)", marginTop: "-8px" }}>
        {Math.round(s)}
      </div>
      <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--kite-heading)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "1px" }}>{label}</div>
      {sublabel && <div style={{ fontSize: "10px", color: "var(--kite-muted)", marginTop: "2px" }}>{sublabel}</div>}
    </div>
  );
}

// ─── Snowflake Chart ─────────────────────────────────────────────────────────
function SnowflakeChart({ scores }) {
  const data = [
    { subject: "VALUE",    score: scores.value    ?? 50 },
    { subject: "FUTURE",   score: scores.future   ?? 50 },
    { subject: "PAST",     score: scores.past     ?? 50 },
    { subject: "HEALTH",   score: scores.health   ?? 50 },
    { subject: "DIVIDEND", score: scores.dividend ?? 20 },
  ];
  return (
    <RadarChart cx={105} cy={98} outerRadius={72} width={210} height={196} data={data}>
      <PolarGrid stroke="var(--kite-border)" gridType="circle" />
      <PolarAngleAxis dataKey="subject"
        tick={{ fontSize: 9, fill: "var(--kite-muted)", fontWeight: "700", letterSpacing: "0.05em" }} />
      <Radar dataKey="score" stroke="#C4922A" fill="#C4922A" fillOpacity={0.35} strokeWidth={2} />
    </RadarChart>
  );
}

const PERIODS = ["1M", "3M", "6M", "YTD", "1Y"];

function fmtDate(d) {
  if (!d || typeof d !== "string") return "";
  try {
    const [y, m] = d.split("-");
    const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${mo[parseInt(m, 10) - 1]} '${y.slice(2)}`;
  } catch { return ""; }
}

// ─── Portfolio Header (top of Holdings tab) ───────────────────────────────────
function PortfolioHeader({ rows, totalValue, totalDay }) {
  const [period, setPeriod]         = useState("1Y");
  const [histData, setHistData]     = useState(null);
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
    const minLen  = Math.min(...allLens);
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
      date:      s.date,
      portfolio: parseFloat(((s.portVal / p0 - 1) * 100).toFixed(2)),
      market:    parseFloat(((s.spyClose / s0 - 1) * 100).toFixed(2)),
    }));
  }, [histData, rows]);

  // Current period return from chart (last point)
  const portReturn  = chartSeries.length ? chartSeries[chartSeries.length - 1].portfolio : null;
  const mktReturn   = chartSeries.length ? chartSeries[chartSeries.length - 1].market : null;

  // Snowflake scores
  const n = rows.length;
  const withCost   = rows.filter((r) => r.totalGain != null && r.costTotal > 0);
  const totalCostA = withCost.reduce((a, r) => a + r.costTotal, 0);
  const totalGainA = withCost.reduce((a, r) => a + r.totalGain, 0);
  const retPct     = totalCostA > 0 ? (totalGainA / totalCostA) * 100 : null;
  const dayPct     = totalValue > 0 ? (totalDay / totalValue) * 100 : null;

  const withPE  = rows.filter((r) => r.s?.pe_ratio != null && r.mv);
  const wPEtot  = withPE.reduce((a, r) => a + r.mv, 0);
  const avgPE   = wPEtot > 0 ? withPE.reduce((a, r) => a + r.s.pe_ratio * r.mv, 0) / wPEtot : null;
  const withBeta = rows.filter((r) => r.s?.beta != null && r.mv);
  const wBtot    = withBeta.reduce((a, r) => a + r.mv, 0);
  const avgBeta  = wBtot > 0 ? withBeta.reduce((a, r) => a + r.s.beta * r.mv, 0) / wBtot : null;

  const scores = {
    value:    avgPE   != null ? clamp(Math.round(100 - avgPE * 2),    5, 95) : 50,
    future:   50,
    past:     retPct  != null ? clamp(Math.round(50 + retPct),        5, 95) : 50,
    health:   avgBeta != null ? clamp(Math.round(100 - avgBeta * 35), 5, 95) : 50,
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
      <div style={{ width: 240, padding: "18px 16px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
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
    const price     = s?.price ?? null;
    const changePct = s?.change_pct ?? null;
    const mv        = price != null ? h.shares * price : null;
    const dayGain   = mv != null && changePct != null ? mv * (changePct / 100) : null;
    const costTotal = h.costBasis ? h.shares * h.costBasis : null;
    const totalGain = mv != null && costTotal ? mv - costTotal : null;
    const totalPct  = totalGain != null && costTotal ? (totalGain / costTotal) * 100 : null;
    return { ...h, s, price, changePct, mv, dayGain, costTotal, totalGain, totalPct };
  });

  const totalValue   = rows.reduce((a, r) => a + (r.mv ?? 0), 0);
  const totalDay     = rows.reduce((a, r) => a + (r.dayGain ?? 0), 0);
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
              const portPct    = totalValue > 0 && r.mv != null ? (r.mv / totalValue) * 100 : null;
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
    const s         = portfolioData[h.ticker];
    const price     = s?.price ?? null;
    const mv        = price != null ? h.shares * price : null;
    const costTotal = h.costBasis ? h.shares * h.costBasis : null;
    const gain      = mv != null && costTotal ? mv - costTotal : null;
    const gainPct   = gain != null && costTotal ? (gain / costTotal) * 100 : null;
    return { ...h, s, mv, costTotal, gain, gainPct };
  });

  const totalValue   = rows.reduce((a, r) => a + (r.mv ?? 0), 0);
  const totalCost    = rows.reduce((a, r) => a + (r.costTotal ?? 0), 0);
  const totalGain    = totalCost > 0 ? totalValue - totalCost : null;
  const totalPct     = totalGain != null && totalCost > 0 ? (totalGain / totalCost) * 100 : null;

  const sorted = rows.filter((r) => r.gainPct != null).sort((a, b) => (b.gainPct ?? 0) - (a.gainPct ?? 0));
  const maxAbs = Math.max(...sorted.map((r) => Math.abs(r.gain ?? 0)), 1);

  const barData = sorted.map((r) => ({
    ticker:  r.ticker,
    pct:     parseFloat((r.gainPct ?? 0).toFixed(2)),
    gain:    r.gain ?? 0,
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
          { label: "Portfolio Value",  val: fmt(totalValue),    pct: null,      color: "var(--kite-heading)" },
          { label: "Unrealized Gain",  val: totalGain != null ? `${pnlSign(totalGain)}${fmt(totalGain)}` : "—",  pct: totalPct,  color: pnlColor(totalGain) },
          { label: "Total Return",     val: totalPct != null ? `${pnlSign(totalPct)}${totalPct.toFixed(2)}%` : "—", pct: null, color: pnlColor(totalPct) },
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
  Earnings:  ["earnings", "revenue", "profit", "loss", "eps", "quarter", "guidance", "beat", "miss", "income", "sales"],
  Dividends: ["dividend", "payout", "yield", "distribution", "ex-dividend"],
  Insider:   ["insider", "purchase", "sold shares", "executive", "officer", "director", "form 4"],
  Risk:      ["lawsuit", "investigation", "sec", "fraud", "risk", "downgrade", "recall", "fine", "penalty", "probe"],
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
  const [news, setNews]       = useState([]);
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
            const cat    = categorize(item);
            const ticker = item.tickers?.[0];
            const stock  = ticker ? portfolioData[ticker] : null;
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
        Dividend forecasting and income tracking is coming soon. We're working on integrating dividend data into the pipeline.
      </div>
    </div>
  );
}

// ─── Analysis Tab ─────────────────────────────────────────────────────────────
function AnalysisTab({ holdings, portfolioData }) {
  const rows = holdings.map((h) => {
    const s  = portfolioData[h.ticker];
    const mv = s?.price != null ? h.shares * s.price : null;
    return { ...h, s, mv };
  });

  const totalMV = rows.reduce((a, r) => a + (r.mv ?? 0), 0);

  const donutData = rows
    .filter((r) => r.mv != null && r.mv > 0)
    .map((r) => ({ name: r.ticker, value: parseFloat(((r.mv / totalMV) * 100).toFixed(1)) }))
    .sort((a, b) => b.value - a.value);

  // Gauge scores
  const withPE   = rows.filter((r) => r.s?.pe_ratio != null && r.mv);
  const wPEtotal = withPE.reduce((a, r) => a + r.mv, 0);
  const avgPE    = wPEtotal > 0 ? withPE.reduce((a, r) => a + r.s.pe_ratio * r.mv, 0) / wPEtotal : null;
  const valuationScore = avgPE != null ? clamp(Math.round(100 - avgPE * 2), 5, 95) : 50;

  const withBeta   = rows.filter((r) => r.s?.beta != null && r.mv);
  const wBtotal    = withBeta.reduce((a, r) => a + r.mv, 0);
  const avgBeta    = wBtotal > 0 ? withBeta.reduce((a, r) => a + r.s.beta * r.mv, 0) / wBtotal : null;
  const stabilityScore = avgBeta != null ? clamp(Math.round(100 - avgBeta * 35), 5, 95) : 50;

  const withReturn = rows.filter((r) => r.mv != null && r.costBasis);
  const totalCost  = withReturn.reduce((a, r) => a + r.shares * r.costBasis, 0);
  const totalGain  = withReturn.reduce((a, r) => a + (r.mv - r.shares * r.costBasis), 0);
  const retPct     = totalCost > 0 ? (totalGain / totalCost) * 100 : null;
  const performanceScore = retPct != null ? clamp(Math.round(50 + retPct), 5, 95) : 50;

  const n = donutData.length;
  const weights = donutData.map((d) => d.value / 100);
  const HHI = weights.reduce((a, w) => a + w * w, 0);
  const diversificationScore = n > 1 ? clamp(Math.round((1 - HHI) / (1 - 1 / n) * 100), 5, 95) : 5;

  const DonutTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: "12px" }}>
        <div style={{ fontWeight: "600", color: "var(--kite-heading)" }}>{d.name}</div>
        <div style={{ color: "var(--kite-muted)" }}>{d.value}%</div>
      </div>
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
    <div style={{ padding: "24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>

        {/* Diversification donut */}
        <div style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-md)", padding: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "2px" }}>Diversification</div>
          <div style={{ fontSize: "11px", color: "var(--kite-muted)", marginBottom: "16px" }}>By market value</div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <PieChart width={170} height={170}>
              <Pie data={donutData} cx={80} cy={80} innerRadius={48} outerRadius={76} dataKey="value" paddingAngle={2}>
                {donutData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              {donutData.slice(0, 8).map((d, i) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: "600", color: "var(--kite-amber-dark)", flex: 1 }}>{d.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--kite-muted)", fontFamily: "var(--font-mono)" }}>{d.value}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Portfolio health gauges */}
        <div style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-md)", padding: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "2px" }}>Portfolio Health</div>
          <div style={{ fontSize: "11px", color: "var(--kite-muted)", marginBottom: "16px" }}>Score out of 100</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 0", justifyItems: "center" }}>
            <GaugeChart score={valuationScore}      label="Valuation"       sublabel={avgPE != null ? `Avg P/E ${avgPE.toFixed(1)}` : "No P/E data"} />
            <GaugeChart score={performanceScore}    label="Performance"     sublabel={retPct != null ? `${pnlSign(retPct)}${retPct.toFixed(1)}% return` : "No cost basis"} />
            <GaugeChart score={stabilityScore}      label="Stability"       sublabel={avgBeta != null ? `β = ${avgBeta.toFixed(2)}` : "No beta data"} />
            <GaugeChart score={diversificationScore} label="Diversification" sublabel={`${n} holding${n !== 1 ? "s" : ""}`} />
          </div>
        </div>
      </div>

      {/* Per-holding stats grid */}
      <div style={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-md)", padding: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "16px" }}>Holdings Metrics</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "12px" }}>
          {rows.filter((r) => r.s).map((r) => (
            <div key={r.ticker} style={{ border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", padding: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <CompanyLogo ticker={r.ticker} size={24} />
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: "600", color: "var(--kite-amber-dark)" }}>{r.ticker}</div>
                  <div style={{ fontSize: "10px", color: "var(--kite-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.s.name}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 4px" }}>
                {[
                  ["Price",   `$${r.s.price?.toFixed(2) ?? "—"}`],
                  ["P/E",     r.s.pe_ratio?.toFixed(1) ?? "—"],
                  ["Beta",    r.s.beta?.toFixed(2) ?? "—"],
                  ["Mkt Cap", fmtShort(r.s.market_cap)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--kite-muted)" }}>{k}</div>
                    <div style={{ fontSize: "12px", color: "var(--kite-heading)", fontFamily: "var(--font-mono)" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Portfolios() {
  const { portfolios, activePortfolio, activeId, setActiveId, createPortfolio, deletePortfolio, renamePortfolio, replaceHoldings } = usePortfolios();
  const [activeTab, setActiveTab]           = useState("Holdings");
  const [portfolioData, setPortfolioData]   = useState({});
  const [drawerStock, setDrawerStock]       = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [creatingNew, setCreatingNew]       = useState(false);
  const [newName, setNewName]               = useState("");
  const [renamingId, setRenamingId]         = useState(null);
  const [renameVal, setRenameVal]           = useState("");

  const holdings = activePortfolio?.holdings || [];
  const tickers  = holdings.map((h) => h.ticker);

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
