# Dependencies

## Runtime dependencies

- PostgreSQL 16 (`ai-gateway-postgres-db`) — chat request log,
  provider/model registry.
- Redis 7 (`ai-gateway-redis`) — reserved for future caching
  (abstraction only in Day 2, not used for AI responses yet).
- Prometheus (`ai-gateway-prometheus`) — scrapes `/metrics`.
- Grafana (`ai-gateway-grafana`) — dashboards over Prometheus data.
- One external AI provider (Groq), reached over HTTPS, only when
  `GROQ_ENABLED=true` and `GROQ_API_KEY` is set.

## Host vs. container network reachability

**These are not the same thing.** (See Day 1 lesson.)

Docker Compose service hostnames (`ai-gateway-postgres-db`,
`ai-gateway-redis`) are resolvable **inside the Docker network** — by
the `api` container — but are generally **not resolvable from the
host** unless the host has custom DNS/hosts configuration.

Every dependency check in this project reports its execution
location explicitly:

| Check                                  | Test location | Expected result (typical dev host) |
|-----------------------------------------|----------------|--------------------------------------|
| `GET /dependencies`                     | container      | DNS PASS, TCP PASS, application PASS/FAIL depending on stack state |
| `scripts/dependency-check.sh`           | host           | DNS FAIL, TCP FAIL for service hostnames (expected, not a bug) |
| `scripts/dependency-check.sh` (API port)| host           | DNS/TCP PASS if the stack is deployed and the port is published |

Do not "fix" a host-side DNS FAIL for a Docker service hostname by
hardcoding an IP address. Use `GET /dependencies` (container-side)
as the source of truth for internal connectivity.

## AI provider status

`GET /dependencies` includes a `providers` object, e.g.:

```json
{
  "groq": { "enabled": true, "configured": true, "status": "available" },
  "gemini": { "enabled": false, "configured": false, "status": "not_implemented" }
}
```

This is a lightweight configuration check (enabled + credential
present), not a live API call — `/dependencies` does not call Groq
on every request.

## Secrets

No API keys, passwords, tokens, or private keys are stored in
tracked files. `.env` is gitignored. `.env.example` documents
variable names only. Verified by `scripts/secret-scan.sh`.
