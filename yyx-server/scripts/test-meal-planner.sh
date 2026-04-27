#!/usr/bin/env bash
# Smoke test for the meal-planner edge function.
#
# Walks through the full read/mutate/approve loop against the deployed
# function so we don't have to hand-construct curls. Each step prints the
# action, HTTP status, and a one-line summary of the response. Set
# `VERBOSE=1` to dump every full response body.
#
# Usage:
#   bash scripts/test-meal-planner.sh                 # run the full loop
#   bash scripts/test-meal-planner.sh prefs           # only the preference roundtrip
#   bash scripts/test-meal-planner.sh generate        # only generate_plan
#   bash scripts/test-meal-planner.sh loop            # full loop (default)
#   VERBOSE=1 bash scripts/test-meal-planner.sh
#
# Environment:
#   Reads SUPABASE_URL, SUPABASE_ANON_KEY, YYX_TEST_EMAIL, YYX_TEST_PASSWORD
#   from yyx-server/.env.local (same as get-test-jwt.sh).
#
# Notes:
#   - generate_plan uses the next Monday as weekStart so we don't collide
#     with manually-created plans.
#   - replaceExisting=true ensures repeat runs reset the week.
#   - The script DELETES no data; only calls the edge function.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Auto-load .env.local
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  ENV_FILE="$SERVER_DIR/.env.local"
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
  else
    echo "Missing SUPABASE_URL or SUPABASE_ANON_KEY and no .env.local found." >&2
    echo "Either set the variables or create yyx-server/.env.local" >&2
    exit 1
  fi
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install via: brew install jq" >&2
  exit 1
fi

# Get a fresh JWT each run — they expire and stale tokens silently 401.
JWT_OUTPUT=$(bash "$SCRIPT_DIR/get-test-jwt.sh")
JWT="${JWT_OUTPUT#YYX_JWT=}"
if [[ -z "$JWT" ]]; then
  echo "Failed to obtain JWT" >&2
  exit 1
fi

ENDPOINT="$SUPABASE_URL/functions/v1/meal-planner"

# Next Monday (ISO date) so repeated runs target a stable week.
NEXT_MONDAY=$(python3 -c '
import datetime
today = datetime.date.today()
days_ahead = (7 - today.weekday()) % 7
if days_ahead == 0:
    days_ahead = 7
print((today + datetime.timedelta(days=days_ahead)).isoformat())
')

# ---- Helpers ----------------------------------------------------------------

# call <action> <payload-json>
# Echoes the response body to stdout, prints a status line to stderr.
call() {
  local action="$1"
  local payload="$2"
  local body
  local status

  body=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"$action\",\"payload\":$payload}")

  status=$(echo "$body" | tail -n 1)
  body=$(echo "$body" | sed '$d')

  local color_ok="\033[32m"
  local color_err="\033[31m"
  local color_reset="\033[0m"
  local color
  if [[ "$status" =~ ^2 ]]; then color="$color_ok"; else color="$color_err"; fi

  printf "${color}[%s] %s -> %s${color_reset}\n" "$status" "$action" \
    "$(echo "$body" | jq -c '. | if .error then .error else (
        if .plan then {planId: .plan.planId, slots: (.plan.slots | length), warnings} else
          if .alternatives then {alternatives: (.alternatives | length), warnings} else
            if .preferences then {preferences, warnings} else
              if .slot then {slot: {id: .slot.id, status: .slot.status, swapCount: .slot.swapCount}, warnings} else
                {keys: (. | keys), warnings} end end end end
      ) end' 2>/dev/null || echo "$body")" >&2

  if [[ "${VERBOSE:-0}" == "1" ]]; then
    echo "$body" | jq . >&2
  fi

  echo "$body"
}

# extract <jq-path> — read the previously-printed body
extract() {
  jq -r "$1"
}

# ---- Test flows -------------------------------------------------------------

