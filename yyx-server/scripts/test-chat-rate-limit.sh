#!/usr/bin/env bash
set -euo pipefail

# Quick smoke-test for ai chat burst limiter.
# Usage:
#   ./scripts/test-chat-rate-limit.sh          # auto-sources JWT from get-test-jwt.sh
#   JWT="<token>" ./scripts/test-chat-rate-limit.sh  # or provide manually
# Optional:
#   REQUESTS=25 MESSAGE="ping" SESSION_ID="<uuid>" ./scripts/test-chat-rate-limit.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-source JWT if not provided
if [[ -z "${JWT:-}" ]]; then
  if [[ -f "$SCRIPT_DIR/get-test-jwt.sh" ]]; then
    echo "Auto-sourcing JWT from get-test-jwt.sh..."
    eval "$("$SCRIPT_DIR/get-test-jwt.sh")"
    JWT="${YYX_JWT:-}"
  fi
fi

# Auto-load SUPABASE_URL for functions URL if not set
if [[ -z "${SUPABASE_FUNCTIONS_URL:-}" ]]; then
  ENV_FILE="$SCRIPT_DIR/../.env.local"
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
    SUPABASE_FUNCTIONS_URL="${SUPABASE_URL:-}/functions/v1"
  fi
fi

REQUESTS="${REQUESTS:-25}"
MESSAGE="${MESSAGE:-rate-limit-check}"
SESSION_ID="${SESSION_ID:-}"

if [[ -z "${JWT:-}" ]]; then
  echo "Missing JWT env var. Set JWT or configure get-test-jwt.sh."
  exit 1
fi

if [[ -z "${SUPABASE_FUNCTIONS_URL:-}" ]]; then
  echo "Missing SUPABASE_FUNCTIONS_URL env var."
  exit 1
fi

ENDPOINT="${SUPABASE_FUNCTIONS_URL%/}/irmixy-chat-orchestrator"

echo "Testing ${REQUESTS} rapid requests against ${ENDPOINT}"
echo

for i in $(seq 1 "$REQUESTS"); do
  headers_file="$(mktemp)"
  body_file="$(mktemp)"

  if [[ -n "$SESSION_ID" ]]; then
    payload="{\"message\":\"${MESSAGE} #${i}\",\"sessionId\":\"${SESSION_ID}\"}"
  else
    payload="{\"message\":\"${MESSAGE} #${i}\"}"
  fi

  status_code="$(
    curl -sS \
      -X POST "$ENDPOINT" \
      -H "Authorization: Bearer ${JWT}" \
      -H "Content-Type: application/json" \
      -D "$headers_file" \
      -o "$body_file" \
      --data "$payload" \
      -w "%{http_code}"
  )"

  retry_after="$(grep -i '^Retry-After:' "$headers_file" | awk '{print $2}' | tr -d '\r' || true)"
  retry_after_ms="$(grep -o '"retryAfterMs":[0-9]*' "$body_file" | cut -d: -f2 || true)"

  echo "[$i/$REQUESTS] status=${status_code} retry_after=${retry_after:-"-"} retry_after_ms=${retry_after_ms:-"-"}"

  rm -f "$headers_file" "$body_file"
done
