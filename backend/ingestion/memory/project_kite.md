---
name: Project Kite
description: AI portfolio intelligence tool — full tech stack, repo structure, build order
type: project
---

Project name: **Kite**. GitHub repo: "Kite". Solo build by Diego (2nd-year CE student at UofT). Team will grow to 2–3 people.

**What it is:** AI agent that ingests SEC filings, earnings transcripts, and news into pgvector, then answers natural language questions about a stock portfolio with mandatory source citations. Information layer only — no buy/sell signals.

**Tech stack:**
- Backend: Python, FastAPI, APScheduler — hosted on Railway
- Vector store: pgvector on Supabase (free tier), 384-dim all-MiniLM-L6-v2 embeddings
- LLM: Anthropic Claude (haiku-4-5 for speed, sonnet-4-6 for quality)
- Data: sec-edgar-downloader, yfinance, NewsAPI
- Frontend: React + Vite — deployed on Vercel
- NOT Next.js — ignore Next.js/App Router suggestions

**Local code location:** `/Users/diegobarriga/Downloads/AI Project/kite/`

**Build order:**
1. ✅ Supabase SQL schema (supabase_schema.sql)
2. ✅ Scaffold directory structure
3. ✅ edgar.py + chunker.py + embedder.py + store.py — fully implemented
4. ✅ test_pipeline.py — integration test
5. Next: retriever.py + reasoner.py (RAG query pipeline)
6. Next: test_query.py
7. Next: Wrap in FastAPI (main.py routes)
8. Next: React frontend components (unstyled)
9. Next: Connect frontend via client.js
10. Next: End-to-end browser test

**NOT building yet:** user auth (Week 7), paid data sources (Polygon, Benzinga), Twitter/X sentiment.

**Why:** Always ask before any architectural decision not in the spec. The spec is the source of truth.

**How to apply:** Follow the build order strictly. Step N must pass tests before starting step N+1.
