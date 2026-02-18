#!/usr/bin/env bash
set -euo pipefail

# Quick smoke-test for ai chat burst limiter.
# Usage:
#   JWT="<token>" SUPABASE_FUNCTIONS_URL="https://<project>.supabase.co/functions/v1" ./scripts/test-chat-rate-limit.sh
# Optional:
#   REQUESTS=25 MESSAGE="ping" SESSION_ID="<uuid>" ./scripts/test-chat-rate-limit.sh

JWT="${JWT:-}"
SUPABASE_FUNCTIONS_URL="${SUPABASE_FUNCTIONS_URL:-}"
REQUESTS="${REQUESTS:-25}"
MESSAGE="${MESSAGE:-rate-limit-check}"
SESSION_ID="${SESSION_ID:-}"

if [[ -z "$JWT" ]]; then
  echo "Missing JWT env var."
  exit 1
fi

if [[ -z "$SUPABASE_FUNCTIONS_URL" ]]; then
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
