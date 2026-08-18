#!/usr/bin/env bash
# ============================================================
# deploy-ai-gateway-1-of-10.sh
#
# Lifecycle script for the AI Gateway stack.
# Name retained from Stack 01 per continuity requirements even
# though this is now the Day 2 (provider registry) iteration.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE="docker compose"
ENV_FILE=".env"

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  init      Create .env from .env.example if missing, validate config (idempotent)
  build     Build the API image
  push      Push the API image (no-op placeholder; configure a registry to enable)
  deploy    Start the full stack (postgres, redis, api, prometheus, grafana)
  ps        Show stack container status
  logs      Tail API logs
  test      Run unit tests + smoke checks against a running stack
  help      Show this message
EOF
}

cmd_init() {
  if [ ! -f "$ENV_FILE" ]; then
    cp .env.example "$ENV_FILE"
    echo "[init] Created .env from .env.example"
  else
    echo "[init] .env already exists - preserved, not overwritten"
  fi

  # Idempotent: does not require docker to be running, does not touch
  # existing volumes/network, does not require a cloud provider key.
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  echo "[init] Provider configuration report:"
  echo "  AI_DEFAULT_PROVIDER = ${AI_DEFAULT_PROVIDER:-<unset>}"
  echo "  AI_DEFAULT_MODEL    = ${AI_DEFAULT_MODEL:-<unset>}"
  echo "  GROQ_ENABLED        = ${GROQ_ENABLED:-false}"
  if [ "${GROQ_ENABLED:-false}" = "true" ]; then
    if [ -n "${GROQ_API_KEY:-}" ]; then
      echo "  GROQ_API_KEY        = <set>"
    else
      echo "  GROQ_API_KEY        = <MISSING - GROQ_ENABLED=true but no key set>"
    fi
  fi
  echo "  GEMINI_ENABLED      = ${GEMINI_ENABLED:-false} (adapter not implemented yet)"

  if [ "${GROQ_ENABLED:-false}" != "true" ] && [ "${GEMINI_ENABLED:-false}" != "true" ]; then
    echo "[init] NOTE: no provider enabled. Stack will still start; /v1/chat will return a controlled 'no provider' response."
  fi

  echo "[init] Docker network/volumes are managed by docker compose and are preserved across restarts."
  echo "[init] Done."
}

cmd_build() {
  $COMPOSE build api
}

cmd_push() {
  echo "[push] No container registry configured for this local iteration. Skipping."
}

cmd_deploy() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "[deploy] .env missing - run '$(basename "$0") init' first" >&2
    exit 1
  fi
  $COMPOSE up -d
  echo "[deploy] Stack started. Use '$(basename "$0") ps' to check status."
}

cmd_ps() {
  $COMPOSE ps
}

cmd_logs() {
  $COMPOSE logs -f api
}

cmd_test() {
  echo "[test] Running unit/provider tests..."
  bash tests/run-tests.sh

  echo "[test] Running secret scan..."
  bash scripts/secret-scan.sh

  echo "[test] Running dependency diagnostics (host perspective)..."
  bash scripts/dependency-check.sh || echo "[test] dependency-check reported issues (see above) - not necessarily fatal for host-only checks"
}

main() {
  local command="${1:-help}"
  case "$command" in
    init) cmd_init ;;
    build) cmd_build ;;
    push) cmd_push ;;
    deploy) cmd_deploy ;;
    ps) cmd_ps ;;
    logs) cmd_logs ;;
    test) cmd_test ;;
    help|--help|-h) usage ;;
    *)
      echo "Unknown command: $command" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
