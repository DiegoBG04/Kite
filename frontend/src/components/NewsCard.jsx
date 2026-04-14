/**
 * NewsCard.jsx — News Feed Card with Kite AI Summary
 *
 * Purpose: Displays one news article in the News page feed.
 * Shows the title, source name, timestamp, ticker tags, Kite's AI summary,
 * and a "Read full article" link that opens the original article in a new tab.
 *
 * Used by: News.jsx
 *
 * Props:
 *   title       (string)   — article headline
 *   source      (string)   — publication name e.g. "Reuters"
 *   publishedAt (string)   — ISO date string e.g. "2025-04-12T14:30:00Z"
 *   tickers     (string[]) — ticker symbols mentioned in the article
 *   summary     (string)   — Kite AI summary (1–2 sentences)
 *   url         (string)   — link to the full article
 *
 * TODO (Step 8): Format publishedAt into a human-readable relative date.
 */

export default function NewsCard({ title, source, publishedAt, tickers = [], summary, url }) {
  return (
    <div>
      <h3>{title}</h3>

      <div>
        <span>{source}</span>
        <span>{publishedAt}</span>
        {tickers.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>

      <p>
        <strong>Kite summary: </strong>{summary}
      </p>

      <a href={url} target="_blank" rel="noopener noreferrer">
        Read full article
      </a>
    </div>
  );
}