run_prefs() {
  echo "== Preferences roundtrip =="
  call get_preferences '{}' >/dev/null

  call update_preferences '{
    "mealTypes": ["dinner"],
    "dayIndexes": [0,1,2,3,4],
    "busyDays": [2],
    "defaultMaxWeeknightMinutes": 35,
    "autoLeftovers": true
  }' >/dev/null

  call get_preferences '{}' >/dev/null
}

run_generate() {
  echo "== Generate plan for week starting $NEXT_MONDAY =="
  call generate_plan "{
    \"weekStart\": \"$NEXT_MONDAY\",
    \"dayIndexes\": [0,1,2,3,4],
    \"mealTypes\": [\"dinner\"],
    \"replaceExisting\": true
  }" >/dev/null
}

run_loop() {
  echo "== Full loop (week starting $NEXT_MONDAY) =="

  echo "-- Step 1: ensure preferences exist --"
  call update_preferences '{
    "mealTypes": ["dinner"],
    "dayIndexes": [0,1,2,3,4]
  }' >/dev/null

  echo "-- Step 2: generate --"
  local gen_body
  gen_body=$(call generate_plan "{
    \"weekStart\": \"$NEXT_MONDAY\",
    \"dayIndexes\": [0,1,2,3,4],
    \"mealTypes\": [\"dinner\"],
    \"replaceExisting\": true
  }")

  local plan_id slot_id second_slot_id
  plan_id=$(echo "$gen_body" | extract '.plan.planId // empty')
  slot_id=$(echo "$gen_body" | extract '.plan.slots[0].id // empty')
  second_slot_id=$(echo "$gen_body" | extract '.plan.slots[1].id // empty')

  if [[ -z "$plan_id" || -z "$slot_id" ]]; then
    echo "generate_plan did not return a usable plan; aborting loop." >&2
    return 1
  fi

  echo "-- Step 3: get_current_plan --"
  call get_current_plan '{}' >/dev/null

  echo "-- Step 4: swap_meal browse --"
  local swap_body alt_recipe_id
  swap_body=$(call swap_meal "{
    \"mealPlanId\": \"$plan_id\",
    \"mealPlanSlotId\": \"$slot_id\"
  }")
  alt_recipe_id=$(echo "$swap_body" \
    | extract '.alternatives[0].slot.components[]? | select(.isPrimary) | .recipeId // empty')

  if [[ -z "$alt_recipe_id" ]]; then
    echo "swap_meal browse returned no alternative; skipping swap apply" >&2
  else
    echo "-- Step 5: swap_meal apply (selectedRecipeId=$alt_recipe_id) --"
    call swap_meal "{
      \"mealPlanId\": \"$plan_id\",
      \"mealPlanSlotId\": \"$slot_id\",
      \"selectedRecipeId\": \"$alt_recipe_id\"
    }" >/dev/null
  fi

  echo "-- Step 6: approve_plan --"
  call approve_plan "{\"mealPlanId\": \"$plan_id\"}" >/dev/null

  echo "-- Step 7: mark_meal_cooked (slot 0) --"
  call mark_meal_cooked "{
    \"mealPlanId\": \"$plan_id\",
    \"mealPlanSlotId\": \"$slot_id\"
  }" >/dev/null

  if [[ -n "$second_slot_id" ]]; then
    echo "-- Step 8: skip_meal (slot 1) --"
    call skip_meal "{
      \"mealPlanId\": \"$plan_id\",
      \"mealPlanSlotId\": \"$second_slot_id\"
    }" >/dev/null
  fi

  echo "-- Step 9: get_current_plan (final state) --"
  call get_current_plan '{}' >/dev/null

  echo "-- Step 10: shopping list (gated stub) --"
  call generate_shopping_list "{\"mealPlanId\": \"$plan_id\"}" >/dev/null
}

case "${1:-loop}" in
  prefs|preferences) run_prefs ;;
  generate) run_generate ;;
  loop|"") run_loop ;;
  *)
    echo "Unknown command: $1" >&2
    echo "Usage: $0 [prefs|generate|loop]" >&2
    exit 1
    ;;
esac

echo
echo "Done."
