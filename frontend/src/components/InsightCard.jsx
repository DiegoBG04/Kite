/**
 * InsightCard.jsx — Key Insight with Source Pills
 *
 * Purpose: Displays a Kite-generated insight (from the /query endpoint or
 * briefing) alongside the SourcedBadge and SourcePill components that let
 * the user trace the claim back to its original document.
 *
 * Used by: Dashboard.jsx (right panel, below StockChart)
 *
 * Props:
 *   insight (string)   — the insight text with inline [citations]
 *   sources (Object[]) — array of SourceItem objects from QueryResponse
 *
 * TODO (Step 8): Implement component.
 */

import SourcedBadge from "./SourcedBadge";
import SourcePill from "./SourcePill";

export default function InsightCard({ insight, sources }) {
  return (
    <div>
      <SourcedBadge />
      <p>{insight}</p>
      <div>
        {sources?.map((source, i) => (
          <SourcePill
            key={i}
            label={source.label}
            url={source.source_url}
            timestamp={source.timestamp}
            publishedAt={source.published_at}
          />
        ))}
      </div>
    </div>
  );
}
