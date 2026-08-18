# CHECKPOINT

## Iteration

PROMPT-02 — Provider Abstraction + Model Registry

## Implemented

- `ProviderAdapter` interface + `ProviderError` (`api/providers/provider.interface.js`)
- `GroqProvider` real adapter calling Groq's OpenAI-compatible API (`api/providers/groq.provider.js`)
- `ProviderRegistry` built from `.env` (`api/providers/provider.registry.js`); Gemini declared but reported `not_implemented`
- `ModelRegistry` with deterministic resolution against PostgreSQL-backed catalog (`api/providers/model.registry.js`)
- Migration `002_provider_model_registry.sql`: `providers`, `models` tables, `chat_requests.model_id` FK, `logical_alias` column reserved for future aliasing
- `/v1/chat` rewired through resolver → adapter → usage extraction → persistence → response envelope
- `/dependencies` extended with container-side DNS/TCP/application checks (explicit test-location labeling) and provider health summary
- Day 2 Prometheus metrics: `ai_gateway_provider_requests_total`, `_errors_total`, `_request_duration_seconds`, `_input_tokens_total`, `_output_tokens_total`
- Grafana dashboard panels: request rate, error rate, p95 latency, tokens by provider, tokens by model
- `deploy-ai-gateway-1-of-10.sh`: `init` now reports provider configuration state; all 8 required commands (`init build push deploy ps logs test help`) preserved
- Improved `secret-scan.sh`: distinguishes variable references / placeholder test values / real credential patterns; never prints secret values
- `dependency-check.sh`: host-side script, explicitly labels host vs. container test location per the Day 1 lesson
- Docs: README, ARCHITECTURE, DEPENDENCIES, OBSERVABILITY (this file is CHECKPOINT)

## Tests

Executed via `node --test tests/*.test.js` — **18/18 passing**:

- `tests/provider.test.js` (6 tests): provider registry disabled-by-default, enabled+configured, Gemini not_implemented, missing-config health, Groq adapter unconfigured error, Groq adapter health states
- `tests/model-registry.test.js` (6 tests): explicit provider+model resolution, invalid model, invalid provider, disabled model, default-provider/model fallback, no-config controlled failure, provider-not-configured-despite-registered-model
- `tests/chat.test.js` (5 tests): missing message → 400, no provider → 503, adapter missing → 503, successful chat envelope shape, provider error not leaked to client (verified no secret substring present in response)

Also executed and verified:

- `node --check` on all 17 JS files — all pass
- YAML validation (`docker-compose.yml`, `prometheus.yml`, Grafana provisioning) via `python3 -c "yaml.safe_load(...)"` — all pass
- SQL migrations parsed with `sqlparse`, parenthesis-balance checked — both pass
- `bash scripts/secret-scan.sh` — PASS on clean tree; verified it correctly FAILs when a real-looking Groq key pattern is injected (regression check, then removed)
- `bash scripts/dependency-check.sh` (host) — ran; DNS/TCP FAIL for Docker service hostnames as expected per Day 1 lesson (documented, not a defect)
- In-process smoke test of `/health`, `/help`, `/metrics`, `/v1/chat` (no-provider path) against the real Hono app — all returned expected status/shape

## Skipped

- Live Groq API call (`chat()` against the real endpoint) — **SKIPPED**, no `GROQ_API_KEY` available in this environment. Not claimed as passing.
- `docker compose config` / actual container build+run — **NOT AVAILABLE**, no Docker daemon in this environment. Compose YAML was validated for syntax only, not deployed.

## Known limitations

- Model catalog seeded with one verified-at-write-time Groq model id (`llama-3.1-8b-instant`); operators must confirm against Groq's current model list before production use (documented in migration comments).
- `logical_alias` column exists but no alias resolution logic is implemented.
- Redis caching abstraction is not wired into `/v1/chat`.
- Gemini adapter not implemented — config-only.
- Compose stack was not actually deployed/started in this environment (no Docker); all validation above is static/unit-level plus an in-process route smoke test.

## Next iteration

PROMPT-03 — Agent Registry + Agent Resolution (not implemented here).
