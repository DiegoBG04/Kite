/**
 * CompanyLogo.jsx — Company logo with letter-badge fallback
 *
 * Tries to load a logo from FMP's free public logo CDN.
 * If the image fails (unknown ticker, network issue), renders
 * the original letter badge so nothing ever looks broken.
 *
 * Props:
 *   ticker   — e.g. "AAPL"
 *   size     — px, applied to both width and height (default 32)
 *   radius   — border-radius value (default var(--radius-sm))
 */

import { useState } from "react";

export default function CompanyLogo({ ticker, size = 32, radius = "var(--radius-sm)" }) {
  const [failed, setFailed] = useState(false);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--kite-amber-wash)",
    border: "1px solid var(--kite-border)",
  };

  if (failed) {
    return (
      <div style={containerStyle}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: Math.max(9, size * 0.34),
          fontWeight: "700",
          color: "var(--kite-amber-dark)",
          letterSpacing: "0.02em",
          lineHeight: 1,
        }}>
          {ticker.slice(0, 2)}
        </span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <img
        src={`https://financialmodelingprep.com/image-stock/${ticker}.png`}
        alt={ticker}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}
