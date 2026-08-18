# AI Gateway — Provider Abstraction + Model Registry (Day 2)

A fresh, isolated stack implementing the Day 2 objective: decoupling
the HTTP API from any single AI provider via a provider adapter
interface and a database-backed model registry.

## Quick start

```bash
./scripts/deploy-ai-gateway-1-of-10.sh init
./scripts/deploy-ai-gateway-1-of-10.sh build
./scripts/deploy-ai-gateway-1-of-10.sh deploy
./scripts/deploy-ai-gateway-1-of-10.sh ps
```

Then:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/dependencies
curl -X POST http://localhost:8080/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "hello"}'
```

## Endpoints

| Method | Path            | Purpose                                      |
|--------|-----------------|-----------------------------------------------|
| GET    | /health         | Liveness                                      |
| GET    | /ready          | Readiness (DB connectivity)                   |
| GET    | /dependencies   | DB/Redis/provider diagnostics (container-side)|
| GET    | /help           | Endpoint listing                              |
| GET    | /metrics        | Prometheus metrics                            |
| POST   | /v1/chat        | Chat via resolved provider/model              |

## Configuration

Copy `.env.example` to `.env` and fill in real values. See that file
for all variables. No credentials are ever committed; `.env` is
gitignored.

To enable Groq:

```
GROQ_ENABLED=true
GROQ_API_KEY=<your key>
AI_DEFAULT_PROVIDER=groq
AI_DEFAULT_MODEL=llama-3.1-8b-instant
```

If no provider is enabled, `/v1/chat` responds with a controlled
`503 NO_PROVIDER_CONFIGURED` error rather than fabricating a reply.

## Architecture, dependencies, observability

See `ARCHITECTURE.md`, `DEPENDENCIES.md`, `OBSERVABILITY.md`, and
`CHECKPOINT.md`.

## Testing

```bash
npm install
npm test              # unit tests (route/registry logic, no live DB/provider)
bash scripts/secret-scan.sh
bash scripts/dependency-check.sh   # host-side; some FAILs expected, see DEPENDENCIES.md
```
# PROMPT-02-PROVIDERS-STACK-ARCHITECT
# PROMPT-02-PROVIDERS-STACK-ARCHITECT
# PROMPT-02-PROVIDERS-STACK-ARCHITECT
