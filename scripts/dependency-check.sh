#!/usr/bin/env bash
# ============================================================
# dependency-check.sh
#
# Runs from the HOST. Reports host-side DNS/TCP reachability for
# Docker Compose service hostnames. This is expected to potentially
# FAIL for service DNS names (they are only resolvable inside the
# Docker network) - see Day 1 lesson in the source prompt.
#
# For container-side results, use GET /dependencies on the running
# API (that check executes inside the api container's network
# namespace).
# ============================================================
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PG_HOST="ai-gateway-postgres-db"
PG_PORT="5432"
REDIS_HOST="ai-gateway-redis"
REDIS_PORT="6379"
API_HOST="localhost"
API_PORT="${PORT:-8080}"

check_dns() {
  local host="$1"
  if getent hosts "$host" >/dev/null 2>&1 || host "$host" >/dev/null 2>&1 || nslookup "$host" >/dev/null 2>&1; then
    echo "PASS"
  else
    echo "FAIL"
  fi
}

check_tcp() {
  local host="$1"
  local port="$2"
  if (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null; then
    exec 3>&- 3<&-
    echo "PASS"
  else
    echo "FAIL"
  fi
}

echo "Test Location: HOST"
echo ""

echo "Target: ${PG_HOST}:${PG_PORT} (PostgreSQL)"
echo "  DNS: $(check_dns "$PG_HOST")"
echo "  TCP: $(check_tcp "$PG_HOST" "$PG_PORT")"
echo "  Note: Docker Compose service DNS names are typically NOT resolvable"
echo "        from the host. A FAIL here does not indicate a broken stack;"
echo "        confirm via GET /dependencies which runs inside the container."
echo ""

echo "Target: ${REDIS_HOST}:${REDIS_PORT} (Redis)"
echo "  DNS: $(check_dns "$REDIS_HOST")"
echo "  TCP: $(check_tcp "$REDIS_HOST" "$REDIS_PORT")"
echo ""

echo "Target: ${API_HOST}:${API_PORT} (API, published port)"
echo "  DNS: $(check_dns "$API_HOST")"
echo "  TCP: $(check_tcp "$API_HOST" "$API_PORT")"
if [ "$(check_tcp "$API_HOST" "$API_PORT")" = "PASS" ]; then
  echo "  Application: $(curl -fsS "http://${API_HOST}:${API_PORT}/health" >/dev/null 2>&1 && echo PASS || echo FAIL)"
fi
