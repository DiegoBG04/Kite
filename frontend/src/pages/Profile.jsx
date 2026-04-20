import { useState } from "react";
import { useTheme } from "../hooks/useTheme";

// ── Shared sub-components ─────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--kite-surface)",
      border: "1px solid var(--kite-border)",
      borderRadius: "var(--radius-md)",
      padding: "20px 24px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--kite-muted)",
      marginBottom: "16px",
    }}>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: "1px solid var(--kite-border)",
    }}>
      <span style={{ fontSize: "13px", color: "var(--kite-body)" }}>{label}</span>
      <span style={{ fontSize: "13px", color: "var(--kite-heading)", fontWeight: "500" }}>{children}</span>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        border: "none",
        background: checked ? "var(--kite-amber-dark)" : "var(--kite-border)",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute",
        top: "3px",
        left: checked ? "19px" : "3px",
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: "#fff",
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

// ── Email Customization Screen ────────────────────────────────────────────────

const EMAIL_SECTIONS = [
  { key: "portfolio_summary",  label: "Portfolio Performance Summary", description: "Daily P&L, total value, and allocation overview" },
  { key: "top_movers",         label: "Top Movers",                    description: "Biggest gainers and losers in your portfolio" },
  { key: "news_highlights",    label: "News Highlights",               description: "Most relevant news for your holdings" },
  { key: "risk_flags",         label: "Risk Flags",                    description: "Alerts from SEC filings and earnings calls" },
  { key: "market_overview",    label: "Market Overview",               description: "S&P 500, Nasdaq, and macro indicators" },
  { key: "ai_insights",        label: "AI Insights",                   description: "Claude-generated analysis of your portfolio" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function EmailCustomizeScreen({ onBack }) {
  const [deliveryTime,  setDeliveryTime]  = useState("07:00");
  const [activeDays,    setActiveDays]    = useState(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [sections,      setSections]      = useState({
    portfolio_summary: true,
    top_movers:        true,
    news_highlights:   true,
    risk_flags:        true,
    market_overview:   false,
    ai_insights:       true,
  });
  const [format, setFormat] = useState("detailed");

  function toggleDay(day) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function toggleSection(key) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--kite-cream)" }}>
      {/* Header */}
      <div style={{
        position: "sticky",
        top: 0,
        background: "var(--kite-surface)",
        borderBottom: "1px solid var(--kite-border)",
        padding: "0 32px",
        height: "52px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        zIndex: 10,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "1px solid var(--kite-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            color: "var(--kite-muted)",
            fontSize: "13px",
            padding: "4px 10px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--kite-heading)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--kite-muted)"; }}
        >
          ← Back
        </button>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: "600", color: "var(--kite-heading)" }}>
          Daily Email Summary
        </span>
      </div>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "32px 24px 60px" }}>

        {/* Delivery schedule */}
        <Card style={{ marginBottom: "20px" }}>
          <SectionTitle>Delivery Schedule</SectionTitle>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid var(--kite-border)", marginBottom: "14px" }}>
            <span style={{ fontSize: "13px", color: "var(--kite-body)" }}>Delivery time</span>
            <input
              type="time"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              style={{
                fontSize: "13px",
                color: "var(--kite-heading)",
                background: "var(--kite-cream)",
                border: "1px solid var(--kite-border)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 10px",
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", color: "var(--kite-body)" }}>Days</span>
            <div style={{ display: "flex", gap: "6px" }}>
              {DAYS.map((day) => {
                const active = activeDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    style={{
                      width: "34px",
                      height: "28px",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${active ? "var(--kite-amber-dark)" : "var(--kite-border)"}`,
                      background: active ? "var(--kite-amber-wash)" : "transparent",
                      color: active ? "var(--kite-amber-dark)" : "var(--kite-muted)",
                      fontSize: "10px",
                      fontWeight: active ? "700" : "400",
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Content sections */}
        <Card style={{ marginBottom: "20px" }}>
          <SectionTitle>Content to Include</SectionTitle>
          {EMAIL_SECTIONS.map(({ key, label, description }, i) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "12px 0",
                borderBottom: i < EMAIL_SECTIONS.length - 1 ? "1px solid var(--kite-border)" : "none",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--kite-heading)", marginBottom: "2px" }}>{label}</div>
                <div style={{ fontSize: "11px", color: "var(--kite-muted)" }}>{description}</div>
              </div>
              <Toggle checked={sections[key]} onChange={() => toggleSection(key)} />
            </div>
          ))}
        </Card>

        {/* Format */}
        <Card style={{ marginBottom: "32px" }}>
          <SectionTitle>Format</SectionTitle>
          <div style={{ display: "flex", gap: "10px" }}>
            {[["compact", "Compact", "Short bullets, quick scan"], ["detailed", "Detailed", "Full context and charts"]].map(([val, title, desc]) => (
              <button
                key={val}
                onClick={() => setFormat(val)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${format === val ? "var(--kite-amber-dark)" : "var(--kite-border)"}`,
                  background: format === val ? "var(--kite-amber-wash)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.12s",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: "600", color: format === val ? "var(--kite-amber-dark)" : "var(--kite-heading)", marginBottom: "3px" }}>{title}</div>
                <div style={{ fontSize: "11px", color: "var(--kite-muted)" }}>{desc}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            disabled
            style={{
              flex: 1,
              padding: "11px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--kite-border)",
              background: "transparent",
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--kite-muted)",
              cursor: "not-allowed",
              opacity: 0.6,
            }}
          >
            Preview Email
          </button>
          <button
            disabled
            style={{
              flex: 1,
              padding: "11px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--kite-amber-dark)",
              fontSize: "13px",
              fontWeight: "600",
              color: "#fff",
              cursor: "not-allowed",
              opacity: 0.5,
            }}
          >
            Save & Activate
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: "11px", color: "var(--kite-muted)", marginTop: "10px" }}>
          Email delivery coming soon
        </p>
      </div>
    </div>
  );
}

