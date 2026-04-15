/**
 * CompanyDrawer.jsx — Qualrum-style Company Analytics Panel
 *
 * Slides in from the right. Contains:
 *   - Company header (badge, name, price, change)
 *   - Annual / Quarterly toggle
 *   - 2-column chart grid: Price, Revenue, Gross Profit, EBITDA, Net Income
 *   - Recent news feed
 */

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { getFinancials, getNews } from "../api/client";
import NewsCard from "./NewsCard";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

function quarterLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q} '${String(d.getFullYear()).slice(2)}`;
}

function yearLabel(dateStr) {
  if (!dateStr) return "";
  return String(new Date(dateStr).getFullYear());
}

const PRICE_PERIODS = ["1D", "1W", "1M", "3M", "6M", "1Y"];

const CHART_COLORS = {
  revenue:     "#F5A623",
  grossProfit: "#C47D0A",
  ebitda:      "#5B8DB8",
  netIncome:   "#2D6A4F",
};

// ── ChartCard ────────────────────────────────────────────────────────────────

function ChartCard({ title, latestValue, isKpi, children, fullWidth }) {
  return (
    <div style={{
      background: "var(--kite-surface)",
      border: "1px solid var(--kite-border)",
      borderRadius: "var(--radius-md)",
      padding: "14px 16px 10px",
      gridColumn: fullWidth ? "1 / -1" : undefined,
      minWidth: 0,
    }}>
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        {isKpi && (
          <span style={{
            fontSize: "9px",
            fontWeight: "700",
            letterSpacing: "0.06em",
            background: "var(--kite-amber-wash)",
            color: "var(--kite-amber-dark)",
            border: "1px solid var(--kite-border)",
            borderRadius: "4px",
            padding: "1px 5px",
          }}>
            KPI
          </span>
        )}
        <span style={{
          fontSize: "11px",
          fontWeight: "600",
          color: "var(--kite-muted)",
          letterSpacing: "0.04em",
          flex: 1,
        }}>
          {title}
        </span>
        {latestValue != null && (
          <span style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "var(--kite-heading)",
            fontFamily: "var(--font-display)",
          }}>
            {latestValue}
          </span>
        )}
        <span style={{ fontSize: "13px", color: "var(--kite-border)", cursor: "default" }}>↗</span>
      </div>

      {/* Chart area */}
      <div style={{ height: 160 }}>
        {children}
      </div>
    </div>
  );
}

// ── NoData placeholder ───────────────────────────────────────────────────────

function NoData() {
  return (
    <div style={{
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      color: "var(--kite-border)",
      fontStyle: "italic",
    }}>
      No data available
    </div>
  );
}

// ── FinancialBar ─────────────────────────────────────────────────────────────

function FinancialBar({ data, dataKey, color, labelFn }) {
  if (!data || data.length === 0) return <NoData />;

  const chartData = data
    .filter((d) => d[dataKey] != null)
    .map((d) => ({ label: labelFn(d.date), value: d[dataKey] }));

  if (chartData.length === 0) return <NoData />;

  const isNeg = (v) => v < 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: "#B0A080", fontFamily: "var(--font-body)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: "var(--kite-surface)",
            border: "1px solid var(--kite-border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "11px",
            color: "var(--kite-heading)",
          }}
          formatter={(v) => [fmt(v)]}
          labelStyle={{ color: "var(--kite-muted)", fontSize: "10px" }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={isNeg(entry.value) ? "var(--kite-negative)" : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── PriceChart ───────────────────────────────────────────────────────────────

function PriceChart({ chartData, period, onPeriodChange, isPositive }) {
  const strokeColor = isPositive ? "#2D6A4F" : "#B54040";
  const prices = chartData?.[period] || [];
  const data = prices.map((value, i) => ({ i, value }));

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: "flex", gap: "2px", marginBottom: "8px" }}>
        {PRICE_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            style={{
              fontSize: "10px",
              fontWeight: p === period ? "700" : "400",
              color: p === period ? "var(--kite-amber-dark)" : "var(--kite-muted)",
              background: p === period ? "var(--kite-amber-wash)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "3px 7px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height: 160 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <XAxis hide />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                tick={{ fontSize: 9, fill: "#B0A080" }}
                axisLine={false}
                tickLine={false}
                width={40}
                orientation="right"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--kite-surface)",
                  border: "1px solid var(--kite-border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "11px",
                }}
                formatter={(v) => [`$${v.toFixed(2)}`]}
                labelFormatter={() => ""}
              />
              <Line type="monotone" dataKey="value" stroke={strokeColor} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <NoData />
        )}
      </div>
    </div>
  );
}

