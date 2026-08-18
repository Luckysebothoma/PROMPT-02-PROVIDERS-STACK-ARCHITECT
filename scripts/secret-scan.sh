#!/usr/bin/env bash
# ============================================================
# secret-scan.sh
#
# Scans tracked source files for likely committed credentials.
# Distinguishes:
#   1. secret variable REFERENCES (e.g. ${POSTGRES_PASSWORD:-})  -> OK
#   2. secret ASSIGNMENTS with empty/placeholder values          -> OK
#   3. actual credential-looking material                        -> FAIL
#
# Never prints the value of a matched secret.
# ============================================================
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAIL=0

echo "[secret-scan] Verifying .env is ignored..."
if git check-ignore -q .env 2>/dev/null; then
  echo "  .env : ignored (OK)"
elif [ ! -d .git ]; then
  if grep -qE '^\.env$' .gitignore 2>/dev/null; then
    echo "  .env : listed in .gitignore (OK, no git repo initialized yet)"
  else
    echo "  .env : NOT found in .gitignore" >&2
    FAIL=1
  fi
else
  echo "  .env : NOT ignored by git" >&2
  FAIL=1
fi

echo "[secret-scan] Scanning tracked/trackable source files for real credential material..."

# Only scan text under project, excluding node_modules, .git, and .env itself.
FILES=$(find . \
  -type f \
  \( -name "*.js" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.sql" -o -name "*.sh" -o -name "*.md" -o -name "Dockerfile" \) \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -not -name ".env")

# Patterns that indicate an ACTUAL credential value, not a reference.
# - Long high-entropy tokens assigned directly (not via ${VAR})
# - Well-known provider key prefixes
CRED_PATTERNS=(
  'gsk_[A-Za-z0-9]{20,}'        # Groq key prefix
  'sk-[A-Za-z0-9]{20,}'         # OpenAI-style key prefix
  'AIza[A-Za-z0-9_-]{20,}'      # Google API key prefix
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
)

for pattern in "${CRED_PATTERNS[@]}"; do
  matches=$(echo "$FILES" | xargs grep -lE "$pattern" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "  FAIL: possible credential material matching pattern '$pattern' found in:" >&2
    echo "$matches" | sed 's/^/    /' >&2
    FAIL=1
  fi
done

# Detect direct secret assignments with a non-empty literal value in
# tracked files (excluding .env.example placeholders and variable refs).
while IFS= read -r file; do
  [ -z "$file" ] && continue
  # Look for VAR=literal (not ${...}, not empty, not just quotes) where VAR
  # looks like a secret name.
  hits=$(grep -nE '(API_KEY|PASSWORD|SECRET|TOKEN)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9_\-]{8,}' "$file" 2>/dev/null \
    | grep -vE '\$\{' \
    | grep -vE '<.*>' \
    | grep -viE '(test-key|not-real|placeholder|example|dummy|fake|changeme|your[_-]?key|xxx+)' \
    || true)
  # Exclude test fixtures: these intentionally contain fake credential
  # look-alikes for unit tests, not real secrets.
  case "$file" in
    ./tests/*) hits="" ;;
  esac
  if [ -n "$hits" ]; then
    echo "  FAIL: possible literal secret assignment in $file:" >&2
    echo "$hits" | sed -E 's/(=|:).*/\1 <redacted>/' | sed 's/^/    /' >&2
    FAIL=1
  fi
done <<< "$FILES"

if [ "$FAIL" -eq 0 ]; then
  echo "[secret-scan] PASS - no credential material detected."
  exit 0
else
  echo "[secret-scan] FAIL - review findings above." >&2
  exit 1
fi
