#!/usr/bin/env bash
# ============================================================
# run-tests.sh
#
# Runs the Node.js built-in test runner over tests/*.test.js.
# Distinguishes PASS/FAIL. Tests that require a live cloud
# provider credential are SKIPPED (not claimed as passing) when
# no credential is available - see provider.test.js /
# chat.test.js for what is actually exercised (route/registry
# logic against fakes, not a live Groq call).
# ============================================================
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  echo "[run-tests] node_modules not found. Run 'npm install' first." >&2
  exit 1
fi

echo "[run-tests] NOTE: No live cloud provider call is exercised by these"
echo "[run-tests] tests. A real Groq call requires GROQ_ENABLED=true and a"
echo "[run-tests] valid GROQ_API_KEY against a running stack (manual/integration"
echo "[run-tests] check, not part of this automated suite) - SKIPPED here."
echo ""

node --test tests/*.test.js
