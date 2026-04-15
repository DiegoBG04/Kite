/**
 * ChatBox.jsx — "Ask Kite" Chat Interface
 */

import { useState, useRef, useEffect } from "react";
import { queryKite } from "../api/client";
import SourcedBadge from "./SourcedBadge";
import SourcePill from "./SourcePill";

export default function ChatBox({ tickers = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await queryKite(question, tickers);
      setMessages((prev) => [...prev, {
        role: "kite",
        text: response.answer,
        sources: response.sources,
        sourced: response.sourced,
      }]);
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        fontSize: "10px",
        fontWeight: "700",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--kite-muted)",
        marginBottom: "10px",
      }}>
        Ask Kite
      </div>

      {/* Message history */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "10px" }}>
        {messages.length === 0 && (
          <p style={{ fontSize: "12px", color: "var(--kite-muted)", fontStyle: "italic" }}>
            Ask about risk factors, revenue trends, or anything in the SEC filings.
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div style={{
                fontSize: "13px",
                color: "var(--kite-body)",
                background: "var(--kite-amber-wash)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                alignSelf: "flex-end",
              }}>
                {msg.text}
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "var(--kite-amber-dark)",
                    fontFamily: "var(--font-display)",
                  }}>
                    Kite
                  </span>
                  {msg.sourced && <SourcedBadge />}
                </div>
                <p style={{
                  fontSize: "13px",
                  color: "var(--kite-body)",
                  lineHeight: "1.65",
                  marginBottom: "8px",
                }}>
                  {msg.text}
                </p>
                {msg.sourced && msg.sources?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {msg.sources.map((src, j) => (
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
            )}
          </div>
        ))}

        {loading && (
          <div style={{ fontSize: "12px", color: "var(--kite-muted)", fontStyle: "italic" }}>
            Kite is thinking…
          </div>
        )}
        {error && (
          <div style={{ fontSize: "12px", color: "var(--kite-negative)" }}>
            Error: {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: "6px" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your portfolio…"
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            padding: "8px 10px",
            fontSize: "13px",
            fontFamily: "var(--font-body)",
            color: "var(--kite-body)",
            background: "var(--kite-cream)",
            border: "1px solid var(--kite-border)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
            lineHeight: "1.5",
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: "0 14px",
            background: input.trim() && !loading ? "var(--kite-amber-dark)" : "var(--kite-border)",
            color: input.trim() && !loading ? "#fff" : "var(--kite-muted)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontSize: "13px",
            fontWeight: "600",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            transition: "background 0.15s",
            alignSelf: "stretch",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
