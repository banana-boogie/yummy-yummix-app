#!/bin/bash

# ============================================================================
# Integration Test: meal-planner generate_plan
# ============================================================================
#
# Smoke-tests the generate_plan endpoint against real staging Supabase. Covers:
#   1. Happy path — returns a plan with slots + components
#   2. 409 PLAN_ALREADY_EXISTS — replaceExisting=false against an existing plan
#   3. 400 INVALID_INPUT — malformed weekStart ("2026-02-30")
#
# Requirements (all required, script skips cleanly when any are missing):
#   - STAGING_SUPABASE_URL          — e.g. https://xxx.supabase.co
#   - STAGING_SUPABASE_ANON_KEY     — public anon key (for /auth/v1/token)
#   - STAGING_TEST_EMAIL            — dev-user login email in staging
#   - STAGING_TEST_PASSWORD         — dev-user password
#
# Staging also needs ≥5 published recipes with `planner_role IN ('main','side')`
# and non-empty `meal_components`. Without that the happy path returns 422
# INSUFFICIENT_RECIPES and the script fails.
#
# Run standalone:
#   ./test-meal-planner-generate-plan.sh
#
# Run via harness (picked up by `run-integration-tests.sh`):
#   ./run-integration-tests.sh
# ============================================================================

set -eo pipefail
# Note: NOT set -u. `helpers.sh:23` references STAGING_SUPABASE_URL
# unguarded, which would crash nounset mode when env isn't configured.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=helpers.sh
source "${SCRIPT_DIR}/helpers.sh"

print_section "meal-planner: generate_plan"

# --------- Skip cleanly if not configured ---------
if [ -z "${STAGING_SUPABASE_URL:-}" ] \
   || [ -z "${STAGING_SUPABASE_ANON_KEY:-}" ] \
   || [ -z "${STAGING_TEST_EMAIL:-}" ] \
   || [ -z "${STAGING_TEST_PASSWORD:-}" ]; then
  echo -e "${YELLOW}[skip] meal-planner integration test${NC}"
  echo "  Set STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY,"
  echo "      STAGING_TEST_EMAIL, STAGING_TEST_PASSWORD to enable."
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo -e "${RED}✗ jq is required but not installed${NC}"
  exit 1
fi

# --------- Sign in — get a user JWT ---------
echo "  Signing in as $STAGING_TEST_EMAIL..."
TOKEN_RESPONSE=$(curl -sS -X POST \
  "${STAGING_SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${STAGING_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg email "$STAGING_TEST_EMAIL" \
    --arg password "$STAGING_TEST_PASSWORD" \
    '{email: $email, password: $password}')")

USER_JWT=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
if [ -z "$USER_JWT" ]; then
  echo -e "${RED}✗ Failed to sign in${NC}"
  echo "  Response: $TOKEN_RESPONSE"
  exit 1
fi
echo -e "  ${GREEN}✓ Authenticated${NC}"

FUNCTION_URL="${STAGING_SUPABASE_URL}/functions/v1/meal-planner"

# A week 7 days in the future, deterministic per run. macOS/BSD vs GNU date.
if date -u -v+7d +%Y-%m-%d >/dev/null 2>&1; then
  WEEK_START=$(date -u -v+7d +%Y-%m-%d)
else
  WEEK_START=$(date -u -d "+7 days" +%Y-%m-%d)
fi
echo "  Test week: $WEEK_START"

# Shared helper — post to meal-planner with the user JWT, return body + status.
# Usage: post_planner '{"action":"..."}' → sets LAST_STATUS and LAST_BODY
LAST_STATUS=""
LAST_BODY=""
post_planner() {
  local body=$1
  local response
  response=$(curl -sS -w "\n%{http_code}" -X POST \
    "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${USER_JWT}" \
    -d "$body")
  LAST_STATUS=$(echo "$response" | tail -n1)
  LAST_BODY=$(echo "$response" | head -n -1)
}

FAILED=0

