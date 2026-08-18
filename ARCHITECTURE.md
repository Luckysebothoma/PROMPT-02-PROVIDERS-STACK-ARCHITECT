# Architecture — Day 2: Provider Abstraction + Model Registry

## Request flow

```
HTTP API (POST /v1/chat)
   |
   v
Request Resolver (ModelRegistry.resolve)
   |
   v
Model Registry (PostgreSQL: providers, models)
   |
   v
Provider Adapter (ProviderRegistry -> GroqProvider, etc.)
   |
   v
External AI Provider (Groq API)
```

The route handler (`api/routes/chat.js`) never talks to a provider
SDK directly. It only calls `ModelRegistry.resolve()` to get a
`{ provider, model, meta }` tuple, then `ProviderRegistry.get(provider)`
to get an adapter, then `adapter.chat(...)`.

## Components

- **ProviderAdapter interface** (`api/providers/provider.interface.js`)
  — the contract every provider adapter implements: `chat()`,
  `health()`, `metadata()`. Also defines `ProviderError`, a structured
  error type so raw provider error bodies/headers are never forwarded
  to the HTTP client.

- **GroqProvider** (`api/providers/groq.provider.js`) — the one real
  cloud provider adapter implemented in Day 2. Calls Groq's
  OpenAI-compatible `/chat/completions` endpoint.

- **ProviderRegistry** (`api/providers/provider.registry.js`) — builds
  adapter instances from `.env` configuration. Gemini is *declared*
  (so `/dependencies` can report on it) but has no adapter yet —
  reported as `not_implemented`, per Day 2 scope.

- **ModelRegistry** (`api/providers/model.registry.js`) — loads
  `providers`/`models` rows from PostgreSQL (30s in-memory cache) and
  implements deterministic resolution.

## Resolution order (implemented)

1. Explicit `provider` + explicit `model` in the request body.
2. Explicit `provider` only → first enabled model for that provider.
3. Explicit `model` only → resolved if unambiguous across providers,
   otherwise a structured `MODEL_AMBIGUOUS` error.
4. `AI_DEFAULT_PROVIDER` + `AI_DEFAULT_MODEL` from `.env`.
5. Controlled failure: `NO_PROVIDER_CONFIGURED` (HTTP 503). No
   provider or model is ever invented.

Agent/model mapping (the "3. configured agent/model mapping" step
from the general recommended order) is **NOT implemented** — that is
PROMPT-03 (Agent Registry) scope.

## Database schema (Day 2 additions)

See `migrations/002_provider_model_registry.sql`.

- `providers`: catalog of provider names, display names, a catalog
  `enabled` flag, and `base_url`. No secrets.
- `models`: catalog of provider-scoped models with category,
  capability flags, and a `logical_alias` column reserved (unused in
  Day 2) for future alias-based resolution (e.g. `"fast-chat"`).
- `chat_requests.model_id`: new FK column linking a persisted chat
  request to the resolved model row.

Secrets (API keys) live only in `.env` / process environment, never
in PostgreSQL.

## Failure handling

- No provider configured at all → `503 NO_PROVIDER_CONFIGURED`.
- Requested provider/model not registered → `404 MODEL_NOT_FOUND` /
  `404 PROVIDER_NOT_FOUND`.
- Model registered but disabled → `404 MODEL_DISABLED`.
- Model registered+enabled but provider has no credentials in
  `.env` → `503 PROVIDER_NOT_CONFIGURED`.
- Provider call fails (network/HTTP/parse error) → `502` (or the
  adapter-specified status), with a structured `error.code` and a
  generic message. The raw provider response is never returned to
  the client; it is only passed as `cause` on the internal
  `ProviderError` for server-side logging.

## Status

**IMPLEMENTED**: provider interface, Groq adapter, provider registry,
model registry + resolution, `/v1/chat` wiring, `/dependencies`
provider health, token usage capture (when Groq supplies it),
Day-2 metrics, migrations, tests, deployment script `init`
provider-config reporting.

**PLANNED** (structure exists, logic does not): `models.logical_alias`
column for logical model names (e.g. `"fast-chat"`); Redis-backed
request/response caching abstraction.

**NOT IMPLEMENTED**: Gemini adapter (config declared only), agent
registry / agent-to-model mapping, RAG, vector DB, streaming
responses, token estimation/fabrication, authentication, billing.
