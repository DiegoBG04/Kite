/**
 * ChatBox.jsx — "Ask Kite" Chat Interface
 *
 * Purpose: Lets the user ask natural language questions about their portfolio.
 * Sends questions to POST /query via client.queryKite() and renders the
 * conversation history. Each Kite response shows a SourcedBadge and
 * clickable SourcePills so every claim is traceable.
 *
 * Used by: Dashboard.jsx (left panel, bottom)
 *
 * Props:
 *   tickers (string[]) — portfolio tickers passed to /query to focus the search
 *
 * TODO (Step 8): Implement send, loading state, and error handling.
 */

import { useState } from "react";
import { queryKite } from "../api/client";
import SourcedBadge from "./SourcedBadge";
import SourcePill from "./SourcePill";

export default function ChatBox({ tickers = [] }) {
  // Each message: { role: "user"|"kite", text, sources, sourced }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    // Append the user's message immediately
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      // TODO (Step 9): queryKite() is not yet implemented — remove this throw
      // when client.js is wired up
      const response = await queryKite(question, tickers);
      setMessages((prev) => [
        ...prev,
        {
          role: "kite",
          text: response.answer,
          sources: response.sources,
          sourced: response.sourced,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div>
      <strong>Ask Kite</strong>

      {/* Conversation history */}
      <div>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.role === "user" ? "You" : "Kite"}</strong>
            <p>{msg.text}</p>

            {/* Source attribution for Kite responses */}
            {msg.role === "kite" && msg.sourced && (
              <div>
                <SourcedBadge />
                {msg.sources?.map((src, j) => (
                  <SourcePill
                    key={j}
                    label={src.label}
                    url={src.source_url}
                    timestamp={src.timestamp}
                    publishedAt={src.published_at}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && <div>Kite is thinking...</div>}
        {error && <div>Error: {error}</div>}
      </div>

      {/* Input area */}
      <div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your portfolio..."
          rows={2}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