// ── CompanyDrawer ────────────────────────────────────────────────────────────

export default function CompanyDrawer({ stock, onClose, portfolioData = {} }) {
  const [pricePeriod, setPricePeriod] = useState("1M");
  const [finPeriod, setFinPeriod] = useState("annual");  // "annual" | "quarterly"
  const [financials, setFinancials] = useState(null);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (!stock) return;
    setPricePeriod("1M");
    setFinancials(null);
    setNews([]);

    // Fetch financials
    getFinancials(stock.ticker)
      .then(setFinancials)
      .catch(() => setFinancials({ quarterly: [], annual: [] }));

    // Fetch news
    setNewsLoading(true);
    getNews({ tickers: [stock.ticker], filter: "portfolio" })
      .then((r) => setNews(r.items.slice(0, 4)))
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, [stock?.ticker]);

  const isOpen = !!stock;
  const isPositive = (stock?.change_pct ?? 0) >= 0;
  const changeColor = isPositive ? "var(--kite-positive)" : "var(--kite-negative)";

  const finData = financials?.[finPeriod] ?? [];
  const labelFn = finPeriod === "quarterly" ? quarterLabel : yearLabel;

  const latestRevenue = finData.find((d) => d.revenue != null)?.revenue ?? null;
  const latestNetIncome = finData.find((d) => d.net_income != null)?.net_income ?? null;
  const latestEbitda = finData.find((d) => d.ebitda != null)?.ebitda ?? null;
  const latestGross = finData.find((d) => d.gross_profit != null)?.gross_profit ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(61, 46, 15, 0.2)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
          zIndex: 100,
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(82vw, 980px)",
        background: "var(--kite-cream)",
        borderLeft: "1px solid var(--kite-border)",
        boxShadow: "-6px 0 32px rgba(61, 46, 15, 0.12)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 101,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
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
              {/* Company badge */}
              <div style={{
                width: 42,
                height: 42,
                borderRadius: "var(--radius-md)",
                background: "var(--kite-amber-wash)",
                border: "1px solid var(--kite-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                fontWeight: "700",
                color: "var(--kite-amber-dark)",
                flexShrink: 0,
              }}>
                {stock.ticker.slice(0, 2)}
              </div>

              {/* Name + ticker */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "17px",
                  color: "var(--kite-heading)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {stock.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--kite-amber-dark)",
                    letterSpacing: "0.06em",
                  }}>
                    {stock.ticker}
                  </span>
                  {stock.yahoo_url && (
                    <a
                      href={stock.yahoo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: "10px",
                        color: "var(--kite-muted)",
                        textDecoration: "none",
                      }}
                    >
                      Yahoo ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Price + change */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  fontSize: "22px",
                  fontWeight: "500",
                  color: "var(--kite-heading)",
                  lineHeight: 1.1,
                }}>
                  ${stock.price?.toFixed(2)}
                </div>
                <div style={{ fontSize: "13px", color: changeColor, marginTop: "2px" }}>
                  {isPositive ? "+" : ""}{stock.change_pct?.toFixed(2)}%
                </div>
              </div>

              {/* Metrics row */}
              <div style={{
                display: "flex",
                gap: "20px",
                paddingLeft: "20px",
                borderLeft: "1px solid var(--kite-border)",
                flexShrink: 0,
              }}>
                {[
                  { label: "P/E", value: stock.pe_ratio != null ? stock.pe_ratio.toFixed(1) : "—" },
                  { label: "Rev YoY", value: stock.revenue_change != null ? `${stock.revenue_change > 0 ? "+" : ""}${stock.revenue_change.toFixed(1)}%` : "—" },
                  { label: "Filings", value: stock.last_filing ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.07em", color: "var(--kite-muted)", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ fontSize: "13px", color: "var(--kite-heading)", fontFamily: "var(--font-display)", marginTop: "2px" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "1px solid var(--kite-border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  color: "var(--kite-muted)",
                  fontSize: "16px",
                  lineHeight: 1,
                  padding: "4px 8px",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 32px" }}>

              {/* Financial period toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <span style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", color: "var(--kite-muted)", textTransform: "uppercase" }}>
                  Financials
                </span>
                <div style={{
                  display: "flex",
                  background: "var(--kite-surface)",
                  border: "1px solid var(--kite-border)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                }}>
                  {[["annual", "Annual"], ["quarterly", "Quarterly"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setFinPeriod(val)}
                      style={{
                        fontSize: "11px",
                        fontWeight: finPeriod === val ? "700" : "400",
                        color: finPeriod === val ? "var(--kite-amber-dark)" : "var(--kite-muted)",
                        background: finPeriod === val ? "var(--kite-amber-wash)" : "transparent",
                        border: "none",
                        padding: "5px 14px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Chart grid ── */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "24px",
              }}>
                {/* Price — full width */}
                <ChartCard
                  title="Price"
                  latestValue={`$${stock.price?.toFixed(2)}`}
                  fullWidth
                >
                  <PriceChart
                    chartData={stock.chart_data}
                    period={pricePeriod}
                    onPeriodChange={setPricePeriod}
                    isPositive={isPositive}
                  />
                </ChartCard>

                {/* Revenue */}
                <ChartCard title="Revenue" latestValue={latestRevenue != null ? fmt(latestRevenue) : null} isKpi>
                  <FinancialBar
                    data={finData}
                    dataKey="revenue"
                    color={CHART_COLORS.revenue}
                    labelFn={labelFn}
                  />
                </ChartCard>

                {/* Net Income */}
                <ChartCard title="Net Income" latestValue={latestNetIncome != null ? fmt(latestNetIncome) : null} isKpi>
                  <FinancialBar
                    data={finData}
                    dataKey="net_income"
                    color={CHART_COLORS.netIncome}
                    labelFn={labelFn}
                  />
                </ChartCard>

                {/* EBITDA */}
                <ChartCard title="EBITDA" latestValue={latestEbitda != null ? fmt(latestEbitda) : null} isKpi>
                  <FinancialBar
                    data={finData}
                    dataKey="ebitda"
                    color={CHART_COLORS.ebitda}
                    labelFn={labelFn}
                  />
                </ChartCard>

                {/* Gross Profit */}
                <ChartCard title="Gross Profit" latestValue={latestGross != null ? fmt(latestGross) : null} isKpi>
                  <FinancialBar
                    data={finData}
                    dataKey="gross_profit"
                    color={CHART_COLORS.grossProfit}
                    labelFn={labelFn}
                  />
                </ChartCard>
              </div>

              {/* ── News ── */}
              <div style={{
                fontSize: "10px",
                fontWeight: "700",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--kite-muted)",
                marginBottom: "4px",
              }}>
                Recent News
              </div>

              {newsLoading && (
                <div style={{ fontSize: "12px", color: "var(--kite-muted)", padding: "12px 0" }}>Loading…</div>
              )}
              {!newsLoading && news.length === 0 && (
                <div style={{ fontSize: "12px", color: "var(--kite-muted)", padding: "12px 0" }}>No recent news found.</div>
              )}
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
          </>
        )}
      </div>
    </>
  );
}