// ── Main Profile Page ─────────────────────────────────────────────────────────

export default function Profile() {
  const { theme, toggleTheme } = useTheme();
  const [showEmailScreen, setShowEmailScreen] = useState(false);

  if (showEmailScreen) {
    return <EmailCustomizeScreen onBack={() => setShowEmailScreen(false)} />;
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--kite-cream)" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "36px 24px 60px" }}>

        {/* Page title */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "4px" }}>
            Profile & Settings
          </h1>
          <p style={{ fontSize: "13px", color: "var(--kite-muted)" }}>Manage your account and preferences</p>
        </div>

        {/* Account */}
        <Card style={{ marginBottom: "16px" }}>
          <SectionTitle>Account</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--kite-border)", marginBottom: "4px" }}>
            <div style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "var(--kite-amber-wash)",
              border: "1px solid var(--kite-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: "600",
              color: "var(--kite-amber-dark)",
              fontFamily: "var(--font-display)",
              flexShrink: 0,
            }}>
              D
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--kite-heading)", marginBottom: "2px" }}>Diego Barriga</div>
              <div style={{ fontSize: "12px", color: "var(--kite-muted)" }}>dbarrigaguerra@gmail.com</div>
            </div>
          </div>
          <Row label="Member since">April 2025</Row>
          <Row label="Plan">Free</Row>
        </Card>

        {/* Appearance */}
        <Card style={{ marginBottom: "16px" }}>
          <SectionTitle>Appearance</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--kite-heading)", marginBottom: "2px" }}>
                {theme === "dark" ? "Dark Mode" : "Light Mode"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--kite-muted)" }}>
                {theme === "dark" ? "Easy on the eyes at night" : "Clean and bright"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "16px" }}>{theme === "dark" ? "🌙" : "☀️"}</span>
              <Toggle checked={theme === "dark"} onChange={toggleTheme} />
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card style={{ marginBottom: "16px" }}>
          <SectionTitle>Notifications</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--kite-border)" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--kite-heading)", marginBottom: "2px" }}>Daily Email Summary</div>
              <div style={{ fontSize: "11px", color: "var(--kite-muted)" }}>Morning briefing of your portfolio</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={() => setShowEmailScreen(true)}
                style={{
                  background: "none",
                  border: "1px solid var(--kite-border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "11px",
                  color: "var(--kite-amber-dark)",
                  fontWeight: "600",
                  padding: "4px 10px",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--kite-amber-wash)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                Customize
              </button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--kite-heading)", marginBottom: "2px" }}>Risk Flag Alerts</div>
              <div style={{ fontSize: "11px", color: "var(--kite-muted)" }}>Notified when filings flag concerns</div>
            </div>
          </div>
        </Card>

        {/* Data */}
        <Card>
          <SectionTitle>Data</SectionTitle>
          <Row label="Market data">Twelve Data (15 min delay)</Row>
          <Row label="Filings">SEC EDGAR</Row>
          <Row label="News">NewsAPI</Row>
        </Card>

      </div>
    </div>
  );
}
