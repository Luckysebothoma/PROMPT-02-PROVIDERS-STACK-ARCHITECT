-- ============================================================
-- 001_init.sql
-- Baseline schema carried forward conceptually from Stack 01.
-- This is a fresh stack (per instruction), so we re-establish the
-- minimal persistence foundation needed before the Day 2 registry.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS chat_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      TEXT NOT NULL,
    provider        TEXT,
    model           TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    total_tokens    INTEGER,
    error_code      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_requests_created_at ON chat_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_chat_requests_provider_model ON chat_requests (provider, model);
