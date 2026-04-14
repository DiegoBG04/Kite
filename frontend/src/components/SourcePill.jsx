/**
 * SourcePill.jsx — Clickable Source Citation Badge
 *
 * Purpose: Renders a single source citation as a small clickable badge.
 * Opens the source URL in a new tab. Shows a timestamp if the source is
 * an earnings call, or a date if it's a news article.
 *
 * Used by: InsightCard.jsx, ChatBox.jsx
 *
 * Props:
 *   label       (string)  — e.g. "10-K FY2024"
 *   url         (string)  — opens in new tab on click
 *   timestamp   (string)  — optional, earnings call time e.g. "14:32"
 *   publishedAt (string)  — optional, news date e.g. "Apr 12"
 *
 * TODO (Step 8): Implement component.
 */

export default function SourcePill({ label, url, timestamp, publishedAt }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {label}
      {timestamp && ` · ${timestamp}`}
      {publishedAt && ` · ${publishedAt}`}
    </a>
  );
}
