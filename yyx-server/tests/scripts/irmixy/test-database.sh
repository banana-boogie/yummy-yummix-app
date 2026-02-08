#!/bin/bash

# Database Test Script
# Tests: seed data verification, schema integrity, RLS policies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

# Database connection (local Supabase)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-54322}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"

export PGPASSWORD="$DB_PASS"

run_test() {
  echo -e "\n${BLUE}▶ $1${NC}"
}

assert_pass() {
  echo -e "${GREEN}✓${NC} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

assert_fail() {
  echo -e "${RED}✗${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

sql_query() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" 2>/dev/null
}

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Database Test Suite${NC}"
echo -e "${YELLOW}========================================${NC}"

# ============================================================================
# Pre-flight: Check database connection
# ============================================================================
run_test "Pre-flight: Database Connection"

if sql_query "SELECT 1" >/dev/null 2>&1; then
  assert_pass "Database connection successful"
else
  echo -e "${RED}✗ Cannot connect to database at $DB_HOST:$DB_PORT${NC}"
  echo -e "${YELLOW}  Make sure Supabase is running: cd yyx-server && npm start${NC}"
  exit 1
fi

# ============================================================================
# Test 1: Seed Data - ingredient_aliases
# ============================================================================
run_test "Test 1: Seed Data - ingredient_aliases"

ALIAS_COUNT=$(sql_query "SELECT COUNT(*) FROM ingredient_aliases")
if [ "$ALIAS_COUNT" -ge 46 ]; then
  assert_pass "ingredient_aliases has $ALIAS_COUNT rows (expected >= 46)"
else
  assert_fail "ingredient_aliases has $ALIAS_COUNT rows (expected >= 46)"
fi

# ============================================================================
# Test 2: Seed Data - allergen_groups
# ============================================================================
run_test "Test 2: Seed Data - allergen_groups"

ALLERGEN_COUNT=$(sql_query "SELECT COUNT(*) FROM allergen_groups")
if [ "$ALLERGEN_COUNT" -ge 29 ]; then
  assert_pass "allergen_groups has $ALLERGEN_COUNT rows (expected >= 29)"
else
  assert_fail "allergen_groups has $ALLERGEN_COUNT rows (expected >= 29)"
fi

# ============================================================================
# Test 3: Seed Data - food_safety_rules
# ============================================================================
run_test "Test 3: Seed Data - food_safety_rules"

SAFETY_COUNT=$(sql_query "SELECT COUNT(*) FROM food_safety_rules")
if [ "$SAFETY_COUNT" -ge 12 ]; then
  assert_pass "food_safety_rules has $SAFETY_COUNT rows (expected >= 12)"
else
  assert_fail "food_safety_rules has $SAFETY_COUNT rows (expected >= 12)"
fi

# ============================================================================
# Test 4: Schema - user_chat_sessions table
# ============================================================================
run_test "Test 4: Schema - user_chat_sessions table exists"

TABLE_EXISTS=$(sql_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_chat_sessions')")
if [ "$TABLE_EXISTS" = "t" ]; then
  assert_pass "user_chat_sessions table exists"
else
  assert_fail "user_chat_sessions table does not exist"
fi

# ============================================================================
# Test 5: Schema - user_chat_messages table
# ============================================================================
run_test "Test 5: Schema - user_chat_messages table exists"

TABLE_EXISTS=$(sql_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_chat_messages')")
if [ "$TABLE_EXISTS" = "t" ]; then
  assert_pass "user_chat_messages table exists"
else
  assert_fail "user_chat_messages table does not exist"
fi

# ============================================================================
# Test 6: Schema - cooking_sessions table
# ============================================================================
run_test "Test 6: Schema - cooking_sessions table exists"

TABLE_EXISTS=$(sql_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cooking_sessions')")
if [ "$TABLE_EXISTS" = "t" ]; then
  assert_pass "cooking_sessions table exists"
else
  assert_fail "cooking_sessions table does not exist"
fi

# ============================================================================
# Test 7: RLS - user_chat_sessions has RLS enabled
# ============================================================================
run_test "Test 7: RLS - user_chat_sessions policies"

RLS_ENABLED=$(sql_query "SELECT relrowsecurity FROM pg_class WHERE relname = 'user_chat_sessions'")
if [ "$RLS_ENABLED" = "t" ]; then
  assert_pass "RLS enabled on user_chat_sessions"
else
  assert_fail "RLS not enabled on user_chat_sessions"
fi

# ============================================================================
# Test 8: RLS - user_chat_messages has RLS enabled
# ============================================================================
run_test "Test 8: RLS - user_chat_messages policies"

RLS_ENABLED=$(sql_query "SELECT relrowsecurity FROM pg_class WHERE relname = 'user_chat_messages'")
if [ "$RLS_ENABLED" = "t" ]; then
  assert_pass "RLS enabled on user_chat_messages"
else
  assert_fail "RLS not enabled on user_chat_messages"
fi

# ============================================================================
# Test 9: RLS - cooking_sessions has RLS enabled
# ============================================================================
run_test "Test 9: RLS - cooking_sessions policies"

RLS_ENABLED=$(sql_query "SELECT relrowsecurity FROM pg_class WHERE relname = 'cooking_sessions'")
if [ "$RLS_ENABLED" = "t" ]; then
  assert_pass "RLS enabled on cooking_sessions"
else
  assert_fail "RLS not enabled on cooking_sessions"
fi

# ============================================================================
# Test 10: Allergen groups have bilingual data
# ============================================================================
run_test "Test 10: Allergen groups have bilingual aliases"

# Check that we have both English and Spanish names
EN_COUNT=$(sql_query "SELECT COUNT(*) FROM allergen_groups WHERE name_en IS NOT NULL AND name_en != ''")
ES_COUNT=$(sql_query "SELECT COUNT(*) FROM allergen_groups WHERE name_es IS NOT NULL AND name_es != ''")

if [ "$EN_COUNT" -gt 0 ] && [ "$ES_COUNT" -gt 0 ]; then
  assert_pass "Allergen groups have bilingual data (EN: $EN_COUNT, ES: $ES_COUNT)"
else
  assert_fail "Allergen groups missing bilingual data (EN: $EN_COUNT, ES: $ES_COUNT)"
fi

# ============================================================================
# Test 11: Food safety rules have required fields
# ============================================================================
run_test "Test 11: Food safety rules structure"

VALID_RULES=$(sql_query "SELECT COUNT(*) FROM food_safety_rules WHERE category IS NOT NULL AND ingredient_canonical IS NOT NULL AND min_temp_f IS NOT NULL")
if [ "$VALID_RULES" -eq "$SAFETY_COUNT" ]; then
  assert_pass "All food safety rules have required fields"
else
  assert_fail "Some food safety rules missing required fields ($VALID_RULES/$SAFETY_COUNT valid)"
fi

# ============================================================================
# Test 12: Check for stale session marking function
# ============================================================================
run_test "Test 12: mark_stale_cooking_sessions function exists"

FUNC_EXISTS=$(sql_query "SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_stale_cooking_sessions')")
if [ "$FUNC_EXISTS" = "t" ]; then
  assert_pass "mark_stale_cooking_sessions function exists"
else
  assert_fail "mark_stale_cooking_sessions function does not exist"
fi

# ============================================================================
# Test 13: upsert_cooking_session_progress function exists
# ============================================================================
run_test "Test 13: upsert_cooking_session_progress function exists"

FUNC_EXISTS=$(sql_query "SELECT to_regprocedure('public.upsert_cooking_session_progress(uuid,text,text,integer,integer)') IS NOT NULL")
if [ "$FUNC_EXISTS" = "t" ]; then
  assert_pass "upsert_cooking_session_progress(uuid,text,text,integer,integer) exists"
else
  assert_fail "upsert_cooking_session_progress(uuid,text,text,integer,integer) does not exist"
fi

# ============================================================================
# Test 14: match_recipe_embeddings execute grants are restricted
# ============================================================================
run_test "Test 14: match_recipe_embeddings execute grants"

AUTH_EXEC=$(sql_query "SELECT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_schema = 'public' AND routine_name = 'match_recipe_embeddings' AND grantee = 'authenticated' AND privilege_type = 'EXECUTE')")
SERVICE_EXEC=$(sql_query "SELECT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_schema = 'public' AND routine_name = 'match_recipe_embeddings' AND grantee = 'service_role' AND privilege_type = 'EXECUTE')")

if [ "$AUTH_EXEC" = "f" ] && [ "$SERVICE_EXEC" = "t" ]; then
  assert_pass "match_recipe_embeddings execute grants restricted to service_role"
else
  assert_fail "Unexpected execute grants (authenticated=$AUTH_EXEC, service_role=$SERVICE_EXEC)"
fi

# ============================================================================
# Test 15: match_recipe_embeddings clamps threshold and match_count
# ============================================================================
run_test "Test 15: match_recipe_embeddings has bounded inputs"

FUNC_DEF=$(sql_query "SELECT pg_get_functiondef('public.match_recipe_embeddings(extensions.vector,float,int)'::regprocedure)")
if [[ "$FUNC_DEF" == *"least(greatest(match_threshold, 0.0), 1.0)"* ]] && [[ "$FUNC_DEF" == *"least(greatest(match_count, 1), 50)"* ]]; then
  assert_pass "match_recipe_embeddings clamps threshold [0,1] and count [1,50]"
else
  assert_fail "match_recipe_embeddings is missing one or more clamp safeguards"
fi

# ============================================================================
# Summary
# ============================================================================
echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo -e "${YELLOW}Total:  $((PASS_COUNT + FAIL_COUNT))${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "\n${GREEN}✓ All database tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some database tests failed${NC}"
  exit 1
fi
