-- ============================================================
-- 002_provider_model_registry.sql
-- Provider abstraction + model registry (Day 2)
--
-- Do NOT modify 001_init.sql. This migration is additive only.
-- API keys / secrets are NEVER stored here - configuration only.
-- ============================================================

CREATE TABLE IF NOT EXISTS providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,       -- stable machine key, e.g. "groq"
    display_name    TEXT NOT NULL,              -- human label, e.g. "Groq"
    enabled         BOOLEAN NOT NULL DEFAULT false,
    base_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS models (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id           UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    model_key             TEXT NOT NULL,          -- provider-native model id
    display_name          TEXT NOT NULL,
    category              TEXT NOT NULL,          -- chat, reasoning, code, json, ...
    enabled               BOOLEAN NOT NULL DEFAULT false,
    temperature_default   NUMERIC(3,2),
    context_window        INTEGER,
    supports_streaming    BOOLEAN NOT NULL DEFAULT false,
    supports_json         BOOLEAN NOT NULL DEFAULT false,
    supports_tools        BOOLEAN NOT NULL DEFAULT false,
    -- Reserved for future logical-name aliasing (e.g. "fast-chat" -> this row).
    -- Not populated with alias logic in Day 2; column exists so the
    -- structure supports it later without another migration.
    logical_alias         TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_id, model_key)
);

CREATE INDEX IF NOT EXISTS idx_models_provider_id ON models (provider_id);
CREATE INDEX IF NOT EXISTS idx_models_category ON models (category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_logical_alias ON models (logical_alias) WHERE logical_alias IS NOT NULL;

-- Token usage is captured per chat_request (see 001_init.sql).
-- Link chat_requests to the resolved model for reporting/joins.
ALTER TABLE chat_requests
    ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES models(id);

-- ------------------------------------------------------------
-- Seed data: provider + model CATALOG rows only.
--
-- IMPORTANT: "enabled" here is a catalog flag (is this row usable
-- in principle). Actual availability at runtime additionally
-- requires the provider to be enabled+credentialed via .env
-- (see ProviderRegistry). A model can be enabled=true here and
-- still be unusable if GROQ_API_KEY is not set.
--
-- The model_key below is a real, documented Groq model id at the
-- time this migration was written. Groq may deprecate or rename
-- models. Operators MUST verify against https://console.groq.com/docs/models
-- before relying on this in production, and update this table
-- (or add a new migration) rather than assuming it stays accurate.
-- ------------------------------------------------------------

INSERT INTO providers (name, display_name, enabled, base_url)
VALUES
    ('groq', 'Groq', true, 'https://api.groq.com/openai/v1'),
    ('gemini', 'Google Gemini', false, 'https://generativelanguage.googleapis.com/v1beta')
ON CONFLICT (name) DO NOTHING;

INSERT INTO models (provider_id, model_key, display_name, category, enabled, temperature_default, supports_streaming, supports_json, supports_tools)
SELECT
    p.id,
    'llama-3.1-8b-instant',
    'Llama 3.1 8B Instant',
    'chat',
    true,
    0.70,
    true,
    true,
    false
FROM providers p WHERE p.name = 'groq'
ON CONFLICT (provider_id, model_key) DO NOTHING;
