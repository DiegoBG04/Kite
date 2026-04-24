/**
 * Market.jsx — Market Overview & Market Movers
 * Real data: US Indices, Sector ETFs, Market News, Normalized Performance chart
 * Simulated (*): Currencies, Global Markets, Commodities, Fixed Income, Market Movers
 */
import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { getQuotes, getPortfolioHistory, getNews } from "../api/client";

// ─── Maps ─────────────────────────────────────────────────────────────────────
const INDEX_NAMES  = { SPY:"S&P 500", QQQ:"Nasdaq 100", DIA:"Dow Jones", IWM:"Russell 2000" };
const SECTOR_NAMES = { XLE:"Energy", XLK:"Technology", XLF:"Financials", XLP:"Cons. Staples", XLY:"Cons. Discretionary", XLB:"Materials", XLV:"Health Care", XLC:"Communications", XLI:"Industrials", XLU:"Utilities", XLRE:"Real Estate" };
const SECTOR_ORDER = ["XLE","XLK","XLF","XLP","XLY","XLB","XLV","XLC","XLI","XLU","XLRE"];
const INDEX_ORDER  = ["QQQ","DIA","SPY","IWM"];

// ─── Mock / Simulated data ────────────────────────────────────────────────────
const MOCK_VIX = { name:"CBOE VIX", price:19.32, changePct:2.4 };

const MOCK_FIXED = [
  { cat:"Govt Credit ETFs", items:[
    { name:"Municipals",      price:107.24, changePct:-0.2, ytd:"-1.8%", oneY:"-0.4%" },
    { name:"T.I.P.S",        price:111.22, changePct:-0.2, ytd:"-0.9%", oneY:" 2.1%" },
    { name:"U.S. Treasuries", price:22.90,  changePct:-0.3, ytd:"-2.4%", oneY:"-1.2%" },
  ]},
  { cat:"Corp Credit ETFs", items:[
    { name:"High Yield",   price:80.37,  changePct:-0.3, ytd:"-1.1%", oneY:" 5.2%" },
    { name:"High Grade",   price:109.61, changePct:-0.4, ytd:"-2.2%", oneY:" 1.8%" },
    { name:"Convertibles", price:99.90,  changePct:-0.3, ytd:"-3.4%", oneY:" 4.1%" },
  ]},
  { cat:"International", items:[
    { name:"Intl Govt Bond", price:52.34, changePct:-0.5, ytd:"-1.4%", oneY:" 0.9%" },
    { name:"EM Bonds",       price:97.12, changePct:-0.6, ytd:"-2.0%", oneY:" 3.4%" },
  ]},
];

const MOCK_CURRENCIES = [
  { name:"Bitcoin",       price:77471.49, changePct: 2.4, ytd:" 8.2%", high52:109231, low52:49221 },
  { name:"British Pound", price:1.3509,   changePct: 0.0, ytd:" 4.1%", high52:1.3880, low52:1.2299 },
  { name:"Euro",          price:1.1740,   changePct: 0.0, ytd:" 7.8%", high52:1.1810, low52:1.0176 },
  { name:"Japanese Yen",  price:159.33,   changePct: 0.0, ytd:"-8.4%", high52:161.95, low52:139.58 },
];
const MOCK_CURRENCIES_EXT = [
  ...MOCK_CURRENCIES,
  { name:"Australian Dollar", price:0.6412, changePct:-0.3, ytd:"-1.2%", high52:0.6942, low52:0.5987 },
  { name:"Canadian Dollar",   price:1.3841, changePct:-0.1, ytd:"-2.1%", high52:1.4044, low52:1.3419 },
  { name:"Swiss Franc",       price:0.8821, changePct: 0.2, ytd:" 5.4%", high52:0.9236, low52:0.8374 },
  { name:"NZ Dollar",         price:0.5932, changePct:-0.2, ytd:"-3.1%", high52:0.6378, low52:0.5567 },
  { name:"Chinese Yuan",      price:7.2918, changePct: 0.1, ytd:" 0.3%", high52:7.3748, low52:7.0870 },
  { name:"Ethereum",          price:1584.21,changePct: 1.8, ytd:"-42.1%",high52:4107.00,low52:1385 },
];

const MOCK_GLOBAL = [
  { cat:"Broad Markets", items:[
    { name:"Developed Blend", price:148.74, changePct:-1.1, ytd:"-3.2%", oneY:" 5.1%" },
    { name:"Emerging",        price:62.25,  changePct:-1.5, ytd:"-4.8%", oneY:" 1.2%" },
    { name:"Developed",       price:101.63, changePct:-2.2, ytd:"-8.1%", oneY:"-2.4%" },
  ]},
  { cat:"Developed Markets", items:[
    { name:"Australia",      price:29.48,  changePct:-1.9, ytd:"-3.1%", oneY:" 4.2%" },
    { name:"Germany",        price:42.06,  changePct:-2.2, ytd:"-9.4%", oneY:" 1.8%" },
    { name:"United Kingdom", price:46.94,  changePct:-2.2, ytd:"-5.2%", oneY:" 3.1%" },
    { name:"France",         price:45.36,  changePct:-2.4, ytd:"-8.7%", oneY:"-0.4%" },
    { name:"Japan",          price:87.14,  changePct:-2.5, ytd:"-6.8%", oneY:"-1.2%" },
    { name:"Switzerland",    price:54.21,  changePct:-1.4, ytd:"-4.3%", oneY:" 2.8%" },
    { name:"Canada",         price:38.92,  changePct:-1.1, ytd:"-5.1%", oneY:" 1.4%" },
  ]},
  { cat:"Emerging Markets", items:[
    { name:"Brazil",       price:40.79,  changePct:-1.2, ytd:"-8.9%", oneY:"-4.2%" },
    { name:"China",        price:37.11,  changePct:-1.5, ytd:"-6.1%", oneY:"-8.4%" },
    { name:"India",        price:43.47,  changePct:-1.6, ytd:"-5.4%", oneY:" 2.1%" },
    { name:"South Korea",  price:146.79, changePct:-2.2, ytd:"-9.2%", oneY:"-4.8%" },
    { name:"Mexico",       price:78.00,  changePct:-2.4, ytd:"-12.1%",oneY:"-7.3%" },
    { name:"South Africa", price:71.03,  changePct:-3.6, ytd:"-14.2%",oneY:"-9.1%" },
    { name:"Taiwan",       price:84.12,  changePct:-1.8, ytd:"-7.4%", oneY:"-1.9%" },
    { name:"Vietnam",      price:12.34,  changePct:-0.9, ytd:"-3.2%", oneY:" 4.1%" },
  ]},
];