# ============================================================================
# 1. Happy path — returns a full 5-slot plan with usable slot content
# ============================================================================
echo -e "\n  ${YELLOW}[1/3]${NC} Happy path: generate_plan with dinner for 5 days"
post_planner "$(jq -n --arg ws "$WEEK_START" '{
  action: "generate_plan",
  payload: {
    weekStart: $ws,
    dayIndexes: [0, 1, 2, 3, 4],
    mealTypes: ["dinner"]
  }
}')"

if [ "$LAST_STATUS" != "200" ]; then
  echo -e "    ${RED}✗ Expected 200, got $LAST_STATUS${NC}"
  echo "    Body: $LAST_BODY"
  FAILED=1
else
  if ! echo "$LAST_BODY" | jq -e '
    (.plan.planId | type == "string" and length > 0) and
    (.plan.slots | length == 5) and
    (.isPartial == false) and
    (all(.plan.slots[];
      (.selectionReason | type == "string" and length > 0) and
      (.components | type == "array" and length > 0) and
      (.components[0].isPrimary == true) and
      (.components[0].recipeId != null)
    ))
  ' >/dev/null; then
    echo -e "    ${RED}✗ Happy-path contract validation failed${NC}"
    echo "    Body: $LAST_BODY"
    FAILED=1
  else
    SLOTS_LEN=$(echo "$LAST_BODY" | jq '.plan.slots | length')
    PLAN_ID=$(echo "$LAST_BODY" | jq -r '.plan.planId')
    echo -e "    ${GREEN}✓ plan.slots = $SLOTS_LEN, planId = $PLAN_ID, isPartial=false${NC}"
  fi
fi

# ============================================================================
# 2. 409 PLAN_ALREADY_EXISTS — same week, replaceExisting=false
# ============================================================================
echo -e "\n  ${YELLOW}[2/3]${NC} 409 PLAN_ALREADY_EXISTS: same week, replaceExisting=false"
post_planner "$(jq -n --arg ws "$WEEK_START" '{
  action: "generate_plan",
  payload: {
    weekStart: $ws,
    dayIndexes: [0],
    mealTypes: ["dinner"],
    replaceExisting: false
  }
}')"

if [ "$LAST_STATUS" != "409" ]; then
  echo -e "    ${RED}✗ Expected 409, got $LAST_STATUS${NC}"
  echo "    Body: $LAST_BODY"
  FAILED=1
else
  ERROR_CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
  if [ "$ERROR_CODE" != "PLAN_ALREADY_EXISTS" ]; then
    echo -e "    ${RED}✗ Expected error.code = PLAN_ALREADY_EXISTS, got '$ERROR_CODE'${NC}"
    FAILED=1
  else
    echo -e "    ${GREEN}✓ 409 PLAN_ALREADY_EXISTS${NC}"
  fi
fi

# ============================================================================
# 3. 400 INVALID_INPUT — malformed weekStart
# ============================================================================
echo -e "\n  ${YELLOW}[3/3]${NC} 400 INVALID_INPUT: malformed weekStart"
post_planner '{
  "action": "generate_plan",
  "payload": {
    "weekStart": "2026-02-30",
    "dayIndexes": [0, 1, 2, 3, 4],
    "mealTypes": ["dinner"]
  }
}'

if [ "$LAST_STATUS" != "400" ]; then
  echo -e "    ${RED}✗ Expected 400, got $LAST_STATUS${NC}"
  echo "    Body: $LAST_BODY"
  FAILED=1
else
  ERROR_CODE=$(echo "$LAST_BODY" | jq -r '.error.code // empty')
  if [ "$ERROR_CODE" != "INVALID_INPUT" ]; then
    echo -e "    ${RED}✗ Expected error.code = INVALID_INPUT, got '$ERROR_CODE'${NC}"
    FAILED=1
  else
    echo -e "    ${GREEN}✓ 400 INVALID_INPUT${NC}"
  fi
fi

# ============================================================================
echo ""
if [ "$FAILED" -ne 0 ]; then
  echo -e "${RED}✗ meal-planner integration FAILED${NC}"
  exit 1
fi
echo -e "${GREEN}✓ meal-planner integration PASSED${NC}"
