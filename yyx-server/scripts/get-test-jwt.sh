#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-load .env.local if variables aren't set
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  ENV_FILE="$SCRIPT_DIR/../.env.local"
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
  else
    echo "Missing SUPABASE_URL or SUPABASE_ANON_KEY and no .env.local found." >&2
    echo "Either set the variables or create yyx-server/.env.local" >&2
    exit 1
  fi
fi

if [[ -z "${YYX_TEST_EMAIL:-}" || -z "${YYX_TEST_PASSWORD:-}" ]]; then
  echo "Missing YYX_TEST_EMAIL or YYX_TEST_PASSWORD. Add them to yyx-server/.env.local." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this script. Install via: brew install jq" >&2
  exit 1
fi

resp=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$YYX_TEST_EMAIL\",\"password\":\"$YYX_TEST_PASSWORD\"}")

jwt=$(echo "$resp" | jq -r '.access_token // empty')

if [[ -z "$jwt" || "$jwt" == "null" ]]; then
  echo "Failed to get JWT. Response:" >&2
  echo "$resp" >&2
  exit 1
fi

export YYX_JWT="$jwt"

echo "YYX_JWT=$YYX_JWT"