const MOCK_COMMODITIES = [
  { name:"Brent Crude",  price:100.68,  changePct: 5.4, ytd:" 18.2%", cat:"Energy"      },
  { name:"Crude Oil",    price:91.81,   changePct: 5.0, ytd:" 14.8%", cat:"Energy"      },
  { name:"Natural Gas",  price:2.71,    changePct:-1.2, ytd:" 22.4%", cat:"Energy"      },
  { name:"Gold",         price:4754.72, changePct: 0.8, ytd:" 31.4%", cat:"Metals"      },
  { name:"Silver",       price:32.14,   changePct: 1.2, ytd:" 14.2%", cat:"Metals"      },
  { name:"Copper",       price:4.87,    changePct:-0.8, ytd:"-8.4%",  cat:"Metals"      },
  { name:"Platinum",     price:967.40,  changePct: 0.4, ytd:" 2.1%",  cat:"Metals"      },
  { name:"Corn",         price:4.42,    changePct:-0.4, ytd:"-3.4%",  cat:"Agriculture" },
  { name:"Wheat",        price:5.23,    changePct: 0.8, ytd:" 4.2%",  cat:"Agriculture" },
  { name:"Soybeans",     price:10.14,   changePct:-0.2, ytd:"-6.1%",  cat:"Agriculture" },
];

// Market Movers mock data
const MOCK_MOVERS_BASE = [
  { ticker:"UNH",  name:"UnitedHealth Group",   changePct:6.96, relVol:4.1, last:346.01, sector:"Healthcare",  vol:"26.10M", chg:22.53  },
  { ticker:"AMD",  name:"Adv. Micro Devices",   changePct:3.47, relVol:1.3, last:284.49, sector:"Technology",  vol:"38.95M", chg:9.54   },
  { ticker:"COP",  name:"ConocoPhillips",       changePct:3.27, relVol:0.9, last:120.26, sector:"Energy",      vol:"8.14M",  chg:3.81   },
  { ticker:"CSCO", name:"Cisco Systems",        changePct:2.27, relVol:1.1, last:89.70,  sector:"Technology",  vol:"18.65M", chg:1.99   },
  { ticker:"ORCL", name:"Oracle Corporation",   changePct:2.02, relVol:1.4, last:181.17, sector:"Technology",  vol:"39.64M", chg:3.59   },
  { ticker:"AVGO", name:"Broadcom Inc.",        changePct:1.85, relVol:0.9, last:178.50, sector:"Technology",  vol:"12.3M",  chg:3.24   },
  { ticker:"CVX",  name:"Chevron Corp",         changePct:1.74, relVol:1.1, last:157.20, sector:"Energy",      vol:"9.2M",   chg:2.69   },
  { ticker:"PG",   name:"Procter & Gamble",     changePct:0.82, relVol:0.8, last:165.40, sector:"Consumer",    vol:"6.8M",   chg:1.34   },
  { ticker:"LLY",  name:"Eli Lilly",            changePct:0.65, relVol:0.9, last:786.20, sector:"Healthcare",  vol:"3.1M",   chg:5.08   },
  { ticker:"WMT",  name:"Walmart",              changePct:0.55, relVol:0.7, last:62.30,  sector:"Consumer",    vol:"15.4M",  chg:0.34   },
  { ticker:"JPM",  name:"JPMorgan Chase",       changePct:0.32, relVol:1.0, last:241.50, sector:"Financials",  vol:"8.9M",   chg:0.77   },
  { ticker:"V",    name:"Visa Inc.",            changePct:0.28, relVol:0.8, last:312.40, sector:"Financials",  vol:"5.6M",   chg:0.87   },
  { ticker:"BRKB", name:"Berkshire Hathaway B", changePct:-0.12,relVol:1.4, last:452.10, sector:"Financials",  vol:"4.8M",   chg:-0.54  },
  { ticker:"MSFT", name:"Microsoft",            changePct:-0.15,relVol:1.2, last:415.30, sector:"Technology",  vol:"18.7M",  chg:-0.62  },
  { ticker:"C",    name:"Citigroup",            changePct:-0.55,relVol:0.8, last:61.30,  sector:"Financials",  vol:"14.2M",  chg:-0.34  },
  { ticker:"HD",   name:"Home Depot",           changePct:-0.68,relVol:0.8, last:356.40, sector:"Consumer",    vol:"5.7M",   chg:-2.43  },
  { ticker:"GS",   name:"Goldman Sachs",        changePct:-0.75,relVol:0.9, last:512.30, sector:"Financials",  vol:"3.4M",   chg:-3.87  },
  { ticker:"DE",   name:"Deere & Co.",          changePct:-0.82,relVol:0.7, last:384.20, sector:"Industrials", vol:"2.1M",   chg:-3.19  },
  { ticker:"AAPL", name:"Apple Inc.",           changePct:-0.42,relVol:1.1, last:198.15, sector:"Technology",  vol:"52.3M",  chg:-0.83  },
  { ticker:"AMZN", name:"Amazon",               changePct:-0.65,relVol:0.9, last:185.75, sector:"Consumer",    vol:"34.1M",  chg:-1.21  },
  { ticker:"NVDA", name:"NVIDIA",               changePct:-0.88,relVol:1.4, last:875.40, sector:"Technology",  vol:"41.2M",  chg:-7.74  },
  { ticker:"META", name:"Meta Platforms",       changePct:-1.12,relVol:0.7, last:485.20, sector:"Technology",  vol:"12.9M",  chg:-5.47  },
  { ticker:"GOOGL",name:"Alphabet",             changePct:-1.24,relVol:1.1, last:165.20, sector:"Technology",  vol:"23.4M",  chg:-2.08  },
  { ticker:"TSLA", name:"Tesla",                changePct:-1.45,relVol:1.8, last:162.50, sector:"Consumer",    vol:"97.8M",  chg:-2.39  },
  { ticker:"LRCX", name:"Lam Research",         changePct:-1.68,relVol:1.2, last:672.40, sector:"Technology",  vol:"2.8M",   chg:-11.5  },
  { ticker:"LMT",  name:"Lockheed Martin",      changePct:-1.94,relVol:1.6, last:448.70, sector:"Industrials", vol:"3.1M",   chg:-8.87  },
  { ticker:"TMUS", name:"T-Mobile US",          changePct:-2.05,relVol:1.9, last:216.50, sector:"Telecom",     vol:"5.8M",   chg:-4.54  },
  { ticker:"BA",   name:"Boeing",               changePct:-2.14,relVol:1.5, last:178.30, sector:"Industrials", vol:"18.2M",  chg:-3.91  },
  { ticker:"HON",  name:"Honeywell",            changePct:-2.33,relVol:1.5, last:214.60, sector:"Industrials", vol:"8.4M",   chg:-5.12  },
  { ticker:"DHR",  name:"Danaher",              changePct:-2.31,relVol:2.0, last:236.80, sector:"Healthcare",  vol:"5.5M",   chg:-5.60  },
  { ticker:"ISRG", name:"Intuitive Surgical",   changePct:-2.75,relVol:1.7, last:485.30, sector:"Healthcare",  vol:"4.2M",   chg:-13.7  },
  { ticker:"MMM",  name:"3M Company",           changePct:-2.48,relVol:2.3, last:132.60, sector:"Industrials", vol:"6.2M",   chg:-3.37  },
  { ticker:"MRK",  name:"Merck & Co.",          changePct:-3.88,relVol:1.3, last:112.56, sector:"Healthcare",  vol:"12.77M", chg:-4.54  },
  { ticker:"RTX",  name:"RTX Corporation",      changePct:-4.40,relVol:2.0, last:187.17, sector:"Industrials", vol:"7.49M",  chg:-8.62  },
  { ticker:"GE",   name:"General Electric",     changePct:-5.56,relVol:2.7, last:286.73, sector:"Industrials", vol:"12.89M", chg:-16.87 },
];

