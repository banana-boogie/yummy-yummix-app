#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-load .env.local if variables aren't set
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  ENV_FILE="$SCRIPT_DIR/../.env.local"
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
  else
    echo "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY and no .env.local found." >&2
    echo "Either set the variables or create yyx-server/.env.local" >&2
    exit 1
  fi
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to yyx-server/.env.local" >&2
  echo "Get it from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api" >&2
  exit 1
fi

# Parse flags
DRY_RUN="${DRY_RUN:-false}"
FORCE="${FORCE:-false}"
EXECUTE="${EXECUTE:-false}"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="true" ;;
    --force)   FORCE="true" ;;
    --execute) EXECUTE="true" ;;
    --help|-h)
      echo "Usage: backfill-embeddings.sh [--dry-run] [--execute] [--force]"
      echo ""
      echo "  --dry-run   Preview what would be processed without saving"
      echo "  --execute   Apply changes (required for non-dry-run execution)"
      echo "  --force     Regenerate all embeddings (ignore content hash)"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg (use --help for usage)" >&2
      exit 1
      ;;
  esac
done

if [[ "$FORCE" == "true" && "$DRY_RUN" == "true" ]]; then
  echo "Cannot combine --force with --dry-run." >&2
  exit 1
fi

if [[ "$FORCE" == "true" && "$EXECUTE" != "true" ]]; then
  echo "--force requires --execute for safety." >&2
  exit 1
fi

if [[ "$DRY_RUN" != "true" && "$EXECUTE" != "true" ]]; then
  echo "Safety mode: defaulting to dry-run. Pass --execute to apply changes."
  DRY_RUN="true"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "🔍 Dry run — previewing what would be processed..."
elif [[ "$FORCE" == "true" ]]; then
  echo "🔄 Force regenerating all embeddings..."
else
  echo "📦 Backfilling embeddings (skipping unchanged recipes)..."
fi

resp=$(curl -s -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/backfill-embeddings" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"dryRun\": $DRY_RUN, \"forceRegenerate\": $FORCE}")

# Split response body and status code
http_code=$(echo "$resp" | tail -1)
body=$(echo "$resp" | sed '$d')

if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
  if command -v jq >/dev/null 2>&1; then
    echo "$body" | jq .
  else
    echo "$body"
  fi
  echo ""
  echo "Done! (HTTP $http_code)"
else
  echo "Request failed (HTTP $http_code):" >&2
  echo "$body" >&2
  exit 1
fi
