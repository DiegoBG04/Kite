-- Kite — Supabase pgvector Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query
--
-- Changes from the original spec:
--   1. Added fiscal_year TEXT column (needed for upsert deduplication)
--   2. Added UNIQUE constraint on (ticker, doc_type, fiscal_year, chunk_index)
--      so that re-ingesting the same filing updates rows rather than duplicating them
--   3. Added ivfflat index for fast approximate nearest-neighbour search

-- Enable the pgvector extension (only needs to run once per database)
CREATE EXTENSION IF NOT EXISTS vector;

-- Main document store — one row per chunk
CREATE TABLE IF NOT EXISTS documents (
    id           BIGSERIAL PRIMARY KEY,
    ticker       TEXT        NOT NULL,          -- e.g. "AAPL"
    doc_type     TEXT        NOT NULL,          -- e.g. "10-K", "10-Q", "earnings", "news"
    fiscal_year  TEXT        NOT NULL DEFAULT '',  -- e.g. "2024" (added vs original spec)
    source_label TEXT,                          -- e.g. "10-K FY2024"
    source_url   TEXT,                          -- direct link to the original document
    page_number  INT,                           -- page in the SEC filing, if extractable
    chunk_index  INT         NOT NULL,          -- sequential chunk number within the document
    content      TEXT        NOT NULL,          -- the raw text of this chunk
    embedding    vector(384) NOT NULL,          -- all-MiniLM-L6-v2 produces 384 dimensions
    metadata     JSONB,                         -- extra fields: token_count, accession_number, etc.
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint — prevents duplicate chunks on re-ingestion.
-- ON CONFLICT (ticker, doc_type, fiscal_year, chunk_index) in store.py relies on this.
ALTER TABLE documents
    ADD CONSTRAINT documents_unique_chunk
    UNIQUE (ticker, doc_type, fiscal_year, chunk_index);

-- IVFFlat approximate nearest-neighbour index for cosine similarity search.
-- 'lists = 100' is a good default for up to ~1M rows (increase for more rows).
-- Build this AFTER inserting your first batch of data for best performance.
CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Optional: useful for filtering by ticker before the vector search
CREATE INDEX IF NOT EXISTS documents_ticker_idx ON documents (ticker);
CREATE INDEX IF NOT EXISTS documents_doc_type_idx ON documents (doc_type);