// Which tickers belong to each index (null = all)
const INDEX_SUBSETS = {
  "S&P 100 (Mega-Cap)": null,
  "S&P 500":            null,
  "Nasdaq 100":         ["AAPL","MSFT","NVDA","META","GOOGL","AMZN","TSLA","AMD","CSCO","ORCL","AVGO","LRCX"],
  "Dow Jones 30":       ["MSFT","JPM","V","HD","MRK","AAPL","GS","BA","HON","MMM","PG","WMT","UNH"],
  "Russell 2000":       [], // no small-cap overlap in this mock set
};

// Session price adjustments (purely visual simulation)
const SESSION_ADJ = { "Pre Market":{ priceMult:0.9982, pctShift:-0.14 }, "Market":{ priceMult:1, pctShift:0 }, "Post Market":{ priceMult:1.0019, pctShift:0.09 } };

function applySession(movers, session) {
  const { priceMult, pctShift } = SESSION_ADJ[session] || SESSION_ADJ["Market"];
  if (priceMult === 1) return movers;
  return movers.map((m) => ({
    ...m,
    last:      parseFloat((m.last * priceMult).toFixed(2)),
    changePct: parseFloat((m.changePct + pctShift).toFixed(2)),
    chg:       parseFloat((m.chg + m.last * priceMult * (pctShift / 100)).toFixed(2)),
  }));
}

// Chart configuration
const CHART_INDICES = [
  { ticker:"DIA", label:"Dow Jones",  color:"#E8803A" },
  { ticker:"SPY", label:"S&P 500",   color:"#5B9CF6" },
  { ticker:"QQQ", label:"Nasdaq 100",color:"#A78BFA" },
];
const ALL_PERIODS  = ["1D","5D","1M","3M","6M","YTD","1Y","3Y","5Y","10Y"];
const LIVE_PERIODS = new Set(["1M","3M","6M","YTD","1Y"]);
const SECTOR_OPTS  = ["All Sectors","Technology","Financials","Healthcare","Consumer","Energy","Industrials","Telecom"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pnlColor = (v) => v == null ? "var(--kite-muted)" : v > 0 ? "var(--kite-positive)" : v < 0 ? "var(--kite-negative)" : "var(--kite-muted)";
const sign     = (v) => v > 0 ? "+" : "";
function fmtP(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 10000) return v.toLocaleString("en-US", { maximumFractionDigits:0 });
  if (Math.abs(v) >= 1000)  return v.toLocaleString("en-US", { maximumFractionDigits:2 });
  if (Math.abs(v) >= 1)     return v.toFixed(2);
  return v.toFixed(4);
}
function fmtDate(d) {
  if (!d) return "";
  try {
    const [y, m] = d.split("-");
    return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m-1]+` '${y.slice(2)}`;
  } catch { return ""; }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function DataRow({ name, price, changePct }) {
  const c = pnlColor(changePct);
  return (
    <div style={{ display:"flex", alignItems:"center", padding:"3px 0", gap:4 }}>
      <span style={{ color:c, fontSize:"8px", flexShrink:0 }}>●</span>
      <span style={{ flex:1, fontSize:"12px", color:"var(--kite-body)" }}>{name}</span>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--kite-heading)", minWidth:72, textAlign:"right" }}>{fmtP(price)}</span>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:"11px", color:c, minWidth:46, textAlign:"right" }}>
        {changePct != null ? `${sign(changePct)}${Math.abs(changePct).toFixed(1)}%` : "—"}
      </span>
    </div>
  );
}
function LoadingRow() {
  return (
    <div style={{ display:"flex", alignItems:"center", padding:"3px 0", gap:4 }}>
      <span style={{ color:"var(--kite-border)", fontSize:"8px" }}>●</span>
      <span style={{ flex:1, height:10, background:"var(--kite-border)", borderRadius:2, opacity:0.4 }} />
      <span style={{ width:60, height:10, background:"var(--kite-border)", borderRadius:2, opacity:0.4 }} />
    </div>
  );
}
function ColHeader() {
  return (
    <div style={{ display:"flex", padding:"2px 0 4px", borderBottom:"1px solid var(--kite-border)", marginBottom:2 }}>
      <span style={{ width:12 }} />
      <span style={{ flex:1, fontSize:"9px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--kite-muted)" }}>Name</span>
      <span style={{ fontSize:"9px", fontWeight:"700", textTransform:"uppercase", color:"var(--kite-muted)", minWidth:72, textAlign:"right" }}>Price</span>
      <span style={{ fontSize:"9px", fontWeight:"700", textTransform:"uppercase", color:"var(--kite-muted)", minWidth:46, textAlign:"right" }}>%</span>
    </div>
  );
}
function SubLabel({ text }) {
  return <div style={{ fontSize:"9px", fontWeight:"700", color:"var(--kite-muted)", margin:"8px 0 4px", textTransform:"uppercase", letterSpacing:"0.05em" }}>{text}</div>;
}

// ─── Expand Modal ─────────────────────────────────────────────────────────────
function ExpandModal({ title, mock, onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--kite-surface)", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-md)", width:"min(820px, 96vw)", maxHeight:"85vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid var(--kite-border)", flexShrink:0 }}>
          <div>
            <span style={{ fontSize:"15px", fontWeight:"700", color:"var(--kite-heading)" }}>{title}</span>
            {mock && <span style={{ marginLeft:8, fontSize:"10px", background:"var(--kite-amber-wash)", color:"var(--kite-amber-dark)", padding:"2px 6px", borderRadius:"var(--radius-sm)", fontWeight:"700" }}>SIMULATED *</span>}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"20px", color:"var(--kite-muted)", lineHeight:1 }}>×</button>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

