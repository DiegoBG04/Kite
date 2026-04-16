/**
 * CompanyDrawer.jsx — Company Analytics Panel
 *
 * Tabs: Financials · Trends · News
 *
 * Financials — chart grid organized by Growth / Profitability / Financial Health,
 *              with Annual / Quarterly toggle. Includes OCF, FCF, Cash, Debt.
 * Trends     — scorecard view: each metric shows latest value, YoY %, direction
 *              arrow, and mini sparkline. Green = right direction, Red = concern.
 * News       — recent news feed for the company.
 */

import { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { getFinancials, getNews } from "../api/client";
import NewsCard from "./NewsCard";
import CompanyLogo from "./CompanyLogo";

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtBig(v) {
  if (v == null) return "—";
  const abs = Math.abs(v), sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(v, decimals = 1) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

function quarterLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `Q${Math.ceil((d.getMonth() + 1) / 3)} '${String(d.getFullYear()).slice(2)}`;
}
function yearLabel(dateStr) {
  if (!dateStr) return "";
  return String(new Date(dateStr).getFullYear());
}

const PRICE_PERIODS = ["1D", "1W", "1M", "3M", "6M", "1Y"];

// ── Derived margin series ────────────────────────────────────────────────────

function withMargins(periods) {
  return periods.map((p) => ({
    ...p,
    gross_margin:     p.revenue ? (p.gross_profit    / p.revenue) * 100 : null,
    operating_margin: p.revenue ? (p.operating_income / p.revenue) * 100 : null,
    net_margin:       p.revenue ? (p.net_income       / p.revenue) * 100 : null,
  }));
}

// YoY change % between index 0 (latest) and index 1 (prior year)
function yoy(arr, key) {
  const cur = arr[0]?.[key], prev = arr[1]?.[key];
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

// ── Shared sub-components ────────────────────────────────────────────────────

function NoData() {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--kite-border)", fontStyle: "italic" }}>
      No data available
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--kite-muted)", margin: "20px 0 10px", display: "flex", alignItems: "center", gap: "8px" }}>
      {children}
      <div style={{ flex: 1, height: "1px", background: "var(--kite-border)" }} />
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 18px",
        fontSize: "13px",
        fontWeight: active ? "600" : "400",
        color: active ? "var(--kite-amber-dark)" : "var(--kite-muted)",
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid var(--kite-amber-dark)" : "2px solid transparent",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// ── Chart components ─────────────────────────────────────────────────────────

function ChartCard({ title, latestValue, isKpi, children, fullWidth, span3 }) {
  return (
    <div style={{
      background: "var(--kite-surface)",
      border: "1px solid var(--kite-border)",
      borderRadius: "var(--radius-md)",
      padding: "14px 16px 10px",
      gridColumn: fullWidth ? "1 / -1" : span3 ? "span 1" : undefined,
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        {isKpi && (
          <span style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.06em", background: "var(--kite-amber-wash)", color: "var(--kite-amber-dark)", border: "1px solid var(--kite-border)", borderRadius: "4px", padding: "1px 5px" }}>
            KPI
          </span>
        )}
        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--kite-muted)", letterSpacing: "0.04em", flex: 1 }}>
          {title}
        </span>
        {latestValue != null && (
          <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--kite-heading)" }}>
            {latestValue}
          </span>
        )}
      </div>
      <div style={{ height: 140 }}>{children}</div>
    </div>
  );
}

function FinancialBar({ data, dataKey, color, labelFn, pct }) {
  if (!data || data.length === 0) return <NoData />;
  const chartData = data
    .filter((d) => d[dataKey] != null)
    .slice(0, 8)
    .reverse()
    .map((d) => ({ label: labelFn(d.date), value: d[dataKey] }));
  if (chartData.length === 0) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#B0A080", fontFamily: "var(--font-body)" }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", fontSize: "11px" }}
          formatter={(v) => [pct ? `${v.toFixed(1)}%` : fmtBig(v)]}
          labelStyle={{ color: "var(--kite-muted)", fontSize: "10px" }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.value < 0 ? "var(--kite-negative)" : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PriceChart({ chartData, period, onPeriodChange, isPositive }) {
  const strokeColor = isPositive ? "#2D6A4F" : "#B54040";
  const prices = chartData?.[period] || [];
  const data = prices.map((value, i) => ({ i, value }));
  return (
    <div>
      <div style={{ display: "flex", gap: "2px", marginBottom: "8px" }}>
        {PRICE_PERIODS.map((p) => (
          <button key={p} onClick={() => onPeriodChange(p)} style={{ fontSize: "10px", fontWeight: p === period ? "700" : "400", color: p === period ? "var(--kite-amber-dark)" : "var(--kite-muted)", background: p === period ? "var(--kite-amber-wash)" : "transparent", border: "none", borderRadius: "var(--radius-sm)", padding: "3px 7px", cursor: "pointer" }}>
            {p}
          </button>
        ))}
      </div>
      <div style={{ height: 140 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <XAxis hide />
              <YAxis domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(0)}`} tick={{ fontSize: 9, fill: "#B0A080" }} axisLine={false} tickLine={false} width={40} orientation="right" />
              <Tooltip contentStyle={{ background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", fontSize: "11px" }} formatter={(v) => [`$${v.toFixed(2)}`]} labelFormatter={() => ""} />
              <Line type="monotone" dataKey="value" stroke={strokeColor} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : <NoData />}
      </div>
    </div>
  );
}

// ── Trends tab components ────────────────────────────────────────────────────

function TrendSparkline({ data, dataKey, goodIfPositive = true }) {
  if (!data || data.length === 0) return <NoData />;
  const points = data
    .filter((d) => d[dataKey] != null)
    .slice(0, 6)
    .reverse()
    .map((d, i) => ({ i, value: d[dataKey] }));
  if (points.length < 2) return <NoData />;

  const latest = points[points.length - 1].value;
  const first  = points[0].value;
  const up     = latest >= first;
  const good   = goodIfPositive ? up : !up;
  const color  = good ? "#2D6A4F" : "#B54040";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis hide />
        <YAxis hide domain={["auto", "auto"]} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#sg-${dataKey})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrendTile({ label, value, yoyPct, data, dataKey, goodIfPositive = true, pct = false }) {
  const hasYoy = yoyPct != null;
  const up     = hasYoy && yoyPct >= 0;
  // "good" means the direction aligns with what's healthy for this metric
  const good   = hasYoy ? (goodIfPositive ? up : !up) : null;
  const yoyColor = good === true ? "var(--kite-positive)" : good === false ? "var(--kite-negative)" : "var(--kite-muted)";

  return (
    <div style={{
      background: "var(--kite-surface)",
      border: "1px solid var(--kite-border)",
      borderRadius: "var(--radius-md)",
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: 0,
    }}>
      <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--kite-muted)" }}>
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: "500", color: "var(--kite-heading)", lineHeight: 1.1 }}>
        {value}
      </div>
      {hasYoy && (
        <div style={{ fontSize: "12px", color: yoyColor, fontWeight: "500", display: "flex", alignItems: "center", gap: "3px" }}>
          {up ? "↑" : "↓"} {Math.abs(yoyPct).toFixed(1)}% YoY
        </div>
      )}
      {!hasYoy && (
        <div style={{ fontSize: "11px", color: "var(--kite-border)" }}>no prior year</div>
      )}
      <div style={{ height: 52, marginTop: "6px" }}>
        <TrendSparkline data={data} dataKey={dataKey} goodIfPositive={goodIfPositive} />
      </div>
    </div>
  );
}

// ── Tab content ──────────────────────────────────────────────────────────────

function FinancialsTab({ stock, financials, finPeriod, setFinPeriod, pricePeriod, setPricePeriod, isPositive }) {
  const rawData = (financials?.[finPeriod] ?? []);
  const finData = withMargins(rawData);
  const labelFn = finPeriod === "quarterly" ? quarterLabel : yearLabel;

  const latest = finData[0] ?? {};

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      {/* Period toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <div style={{ display: "flex", background: "var(--kite-surface)", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          {[["annual", "Annual"], ["quarterly", "Quarterly"]].map(([val, label]) => (
            <button key={val} onClick={() => setFinPeriod(val)} style={{ fontSize: "11px", fontWeight: finPeriod === val ? "700" : "400", color: finPeriod === val ? "var(--kite-amber-dark)" : "var(--kite-muted)", background: finPeriod === val ? "var(--kite-amber-wash)" : "transparent", border: "none", padding: "5px 14px", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Price — always full width */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginBottom: "0" }}>
        <ChartCard title="Price" latestValue={`$${stock.price?.toFixed(2)}`} fullWidth>
          <PriceChart chartData={stock.chart_data} period={pricePeriod} onPeriodChange={setPricePeriod} isPositive={isPositive} />
        </ChartCard>
      </div>

      {/* Growth */}
      <SectionLabel>Growth</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <ChartCard title="Revenue" latestValue={fmtBig(latest.revenue)} isKpi>
          <FinancialBar data={finData} dataKey="revenue" color="#F5A623" labelFn={labelFn} />
        </ChartCard>
        <ChartCard title="Gross Profit" latestValue={fmtBig(latest.gross_profit)} isKpi>
          <FinancialBar data={finData} dataKey="gross_profit" color="#C47D0A" labelFn={labelFn} />
        </ChartCard>
        <ChartCard title="Operating Income" latestValue={fmtBig(latest.operating_income)} isKpi>
          <FinancialBar data={finData} dataKey="operating_income" color="#5B8DB8" labelFn={labelFn} />
        </ChartCard>
        <ChartCard title="Net Income" latestValue={fmtBig(latest.net_income)} isKpi>
          <FinancialBar data={finData} dataKey="net_income" color="#2D6A4F" labelFn={labelFn} />
        </ChartCard>
        <ChartCard title="Free Cash Flow" latestValue={fmtBig(latest.free_cash_flow)} isKpi fullWidth>
          <FinancialBar data={finData} dataKey="free_cash_flow" color="#7B5EA7" labelFn={labelFn} />
        </ChartCard>
      </div>

      {/* Profitability */}
      <SectionLabel>Profitability</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        <ChartCard title="Gross Margin" latestValue={latest.gross_margin != null ? `${latest.gross_margin.toFixed(1)}%` : null} isKpi>
          <FinancialBar data={finData} dataKey="gross_margin" color="#C47D0A" labelFn={labelFn} pct />
        </ChartCard>
        <ChartCard title="Operating Margin" latestValue={latest.operating_margin != null ? `${latest.operating_margin.toFixed(1)}%` : null} isKpi>
          <FinancialBar data={finData} dataKey="operating_margin" color="#5B8DB8" labelFn={labelFn} pct />
        </ChartCard>
        <ChartCard title="Net Margin" latestValue={latest.net_margin != null ? `${latest.net_margin.toFixed(1)}%` : null} isKpi>
          <FinancialBar data={finData} dataKey="net_margin" color="#2D6A4F" labelFn={labelFn} pct />
        </ChartCard>
      </div>

      {/* Financial Health */}
      <SectionLabel>Financial Health</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        <ChartCard title="Operating Cash Flow" latestValue={fmtBig(latest.operating_cash_flow)} isKpi>
          <FinancialBar data={finData} dataKey="operating_cash_flow" color="#4A90D9" labelFn={labelFn} />
        </ChartCard>
        <ChartCard title="Cash & Equivalents" latestValue={fmtBig(latest.cash_and_equivalents)}>
          <FinancialBar data={finData} dataKey="cash_and_equivalents" color="#27AE60" labelFn={labelFn} />
        </ChartCard>
        <ChartCard title="Total Debt" latestValue={fmtBig(latest.total_debt)}>
          <FinancialBar data={finData} dataKey="total_debt" color="#E74C3C" labelFn={labelFn} />
        </ChartCard>
      </div>
    </div>
  );
}

function TrendsTab({ financials }) {
  const annual = withMargins(financials?.annual ?? []);
  const hasData = annual.length > 0;

  if (!hasData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "240px", gap: "8px", color: "var(--kite-muted)" }}>
        <div style={{ fontSize: "24px", opacity: 0.3 }}>◈</div>
        <div style={{ fontSize: "13px" }}>No financial data yet</div>
        <div style={{ fontSize: "12px", opacity: 0.7 }}>Run /ingest for this ticker to populate trends</div>
      </div>
    );
  }

  const metrics = {
    growth: [
      { label: "Revenue",          key: "revenue",             goodIfPositive: true  },
      { label: "Gross Profit",     key: "gross_profit",        goodIfPositive: true  },
      { label: "Operating Income", key: "operating_income",    goodIfPositive: true  },
      { label: "Net Income",       key: "net_income",          goodIfPositive: true  },
      { label: "Free Cash Flow",   key: "free_cash_flow",      goodIfPositive: true  },
    ],
    profitability: [
      { label: "Gross Margin",     key: "gross_margin",        goodIfPositive: true,  pct: true },
      { label: "Operating Margin", key: "operating_margin",    goodIfPositive: true,  pct: true },
      { label: "Net Margin",       key: "net_margin",          goodIfPositive: true,  pct: true },
    ],
    health: [
      { label: "Operating Cash Flow", key: "operating_cash_flow", goodIfPositive: true  },
      { label: "Cash & Equivalents",  key: "cash_and_equivalents", goodIfPositive: true  },
      { label: "Total Debt",          key: "total_debt",           goodIfPositive: false }, // lower is better
    ],
  };

  function renderSection(title, items, cols = 2) {
    return (
      <>
        <SectionLabel>{title}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "12px" }}>
          {items.map(({ label, key, goodIfPositive, pct }) => {
            const latest  = annual[0]?.[key];
            const yoyPct  = yoy(annual, key);
            const display = latest == null ? "—"
              : pct ? `${latest.toFixed(1)}%`
              : fmtBig(latest);
            return (
              <TrendTile
                key={key}
                label={label}
                value={display}
                yoyPct={yoyPct}
                data={annual}
                dataKey={key}
                goodIfPositive={goodIfPositive}
                pct={pct}
              />
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <div style={{ fontSize: "12px", color: "var(--kite-muted)", marginBottom: "4px" }}>
        Annual data · <span style={{ color: "var(--kite-positive)" }}>↑ Green</span> = right direction · <span style={{ color: "var(--kite-negative)" }}>↓ Red</span> = concern
      </div>
      {renderSection("Growth", metrics.growth, 3)}
      {renderSection("Profitability", metrics.profitability, 3)}
      {renderSection("Financial Health", metrics.health, 3)}
    </div>
  );
}

function NewsTab({ news, newsLoading, portfolioData }) {
  return (
    <div style={{ padding: "20px 24px 40px" }}>
      {newsLoading && <div style={{ fontSize: "12px", color: "var(--kite-muted)", padding: "12px 0" }}>Loading…</div>}
      {!newsLoading && news.length === 0 && <div style={{ fontSize: "12px", color: "var(--kite-muted)", padding: "12px 0" }}>No recent news found.</div>}
      {news.map((article, i) => (
        <NewsCard
          key={i}
          title={article.title}
          source={article.source}
          publishedAt={article.published_at}
          tickers={article.tickers}
          summary={article.summary}
          url={article.url}
          imageUrl={article.image_url}
          portfolioData={portfolioData}
        />
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CompanyDrawer({ stock, onClose, portfolioData = {} }) {
  const [activeTab,    setActiveTab]    = useState("financials");
  const [pricePeriod,  setPricePeriod]  = useState("1M");
  const [finPeriod,    setFinPeriod]    = useState("annual");
  const [financials,   setFinancials]   = useState(null);
  const [news,         setNews]         = useState([]);
  const [newsLoading,  setNewsLoading]  = useState(false);
  const [expanded,     setExpanded]     = useState(false);

  useEffect(() => {
    if (!stock) { setExpanded(false); return; }
    setActiveTab("financials");
    setPricePeriod("1M");
    setFinancials(null);
    setNews([]);

    getFinancials(stock.ticker)
      .then(setFinancials)
      .catch(() => setFinancials({ quarterly: [], annual: [] }));

    setNewsLoading(true);
    getNews({ tickers: [stock.ticker], filter: "portfolio" })
      .then((r) => setNews(r.items.slice(0, 6)))
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, [stock?.ticker]);

  const isOpen     = !!stock;
  const isPositive = (stock?.change_pct ?? 0) >= 0;
  const changeColor = isPositive ? "var(--kite-positive)" : "var(--kite-negative)";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(61, 46, 15, 0.2)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
          zIndex: 100,
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: expanded ? "100vw" : "min(82vw, 1080px)",
        background: "var(--kite-cream)",
        borderLeft: "1px solid var(--kite-border)",
        boxShadow: "-6px 0 32px rgba(61, 46, 15, 0.12)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)",
        zIndex: 101,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Expand / collapse */}
        {stock && (
          <button
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? "Minimize" : "Maximize"}
            style={{
              position: "absolute", top: 0, left: 0,
              width: "34px", height: "34px",
              background: "var(--kite-surface)",
              border: "none",
              borderRight: "1px solid var(--kite-border)",
              borderBottom: "1px solid var(--kite-border)",
              borderBottomRightRadius: "var(--radius-sm)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--kite-muted)", fontSize: "13px", zIndex: 10,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--kite-amber-wash)"; e.currentTarget.style.color = "var(--kite-amber-dark)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--kite-surface)"; e.currentTarget.style.color = "var(--kite-muted)"; }}
          >
            {expanded ? "↘" : "↖"}
          </button>
        )}

        {stock && (
          <>
            {/* ── Header ── */}
            <div style={{
              background: "var(--kite-surface)",
              borderBottom: "1px solid var(--kite-border)",
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexShrink: 0,
            }}>
              <CompanyLogo ticker={stock.ticker} size={42} radius="var(--radius-md)" />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "17px", color: "var(--kite-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stock.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--kite-amber-dark)", letterSpacing: "0.06em" }}>{stock.ticker}</span>
                  {stock.yahoo_url && (
                    <a href={stock.yahoo_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: "10px", color: "var(--kite-muted)", textDecoration: "none" }}>
                      Yahoo ↗
                    </a>
                  )}
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "22px", fontWeight: "500", color: "var(--kite-heading)", lineHeight: 1.1 }}>${stock.price?.toFixed(2)}</div>
                <div style={{ fontSize: "13px", color: changeColor, marginTop: "2px" }}>{isPositive ? "+" : ""}{stock.change_pct?.toFixed(2)}%</div>
              </div>

              <div style={{ display: "flex", gap: "20px", paddingLeft: "20px", borderLeft: "1px solid var(--kite-border)", flexShrink: 0 }}>
                {[
                  { label: "P/E",     value: stock.pe_ratio      != null ? stock.pe_ratio.toFixed(1)                                        : "—" },
                  { label: "Rev YoY", value: stock.revenue_change != null ? `${stock.revenue_change > 0 ? "+" : ""}${stock.revenue_change.toFixed(1)}%` : "—" },
                  { label: "Mkt Cap", value: stock.market_cap     != null ? fmtBig(stock.market_cap)                                         : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.07em", color: "var(--kite-muted)", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ fontSize: "13px", color: "var(--kite-heading)", marginTop: "2px" }}>{value}</div>
                  </div>
                ))}
              </div>

              <button onClick={onClose} style={{ background: "none", border: "1px solid var(--kite-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--kite-muted)", fontSize: "16px", lineHeight: 1, padding: "4px 8px", flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {/* ── Tab bar ── */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--kite-border)", background: "var(--kite-surface)", paddingLeft: "24px", flexShrink: 0 }}>
              <TabButton active={activeTab === "financials"} onClick={() => setActiveTab("financials")}>Financials</TabButton>
              <TabButton active={activeTab === "trends"}    onClick={() => setActiveTab("trends")}>Trends</TabButton>
              <TabButton active={activeTab === "news"}      onClick={() => setActiveTab("news")}>News</TabButton>
            </div>

            {/* ── Tab content ── */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {activeTab === "financials" && (
                <FinancialsTab
                  stock={stock}
                  financials={financials}
                  finPeriod={finPeriod}
                  setFinPeriod={setFinPeriod}
                  pricePeriod={pricePeriod}
                  setPricePeriod={setPricePeriod}
                  isPositive={isPositive}
                />
              )}
              {activeTab === "trends" && (
                <TrendsTab financials={financials} />
              )}
              {activeTab === "news" && (
                <NewsTab news={news} newsLoading={newsLoading} portfolioData={portfolioData} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
