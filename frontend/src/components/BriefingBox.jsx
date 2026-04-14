/**
 * BriefingBox.jsx — Collapsible Morning Portfolio Briefing
 *
 * Purpose: Shows the daily Kite briefing (from GET /briefing/{date}).
 * Collapsed by default — shows a preview of the first item. Clicking
 * expands the full list. Each item has clickable source attribution.
 *
 * Used by: Dashboard.jsx (left panel, top)
 *
 * Props:
 *   items (Object[]) — BriefingItem array from BriefingResponse:
 *                      [{ text, source_label, source_url, ticker }]
 *
 * TODO (Step 8): Implement expand/collapse behaviour and source links.
 */

import { useState } from "react";

export default function BriefingBox({ items = [] }) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return <div>No briefing available for today.</div>;
  }

  const visibleItems = expanded ? items : items.slice(0, 1);

  return (
    <div>
      <strong>Morning Briefing</strong>

      {visibleItems.map((item, i) => (
        <div key={i}>
          <p>{item.text}</p>
          <a href={item.source_url} target="_blank" rel="noopener noreferrer">
            {item.source_label}
          </a>
        </div>
      ))}

      {items.length > 1 && (
        <button onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : `Show ${items.length - 1} more`}
        </button>
      )}
    </div>
  );
}