// Extended table row for expand modal (extra columns)
function ExtDataRow({ name, price, changePct, ytd, oneY, high52, low52, extra }) {
  const c = pnlColor(changePct);
  return (
    <tr style={{ borderBottom:"1px solid var(--kite-border)" }}>
      <td style={{ padding:"6px 8px", fontSize:"12px", color:"var(--kite-body)" }}>{name}</td>
      <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:"var(--kite-heading)", textAlign:"right" }}>{fmtP(price)}</td>
      <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:c, textAlign:"right" }}>{changePct != null ? `${sign(changePct)}${Math.abs(changePct).toFixed(2)}%` : "—"}</td>
      {ytd   !== undefined && <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:"var(--kite-muted)", textAlign:"right" }}>{ytd}</td>}
      {oneY  !== undefined && <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:"var(--kite-muted)", textAlign:"right" }}>{oneY}</td>}
      {high52!== undefined && <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--kite-muted)", textAlign:"right" }}>{fmtP(high52)}</td>}
      {low52 !== undefined && <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--kite-muted)", textAlign:"right" }}>{fmtP(low52)}</td>}
      {extra !== undefined && <td style={{ padding:"6px 8px", fontSize:"11px", color:"var(--kite-muted)", textAlign:"right" }}>{extra}</td>}
    </tr>
  );
}
function ExtTH({ children, right }) {
  return <th style={{ padding:"6px 8px", fontSize:"10px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.04em", color:"var(--kite-muted)", textAlign: right ? "right" : "left", borderBottom:"2px solid var(--kite-border)", whiteSpace:"nowrap" }}>{children}</th>;
}

