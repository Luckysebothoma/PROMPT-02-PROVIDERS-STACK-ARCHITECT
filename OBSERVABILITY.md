# Observability

## Metrics (Day 2 additions)

Exposed at `GET /metrics` in Prometheus text format.

| Metric                                             | Type      | Labels                                  |
|-----------------------------------------------------|-----------|-------------------------------------------|
| `ai_gateway_provider_requests_total`                | Counter   | `provider`, `model`, `operation`, `status`|
| `ai_gateway_provider_errors_total`                  | Counter   | `provider`, `model`, `operation`, `status`|
| `ai_gateway_provider_request_duration_seconds`      | Histogram | `provider`, `model`, `operation`, `status`|
| `ai_gateway_provider_input_tokens_total`            | Counter   | `provider`, `model`                       |
| `ai_gateway_provider_output_tokens_total`           | Counter   | `provider`, `model`                       |

Labels are bounded and never include `request_id`, prompt/instruction
text, or raw provider responses — see `api/lib/metrics.js`.

Standard Node.js process metrics (`process_cpu_*`, `process_resident_memory_bytes`,
etc.) are also exposed via `prom-client`'s default collector.

## Grafana dashboard

`grafana/dashboards/ai-gateway-dashboard.json` extends the existing
dashboard concept with panels for:

- Provider request rate
- Provider error rate
- Provider latency (p95)
- Tokens by provider
- Tokens by model

Provisioned automatically via `grafana/provisioning/`.

## Logging

Structured JSON logs via `api/lib/logger.js`. Log levels: `debug`,
`info`, `warn`, `error`, controlled by `LOG_LEVEL`. Secrets are never
logged; provider error handling in `api/routes/chat.js` logs only
`error.code`, not the raw provider response body.

## Token accounting

Captured from the provider response when available (Groq returns
`usage.prompt_tokens` / `completion_tokens` / `total_tokens`).
Persisted to `chat_requests.input_tokens` / `output_tokens` /
`total_tokens`. If a provider does not supply usage, these columns
are `NULL` — tokens are never estimated or invented.

## Status

**IMPLEMENTED**: all five metrics above, dashboard panels, structured
logging, DB-persisted token usage.

**NOT IMPLEMENTED**: token estimation for providers that omit usage,
alerting rules, log shipping/aggregation.
