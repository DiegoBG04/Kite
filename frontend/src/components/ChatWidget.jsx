/**
 * ChatWidget.jsx — Floating "Ask Kite" Chat Button
 *
 * A small amber button fixed to the bottom-right of the screen.
 * Clicking it expands a full ChatBox panel above.
 */

import { useState } from "react";
import ChatBox from "./ChatBox";

export default function ChatWidget({ tickers = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", bottom: "24px", left: "28px", zIndex: 90 }}>

      {/* Expanded chat panel */}
      {open && (
        <div style={{
          position: "absolute",
          bottom: "60px",
          left: 0,
          width: "360px",
          height: "500px",
          background: "var(--kite-surface)",
          border: "1px solid var(--kite-border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 8px 40px rgba(61, 46, 15, 0.15)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.2s ease",
        }}>
          <ChatBox tickers={tickers} />
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? "Close chat" : "Ask Kite"}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: open ? "var(--kite-heading)" : "var(--kite-amber-dark)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: open ? "18px" : "20px",
          boxShadow: "0 4px 16px rgba(196, 125, 10, 0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s, transform 0.15s",
          transform: open ? "scale(0.95)" : "scale(1)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = open ? "scale(0.95)" : "scale(1)"; }}
      >
        {open ? "✕" : "✦"}
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