// ─── Market Overview ──────────────────────────────────────────────────────────
function MarketOverview() {
  const [period, setPeriod]       = useState("1Y");
  const [activeIdx, setActiveIdx] = useState(new Set(["DIA","SPY","QQQ"]));
  const [histData, setHistData]   = useState(null);
  const [histError, setHistError] = useState(false);
  const [news, setNews]           = useState([]);
  const [quotesMap, setQuotesMap] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [expanded, setExpanded]   = useState(null);

  useEffect(() => {
    const all = [...INDEX_ORDER, ...SECTOR_ORDER];
    setQuotesLoading(true);
    getQuotes(all).then((stocks) => {
      const m = {}; stocks.forEach((s) => { m[s.ticker] = s; }); setQuotesMap(m);
    }).catch(() => {}).finally(() => setQuotesLoading(false));
  }, []);

  useEffect(() => {
    getNews({ tickers:[], filter:"top" }).then((r) => setNews(r.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!LIVE_PERIODS.has(period)) return;
    setHistData(null);
    setHistError(false);
    getPortfolioHistory(["QQQ","DIA"], period)
      .then((data) => {
        setHistData(data);
        // If data came back but has no usable series, flag it
        if (!data?.SPY?.closes?.length) setHistError(true);
      })
      .catch(() => setHistError(true));
  }, [period]);

  const chartSeries = useMemo(() => {
    if (!histData) return [];
    const spy = histData["SPY"];
    if (!spy?.closes?.length) return [];
    const avail = CHART_INDICES.filter((i) => activeIdx.has(i.ticker) && histData[i.ticker]?.closes?.length);
    if (!avail.length) return [];
    const minLen = Math.min(spy.closes.length, ...avail.map((i) => histData[i.ticker].closes.length));
    if (minLen < 2) return [];
    return Array.from({ length:minLen }, (_, t) => {
      const pt = { date: spy.dates?.[spy.closes.length - minLen + t] || "" };
      avail.forEach((idx) => {
        const d = histData[idx.ticker];
        const c0 = d.closes[d.closes.length - minLen];
        pt[idx.ticker] = parseFloat(((d.closes[d.closes.length - minLen + t] / c0 - 1) * 100).toFixed(2));
      });
      return pt;
    });
  }, [histData, activeIdx]);

  const lastPt = chartSeries[chartSeries.length - 1] || {};
  const tickInterval = Math.max(1, Math.floor((chartSeries.length - 1) / 6));

  const indexRows  = INDEX_ORDER.map((t) => ({ name:INDEX_NAMES[t],  price:quotesMap[t]?.price ?? null, changePct:quotesMap[t]?.change_pct ?? null }));
  const sectorRows = SECTOR_ORDER.map((t) => ({ name:SECTOR_NAMES[t], price:quotesMap[t]?.price ?? null, changePct:quotesMap[t]?.change_pct ?? null }));

  const Expand = ({ id }) => (
    <button onClick={() => setExpanded(id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"12px", color:"var(--kite-muted)", padding:"0 2px" }} title="Expand">↗</button>
  );

  const SideBlock = ({ id, title, mock, children }) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:"12px", fontWeight:"700", color:"var(--kite-heading)" }}>
          {title}{mock && <sup style={{ fontSize:"8px", color:"var(--kite-amber-dark)", marginLeft:2 }}>*</sup>}
        </span>
        <Expand id={id} />
      </div>
      {children}
    </div>
  );

  const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:"var(--kite-surface)", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-sm)", padding:"8px 12px", fontSize:"11px" }}>
        <div style={{ color:"var(--kite-muted)", marginBottom:4 }}>{fmtDate(label)}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color:p.color }}>
            {CHART_INDICES.find((i) => i.ticker === p.dataKey)?.label}: {p.value > 0 ? "+" : ""}{p.value?.toFixed(2)}%
          </div>
        ))}
      </div>
    );
  };

  // ── Expand modal content per block ──
  const modalContent = {
    indices: (
      <div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            <ExtTH>Index / ETF</ExtTH><ExtTH right>Price</ExtTH><ExtTH right>Day %</ExtTH>
            <ExtTH right>52W High</ExtTH><ExtTH right>52W Low</ExtTH><ExtTH right>P/E</ExtTH>
          </tr></thead>
          <tbody>
            {INDEX_ORDER.map((t) => {
              const q = quotesMap[t];
              return <ExtDataRow key={t} name={INDEX_NAMES[t]} price={q?.price} changePct={q?.change_pct} high52={q?.week_52_high} low52={q?.week_52_low} extra={q?.pe_ratio?.toFixed(1) ?? "—"} />;
            })}
            <tr><td colSpan={6} style={{ padding:"8px", fontSize:"11px", color:"var(--kite-muted)", fontStyle:"italic" }}>VIX and additional indices: live endpoint coming soon *</td></tr>
            <ExtDataRow name="CBOE VIX *"    price={19.32} changePct={2.4}  high52={65.73} low52={12.45} extra="—" />
            <ExtDataRow name="S&P MidCap 400 *" price={2841.23} changePct={-0.8} high52={3042} low52={2410} extra="18.2" />
            <ExtDataRow name="S&P SmallCap 600 *" price={1198.45} changePct={-1.2} high52={1394} low52={1098} extra="15.8" />
          </tbody>
        </table>
      </div>
    ),
    sectors: (
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr>
          <ExtTH>Sector</ExtTH><ExtTH right>ETF</ExtTH><ExtTH right>Price</ExtTH><ExtTH right>Day %</ExtTH>
          <ExtTH right>52W High</ExtTH><ExtTH right>52W Low</ExtTH>
        </tr></thead>
        <tbody>
          {SECTOR_ORDER.map((t) => {
            const q = quotesMap[t];
            return (
              <tr key={t} style={{ borderBottom:"1px solid var(--kite-border)" }}>
                <td style={{ padding:"6px 8px", fontSize:"12px", color:"var(--kite-body)" }}>{SECTOR_NAMES[t]}</td>
                <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--kite-amber-dark)", textAlign:"right" }}>{t}</td>
                <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:"var(--kite-heading)", textAlign:"right" }}>{fmtP(q?.price)}</td>
                <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:pnlColor(q?.change_pct), textAlign:"right" }}>{q?.change_pct != null ? `${sign(q.change_pct)}${Math.abs(q.change_pct).toFixed(2)}%` : "—"}</td>
                <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--kite-muted)", textAlign:"right" }}>{fmtP(q?.week_52_high)}</td>
                <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--kite-muted)", textAlign:"right" }}>{fmtP(q?.week_52_low)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ),
    news: (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {news.length === 0 && <div style={{ color:"var(--kite-muted)", fontSize:"13px" }}>No news loaded yet.</div>}
        {news.map((item, i) => (
          <a key={i} href={item.url || "#"} target="_blank" rel="noreferrer"
            style={{ display:"block", padding:"12px", background:"var(--kite-cream)", borderRadius:"var(--radius-sm)", textDecoration:"none", border:"1px solid var(--kite-border)" }}>
            <div style={{ fontSize:"13px", fontWeight:"600", color:"var(--kite-heading)", marginBottom:6, lineHeight:1.4 }}>{item.title}</div>
            {item.description && <div style={{ fontSize:"12px", color:"var(--kite-muted)", lineHeight:1.4, marginBottom:6 }}>{item.description?.slice(0, 200)}{item.description?.length > 200 ? "…" : ""}</div>}
            <div style={{ fontSize:"11px", color:"var(--kite-muted)" }}>{item.source} · {item.published_at ? new Date(item.published_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""}</div>
          </a>
        ))}
      </div>
    ),
    fixed: (
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><ExtTH>Name</ExtTH><ExtTH right>Price</ExtTH><ExtTH right>Day %</ExtTH><ExtTH right>YTD</ExtTH><ExtTH right>1Y</ExtTH></tr></thead>
        <tbody>
          {MOCK_FIXED.flatMap((grp) => [
            <tr key={grp.cat}><td colSpan={5} style={{ padding:"8px 8px 4px", fontSize:"10px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--kite-muted)" }}>{grp.cat}</td></tr>,
            ...grp.items.map((r) => <ExtDataRow key={r.name} {...r} />),
          ])}
        </tbody>
      </table>
    ),
    currencies: (
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><ExtTH>Pair</ExtTH><ExtTH right>Price</ExtTH><ExtTH right>Day %</ExtTH><ExtTH right>YTD</ExtTH><ExtTH right>52W High</ExtTH><ExtTH right>52W Low</ExtTH></tr></thead>
        <tbody>{MOCK_CURRENCIES_EXT.map((r) => <ExtDataRow key={r.name} {...r} />)}</tbody>
      </table>
    ),
    global: (
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><ExtTH>Market</ExtTH><ExtTH right>Price</ExtTH><ExtTH right>Day %</ExtTH><ExtTH right>YTD</ExtTH><ExtTH right>1Y</ExtTH></tr></thead>
        <tbody>
          {MOCK_GLOBAL.flatMap((grp) => [
            <tr key={grp.cat}><td colSpan={5} style={{ padding:"8px 8px 4px", fontSize:"10px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--kite-muted)" }}>{grp.cat}</td></tr>,
            ...grp.items.map((r) => <ExtDataRow key={r.name} {...r} />),
          ])}
        </tbody>
      </table>
    ),
    commodities: (
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><ExtTH>Commodity</ExtTH><ExtTH right>Category</ExtTH><ExtTH right>Price</ExtTH><ExtTH right>Day %</ExtTH><ExtTH right>YTD</ExtTH></tr></thead>
        <tbody>
          {["Energy","Metals","Agriculture"].map((cat) => [
            <tr key={cat}><td colSpan={5} style={{ padding:"8px 8px 4px", fontSize:"10px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--kite-muted)" }}>{cat}</td></tr>,
            ...MOCK_COMMODITIES.filter((c) => c.cat === cat).map((r) => (
              <tr key={r.name} style={{ borderBottom:"1px solid var(--kite-border)" }}>
                <td style={{ padding:"6px 8px", fontSize:"12px", color:"var(--kite-body)" }}>{r.name}</td>
                <td style={{ padding:"6px 8px", fontSize:"11px", color:"var(--kite-muted)", textAlign:"right" }}>{r.cat}</td>
                <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:"var(--kite-heading)", textAlign:"right" }}>{fmtP(r.price)}</td>
                <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:pnlColor(r.changePct), textAlign:"right" }}>{sign(r.changePct)}{Math.abs(r.changePct).toFixed(2)}%</td>
                <td style={{ padding:"6px 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:"var(--kite-muted)", textAlign:"right" }}>{r.ytd}</td>
              </tr>
            )),
          ])}
        </tbody>
      </table>
    ),
  };

  const modalTitles = { indices:"U.S. Equity Markets", sectors:"U.S. Equity Sectors", news:"Market News", fixed:"Fixed Income", currencies:"Currencies (USD FX)", global:"Global Markets", commodities:"Commodities" };
  const modalMock   = { fixed:true, currencies:true, global:true, commodities:true };

  return (
    <>
      {expanded && (
        <ExpandModal title={modalTitles[expanded]} mock={modalMock[expanded]} onClose={() => setExpanded(null)}>
          {modalContent[expanded]}
        </ExpandModal>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr 220px", borderBottom:"1px solid var(--kite-border)" }}>

        {/* Left sidebar */}
        <div style={{ borderRight:"1px solid var(--kite-border)", padding:14, overflowY:"auto", maxHeight:"calc(100vh - 92px)" }}>
          <SideBlock id="indices" title="U.S. Equity Markets">
            <SubLabel text="Major Indices & ETFs" />
            <ColHeader />
            {quotesLoading ? INDEX_ORDER.map((t) => <LoadingRow key={t} />) : indexRows.map((r) => <DataRow key={r.name} {...r} />)}
            <SubLabel text="Volatility Index" />
            <ColHeader />
            <DataRow {...MOCK_VIX} />
          </SideBlock>
          <SideBlock id="sectors" title="U.S. Equity Sectors">
            <SubLabel text="S&P Sector ETFs" />
            <ColHeader />
            {quotesLoading ? SECTOR_ORDER.map((t) => <LoadingRow key={t} />) : sectorRows.map((r) => <DataRow key={r.name} {...r} />)}
          </SideBlock>
          <SideBlock id="fixed" title="Fixed Income" mock>
            {MOCK_FIXED.slice(0,2).map((grp) => (
              <div key={grp.cat}>
                <SubLabel text={grp.cat} />
                <ColHeader />
                {grp.items.map((r) => <DataRow key={r.name} {...r} />)}
              </div>
            ))}
          </SideBlock>
        </div>

        {/* Center */}
        <div style={{ display:"flex", flexDirection:"column", minWidth:0 }}>
          {/* News */}
          <div style={{ borderBottom:"1px solid var(--kite-border)", padding:"12px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:"12px", fontWeight:"700", color:"var(--kite-heading)" }}>Market News</span>
              <button onClick={() => setExpanded("news")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"12px", color:"var(--kite-muted)" }}>↗</button>
            </div>
            {news.length === 0
              ? <div style={{ fontSize:"12px", color:"var(--kite-muted)" }}>Loading headlines…</div>
              : news.slice(0,4).map((item, i) => (
                  <a key={i} href={item.url || "#"} target="_blank" rel="noreferrer"
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"6px 0", borderBottom: i<3 ? "1px solid var(--kite-border)" : "none", textDecoration:"none" }}>
                    <span style={{ flex:1, fontSize:"12px", color:"var(--kite-body)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</span>
                    <span style={{ fontSize:"11px", color:"var(--kite-muted)", flexShrink:0, whiteSpace:"nowrap" }}>{item.source} · {item.published_at ? new Date(item.published_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : ""}</span>
                  </a>
                ))
            }
          </div>

          {/* Normalized chart */}
          <div style={{ flex:1, padding:"12px 16px", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontSize:"12px", fontWeight:"700", color:"var(--kite-heading)" }}>Normalized Performance</span>
              <span style={{ fontSize:"10px", color:"var(--kite-muted)" }}>↗ Export</span>
            </div>
            <div style={{ display:"flex", gap:2, marginBottom:10 }}>
              {ALL_PERIODS.map((p) => {
                const live = LIVE_PERIODS.has(p);
                return (
                  <button key={p} onClick={() => live && setPeriod(p)} disabled={!live}
                    style={{ padding:"3px 8px", background: period===p ? "var(--kite-amber-dark)" : "none", border:`1px solid ${period===p ? "var(--kite-amber-dark)" : "var(--kite-border)"}`, borderRadius:"var(--radius-sm)", fontSize:"11px", fontWeight: period===p ? "700" : "400", color: !live ? "var(--kite-border)" : period===p ? "#fff" : "var(--kite-muted)", cursor: live ? "pointer" : "default" }}>
                    {p}
                  </button>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
              {CHART_INDICES.map((idx) => (
                <button key={idx.ticker} onClick={() => {
                  setActiveIdx((prev) => { const next = new Set(prev); if (next.has(idx.ticker) && next.size > 1) next.delete(idx.ticker); else next.add(idx.ticker); return next; });
                }} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background: activeIdx.has(idx.ticker) ? idx.color+"22" : "var(--kite-surface)", border:`1px solid ${activeIdx.has(idx.ticker) ? idx.color : "var(--kite-border)"}`, borderRadius:"var(--radius-sm)", cursor:"pointer", fontSize:"12px", fontWeight:"600", color: activeIdx.has(idx.ticker) ? idx.color : "var(--kite-muted)" }}>
                  <span style={{ width:10, height:3, background: activeIdx.has(idx.ticker) ? idx.color : "var(--kite-muted)", borderRadius:2, display:"inline-block" }} />
                  {idx.label}
                  {activeIdx.has(idx.ticker) && lastPt[idx.ticker] != null && <span style={{ fontSize:"11px" }}>{lastPt[idx.ticker]>0?"+":""}{lastPt[idx.ticker]?.toFixed(2)}%</span>}
                  {activeIdx.has(idx.ticker) && <span style={{ fontSize:"10px", opacity:0.6 }}>×</span>}
                </button>
              ))}
            </div>
            <div style={{ height:160, position:"relative" }}>
              {!histData && !histError && LIVE_PERIODS.has(period) && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", color:"var(--kite-muted)" }}>Loading chart…</div>}
              {histError && <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}><span style={{ fontSize:"12px", color:"var(--kite-muted)" }}>Chart unavailable — API daily limit may be reached</span><button onClick={() => { setHistError(false); setHistData(null); getPortfolioHistory(["QQQ","DIA"], period).then((d) => { setHistData(d); if (!d?.SPY?.closes?.length) setHistError(true); }).catch(() => setHistError(true)); }} style={{ fontSize:"11px", padding:"4px 10px", background:"none", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-sm)", cursor:"pointer", color:"var(--kite-muted)" }}>Retry</button></div>}
              {!LIVE_PERIODS.has(period) && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", color:"var(--kite-muted)" }}>Historical data not yet available for {period}</div>}
              {histData && chartSeries.length > 1 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSeries} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--kite-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:"var(--kite-muted)" }} axisLine={false} tickLine={false} interval={tickInterval} tickFormatter={fmtDate} />
                    <YAxis tick={{ fontSize:10, fill:"var(--kite-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v>0?"+":""}${v.toFixed(0)}%`} />
                    <ReferenceLine y={0} stroke="var(--kite-muted)" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Tooltip content={<ChartTip />} />
                    {CHART_INDICES.filter((i) => activeIdx.has(i.ticker)).map((idx) => (
                      <Line key={idx.ticker} type="monotone" dataKey={idx.ticker} stroke={idx.color} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ borderLeft:"1px solid var(--kite-border)", padding:14, overflowY:"auto", maxHeight:"calc(100vh - 92px)" }}>
          <SideBlock id="currencies" title="Currencies" mock>
            <SubLabel text="USD FX Crosses" />
            <ColHeader />
            {MOCK_CURRENCIES.map((r) => <DataRow key={r.name} {...r} />)}
          </SideBlock>
          <SideBlock id="global" title="Global Markets" mock>
            {MOCK_GLOBAL.map((grp) => (
              <div key={grp.cat}>
                <SubLabel text={grp.cat} />
                <ColHeader />
                {grp.items.slice(0,4).map((r) => <DataRow key={r.name} {...r} />)}
              </div>
            ))}
          </SideBlock>
          <SideBlock id="commodities" title="Commodities" mock>
            <ColHeader />
            {MOCK_COMMODITIES.slice(0,4).map((r) => <DataRow key={r.name} {...r} />)}
          </SideBlock>
        </div>
      </div>
    </>
  );
}

// ─── Market Movers ────────────────────────────────────────────────────────────
function MarketMovers() {
  const [indexSel, setIndexSel]     = useState("S&P 100 (Mega-Cap)");
  const [sectorSel, setSectorSel]   = useState("All Sectors");
  const [session, setSession]       = useState("Market");
  const [search, setSearch]         = useState("");
  const [hovered, setHovered]       = useState(null);
  const [showDrop, setShowDrop]     = useState(false);
  const [liveMovers, setLiveMovers] = useState(MOCK_MOVERS_BASE);
  const [moversLoading, setMoversLoading] = useState(true);

  useEffect(() => {
    const tickers = MOCK_MOVERS_BASE.map((m) => m.ticker);
    // Delay so overview chart/quotes fetch first and avoid competing for rate limit
    const timer = setTimeout(() => {
      setMoversLoading(true);
      getQuotes(tickers)
        .then((stocks) => {
          const qmap = {};
          stocks.forEach((s) => { qmap[s.ticker] = s; });
          setLiveMovers(MOCK_MOVERS_BASE.map((m) => {
            const q = qmap[m.ticker];
            if (!q || q.price == null) return m;
            const last      = q.price;
            const changePct = q.change_pct ?? m.changePct;
            const chg       = parseFloat((last * changePct / 100).toFixed(2));
            return { ...m, last, changePct, chg };
          }));
        })
        .catch(() => {})
        .finally(() => setMoversLoading(false));
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const subset = INDEX_SUBSETS[indexSel];
    let movers = subset === null ? liveMovers
      : subset.length === 0 ? []
      : liveMovers.filter((m) => subset.includes(m.ticker));
    if (sectorSel !== "All Sectors") movers = movers.filter((m) => m.sector === sectorSel);
    return applySession(movers, session);
  }, [liveMovers, indexSel, sectorSel, session]);

  const scatterData = filtered.map((m) => ({ x:m.relVol, y:m.changePct, ...m }));
  const gainers = [...filtered].filter((m) => m.changePct > 0).sort((a,b) => b.changePct - a.changePct);
  const losers  = [...filtered].filter((m) => m.changePct < 0).sort((a,b) => a.changePct - b.changePct);
  const searchUp = search.trim().toUpperCase();

  const CustomDot = ({ cx, cy, payload }) => {
    if (cx == null || cy == null) return null;
    const isSearch  = searchUp && payload.ticker.startsWith(searchUp);
    const isHover   = hovered === payload.ticker;
    const isNotable = Math.abs(payload.y) > 2.5 || payload.x > 2.5;
    const r = isSearch ? 9 : isHover ? 7 : 5;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={isSearch ? "#FCC844" : "#5B9CF6"} fillOpacity={isHover || isSearch ? 1 : 0.72}
          stroke={isSearch ? "#C4922A" : isHover ? "#fff" : "none"} strokeWidth={isSearch ? 2 : 1}
          style={{ cursor:"pointer" }}
          onMouseEnter={() => setHovered(payload.ticker)} onMouseLeave={() => setHovered(null)} />
        {(isSearch || isNotable || isHover) && (
          <text x={cx} y={cy-r-3} textAnchor="middle" fontSize={9} fill="var(--kite-muted)" fontWeight="600">{payload.ticker}</text>
        )}
      </g>
    );
  };

  const ScatterTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const c = pnlColor(d.y);
    return (
      <div style={{ background:"var(--kite-surface)", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-sm)", padding:"8px 12px", fontSize:"12px", minWidth:168 }}>
        <div style={{ fontWeight:"700", color:"var(--kite-heading)", marginBottom:4 }}>{d.ticker} <span style={{ fontWeight:"400", color:"var(--kite-muted)" }}>· {d.name}</span></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 12px" }}>
          {[["Last",`$${d.last?.toFixed(2)}`],["1D Return",`${sign(d.y)}${d.y?.toFixed(2)}%`],["Rel. Vol *",`${d.x}x`],["Volume *",d.vol],["Sector",d.sector]].map(([k,v]) => (
            <><div key={k+"k"} style={{ color:"var(--kite-muted)", fontSize:"10px" }}>{k}</div>
            <div key={k+"v"} style={{ fontFamily: k==="Sector"?"inherit":"var(--font-mono)", textAlign:"right", color: k==="1D Return"?c:"var(--kite-heading)", fontSize:"11px" }}>{v}</div></>
          ))}
        </div>
        <div style={{ marginTop:6, fontSize:"10px", color:"var(--kite-muted)", fontStyle:"italic" }}>* Rel. Vol and Volume are illustrative</div>
      </div>
    );
  };

  const TH = ({ left, children }) => (
    <th style={{ padding:"0 8px", fontSize:"10px", fontWeight:"700", letterSpacing:"0.04em", textTransform:"uppercase", color:"var(--kite-muted)", textAlign: left?"left":"right", whiteSpace:"nowrap" }}>{children}</th>
  );
  const MoverRow = ({ m }) => {
    const c = pnlColor(m.changePct);
    return (
      <tr style={{ borderBottom:"1px solid var(--kite-border)", height:40 }}>
        <td style={{ padding:"0 8px", fontSize:"12px", fontWeight:"700", color:"var(--kite-amber-dark)", fontFamily:"var(--font-mono)", whiteSpace:"nowrap" }}>
          <span style={{ color:"var(--kite-muted)", fontSize:"9px", marginRight:4 }}>●</span>{m.ticker}
        </td>
        <td style={{ padding:"0 8px", fontSize:"11px", color:"var(--kite-muted)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.name}</td>
        <td style={{ padding:"0 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:"var(--kite-heading)", textAlign:"right" }}>{m.last.toFixed(2)}</td>
        <td style={{ padding:"0 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:c, textAlign:"right" }}>{sign(m.chg)}{Math.abs(m.chg).toFixed(2)}</td>
        <td style={{ padding:"0 8px", fontFamily:"var(--font-mono)", fontSize:"12px", color:c, textAlign:"right" }}>{sign(m.changePct)}{Math.abs(m.changePct).toFixed(2)}%</td>
        <td style={{ padding:"0 8px", fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--kite-muted)", textAlign:"right" }}>{m.vol}</td>
        <td style={{ padding:"0 8px", fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--kite-muted)", textAlign:"right" }}>{m.relVol}x</td>
      </tr>
    );
  };

  return (
    <div style={{ padding:"20px 20px 0" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, padding:"8px 12px", background:"var(--kite-amber-wash)", border:"1px solid var(--kite-amber)", borderRadius:"var(--radius-sm)" }}>
        <span style={{ fontSize:"11px", fontWeight:"700", color:"var(--kite-amber-dark)" }}>LIVE PRICES</span>
        <span style={{ fontSize:"11px", color:"var(--kite-amber-dark)", opacity:0.8 }}>— Prices and returns are real. Relative Volume and trading volume (*) are illustrative — a live volume endpoint will replace them.</span>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ fontSize:"18px", fontWeight:"700", color:"var(--kite-heading)", flex:1 }}>
          Market Movers <sup style={{ fontSize:"10px", color:"var(--kite-amber-dark)" }}>*</sup>
        </span>

        <div style={{ position:"relative" }}>
          <button onClick={() => setShowDrop((v) => !v)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", background:"var(--kite-surface)", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-sm)", fontSize:"12px", fontWeight:"600", color:"var(--kite-heading)", cursor:"pointer" }}>
            ⊞ {indexSel} ▾
          </button>
          {showDrop && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, background:"var(--kite-surface)", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-sm)", zIndex:50, minWidth:200, boxShadow:"0 4px 16px rgba(0,0,0,0.15)" }}>
              {Object.keys(INDEX_SUBSETS).map((o) => (
                <button key={o} onClick={() => { setIndexSel(o); setShowDrop(false); }}
                  style={{ display:"block", width:"100%", padding:"8px 14px", background: o===indexSel?"var(--kite-amber-wash)":"none", border:"none", cursor:"pointer", fontSize:"12px", textAlign:"left", color: o===indexSel?"var(--kite-amber-dark)":"var(--kite-body)" }}>
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>

        <select value={sectorSel} onChange={(e) => setSectorSel(e.target.value)}
          style={{ padding:"6px 10px", background:"var(--kite-surface)", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-sm)", fontSize:"12px", color:"var(--kite-heading)", cursor:"pointer", outline:"none" }}>
          {SECTOR_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>

        <div style={{ display:"flex", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-sm)", overflow:"hidden" }}>
          {["Pre Market","Market","Post Market"].map((s) => (
            <button key={s} onClick={() => setSession(s)}
              style={{ padding:"6px 14px", background: session===s ? "var(--kite-heading)" : "none", border:"none", cursor:"pointer", fontSize:"12px", fontWeight: session===s?"700":"400", color: session===s?"var(--kite-bg)":"var(--kite-muted)" }}>
              {s}
            </button>
          ))}
        </div>
        <span style={{ fontSize:"10px", color:"var(--kite-muted)" }}>
          {session !== "Market" ? `Showing ${session.toLowerCase()} adjusted prices (simulated)` : `${filtered.length} stocks`}
        </span>
      </div>

      {/* Scatter */}
      <div style={{ background:"var(--kite-surface)", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-md) var(--radius-md) 0 0", padding:"16px 16px 0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ fontSize:"13px", fontWeight:"600", color:"var(--kite-heading)" }}>1-Day Performance vs Relative Volume</span>
          <span style={{ fontSize:"10px", color:"var(--kite-muted)" }}>↗ Export</span>
        </div>
        <div style={{ fontSize:"11px", color:"var(--kite-muted)", marginBottom:4 }}>1 Day Return</div>
        {filtered.length === 0 ? (
          <div style={{ height:300, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", color:"var(--kite-muted)" }}>
            No stocks in this index / sector combination
          </div>
        ) : (
          <div style={{ height:300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top:8, right:24, left:-10, bottom:24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--kite-border)" />
                <XAxis type="number" dataKey="x" domain={[0,"auto"]} tick={{ fontSize:10, fill:"var(--kite-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}x`}
                  label={{ value:"Relative Volume (10d)", position:"insideBottomRight", offset:-4, fontSize:10, fill:"var(--kite-muted)" }} />
                <YAxis type="number" dataKey="y" tick={{ fontSize:10, fill:"var(--kite-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v>0?"+":""}${v.toFixed(0)}%`} />
                <ReferenceLine y={0} stroke="var(--kite-muted)" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ZAxis range={[40,40]} />
                <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray:"3 3" }} />
                <Scatter data={scatterData} shape={<CustomDot />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0 14px" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ticker to highlight…"
            style={{ padding:"5px 10px", width:210, background:"var(--kite-cream)", border:"1px solid var(--kite-border)", borderRadius:"var(--radius-sm)", fontSize:"12px", color:"var(--kite-heading)", outline:"none" }} />
          {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--kite-muted)", fontSize:"16px" }}>×</button>}
          <span style={{ fontSize:"11px", color:"var(--kite-muted)" }}>Matched ticker highlighted in yellow</span>
        </div>
      </div>

      {/* Gainers / Losers */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1px 1fr", border:"1px solid var(--kite-border)", borderTop:"none", borderRadius:"0 0 var(--radius-md) var(--radius-md)", overflow:"hidden", background:"var(--kite-surface)", marginBottom:24 }}>
        <div>
          <div style={{ padding:"10px 14px", background:"rgba(76,175,80,0.08)", borderBottom:"1px solid var(--kite-border)" }}>
            <span style={{ fontSize:"13px", fontWeight:"700", color:"var(--kite-positive)" }}>Gainers ({gainers.length})</span>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ borderBottom:"1px solid var(--kite-border)", height:32 }}><TH left>Ticker</TH><TH left>Name</TH><TH>Last</TH><TH>Chg</TH><TH>Chg %</TH><TH>Vol *</TH><TH>Rel *</TH></tr></thead>
              <tbody>{gainers.map((m) => <MoverRow key={m.ticker} m={m} />)}</tbody>
            </table>
          </div>
        </div>
        <div style={{ background:"var(--kite-border)" }} />
        <div>
          <div style={{ padding:"10px 14px", background:"rgba(224,82,82,0.08)", borderBottom:"1px solid var(--kite-border)" }}>
            <span style={{ fontSize:"13px", fontWeight:"700", color:"var(--kite-negative)" }}>Losers ({losers.length})</span>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ borderBottom:"1px solid var(--kite-border)", height:32 }}><TH left>Ticker</TH><TH left>Name</TH><TH>Last</TH><TH>Chg</TH><TH>Chg %</TH><TH>Vol *</TH><TH>Rel *</TH></tr></thead>
              <tbody>{losers.map((m) => <MoverRow key={m.ticker} m={m} />)}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ fontSize:"10px", color:"var(--kite-muted)", paddingBottom:16, borderTop:"1px solid var(--kite-border)", paddingTop:8 }}>
        <sup>*</sup> Simulated — VIX, Currencies, Global Markets, Commodities, Fixed Income, and Movers Vol/Rel Vol are illustrative. US Indices, Sector ETFs, Market News, Performance Chart, and Mover Prices/Returns are real data.
      </div>
    </div>
  );
}

export default function Market() {
  return (
    <div style={{ height:"100%", overflowY:"auto", background:"var(--kite-cream)" }}>
      <MarketOverview />
      <MarketMovers />
    </div>
  );
}
