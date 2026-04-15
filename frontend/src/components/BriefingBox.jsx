/**
 * BriefingBox.jsx — Collapsible Morning Portfolio Briefing
 */

import { useState } from "react";

export default function BriefingBox({ items = [] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      padding: "16px",
      borderBottom: "1px solid var(--kite-border)",
    }}>
      <div style={{
        fontSize: "10px",
        fontWeight: "700",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--kite-muted)",
        marginBottom: "8px",
      }}>
        Morning Briefing
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--kite-muted)" }}>
          No briefing available yet.
        </p>
      ) : (
        <>
          {(expanded ? items : items.slice(0, 1)).map((item, i) => (
            <div key={i} style={{ marginBottom: "8px" }}>
              <p style={{ fontSize: "13px", color: "var(--kite-body)", lineHeight: "1.6" }}>
                {item.text}
              </p>
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--kite-amber-dark)",
                }}
              >
                {item.source_label}
              </a>
            </div>
          ))}

          {items.length > 1 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              style={{
                fontSize: "12px",
                color: "var(--kite-amber-dark)",
                background: "none",
                border: "none",
                padding: "0",
                cursor: "pointer",
                marginTop: "4px",
              }}
            >
              {expanded ? "Show less" : `+${items.length - 1} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
