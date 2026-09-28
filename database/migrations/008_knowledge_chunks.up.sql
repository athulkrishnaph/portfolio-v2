-- Knowledge base for the portfolio chatbot (RAG: retrieval-augmented generation).
--
-- Requires the pgvector extension (see README → "pgvector setup").
-- The first CREATE EXTENSION must be run by a superuser; once the extension
-- exists in the database, this statement is a harmless no-op for any user.
CREATE EXTENSION IF NOT EXISTS vector;

-- One row per chunk of portfolio text plus its embedding. Rows are derived
-- data: `go run ./cmd/ingest` (or the admin "Rebuild" button) rebuilds them
-- from the content tables, so this table is never edited by hand.
CREATE TABLE knowledge_chunks (
    id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Stable identity of a chunk, e.g. "projects:3" or "resume:2". Re-indexing
    -- updates rows in place by this key instead of inserting duplicates.
    chunk_key    TEXT        NOT NULL UNIQUE,
    source       TEXT        NOT NULL CHECK (source <> ''),  -- profile, projects, resume, ...
    title        TEXT        NOT NULL CHECK (title <> ''),
    section      TEXT        NOT NULL DEFAULT '',
    url          TEXT        NOT NULL DEFAULT '',             -- page shown as the citation link
    content      TEXT        NOT NULL CHECK (btrim(content) <> ''),
    -- SHA-256 of the embedded text + embedding model + dimensions. Unchanged
    -- chunks are skipped on re-index, which saves embedding API quota.
    content_hash TEXT        NOT NULL,
    -- The dimension must match GEMINI_EMBEDDING_DIMENSIONS (the API checks
    -- this at startup). Changing it needs a new migration + re-index; see README.
    embedding    vector(768) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No vector index on purpose: a portfolio has tens of chunks, and an exact
-- scan is both faster and more accurate than an approximate (HNSW/IVFFlat)
-- index at that size. See README for when to add one.

CREATE TRIGGER knowledge_chunks_set_updated_at
    BEFORE UPDATE ON knowledge_chunks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Text extracted from uploaded files (currently the resume PDF), cached by the
-- file's hash so the file is only sent to Gemini again when it changes.
CREATE TABLE knowledge_documents (
    document_key TEXT        PRIMARY KEY,           -- e.g. "resume"
    file_hash    TEXT        NOT NULL,
    text         TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER knowledge_documents_set_updated_at
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
