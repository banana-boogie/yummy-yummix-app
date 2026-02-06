#!/bin/bash

# ============================================================================
# Irmixy AI Phase 1 - Master Test Runner
# ============================================================================
#
# Runs all Phase 1 tests in the correct order and generates a summary report.
#
# Usage:
#   ./test-irmixy-phase1.sh [--skip-load] [--quick]
#
# Options:
#   --skip-load   Skip load testing (faster)
#   --quick       Run only essential tests (database + security + basic endpoints)
#
# Prerequisites:
#   - Supabase running locally (npm start in yyx-server)
#   - jq, psql installed
#
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Options
SKIP_LOAD=false
QUICK_MODE=false

for arg in "$@"; do
  case $arg in
    --skip-load)
      SKIP_LOAD=true
      ;;
    --quick)
      QUICK_MODE=true
      ;;
  esac
done

# Results tracking
SUITE_PASS=0
SUITE_FAIL=0
SUITE_SKIP=0
RESULTS=""
START_TIME=$(date +%s)

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}  ${BOLD}$1${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
}

print_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

run_test_suite() {
  local name="$1"
  local script="$2"
  shift 2
  local args=("$@")

  print_section "$name"

  if [ ! -f "$script" ]; then
    echo -e "${YELLOW}⊘ Skipped: $script not found${NC}"
    RESULTS="${RESULTS}SKIP|$name|Script not found\n"
    SUITE_SKIP=$((SUITE_SKIP + 1))
    return
  fi

  if [ ! -x "$script" ]; then
    chmod +x "$script"
  fi

  local suite_start=$(date +%s)

  if "$script" "${args[@]}"; then
    local suite_end=$(date +%s)
    local duration=$((suite_end - suite_start))
    echo -e "${GREEN}✓ $name completed (${duration}s)${NC}"
    RESULTS="${RESULTS}PASS|$name|${duration}s\n"
    SUITE_PASS=$((SUITE_PASS + 1))
  else
    local suite_end=$(date +%s)
    local duration=$((suite_end - suite_start))
    echo -e "${RED}✗ $name failed (${duration}s)${NC}"
    RESULTS="${RESULTS}FAIL|$name|${duration}s\n"
    SUITE_FAIL=$((SUITE_FAIL + 1))
  fi
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

print_header "Irmixy AI Phase 1 Test Suite"

echo ""
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check for required tools
for tool in curl jq psql; do
  if command -v $tool >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $tool installed"
  else
    echo -e "  ${RED}✗${NC} $tool not found"
    echo -e "  ${YELLOW}Please install $tool before running tests${NC}"
    exit 1
  fi
done

# Check Supabase is running
echo ""
echo -e "${BLUE}Checking Supabase...${NC}"

SUPABASE_CHECK=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:54321/rest/v1/ 2>/dev/null || echo "000")
if [ "$SUPABASE_CHECK" = "200" ] || [ "$SUPABASE_CHECK" = "401" ]; then
  echo -e "  ${GREEN}✓${NC} Supabase is running"
else
  echo -e "  ${RED}✗${NC} Supabase not responding (HTTP $SUPABASE_CHECK)"
  echo -e "  ${YELLOW}Please start Supabase: cd yyx-server && npm start${NC}"
  exit 1
fi

# Check if edge functions are served
echo ""
echo -e "${BLUE}Checking Edge Functions...${NC}"

if pgrep -f "supabase functions serve" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Edge functions server running"
else
  echo -e "  ${YELLOW}!${NC} Edge functions not served - starting..."
  cd "$PROJECT_DIR" || exit 1
  supabase functions serve --no-verify-jwt --env-file .env.local > /tmp/functions.log 2>&1 &
  sleep 5
  if pgrep -f "supabase functions serve" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Edge functions server started"
  else
    echo -e "  ${RED}✗${NC} Failed to start edge functions"
    echo -e "  ${YELLOW}Check /tmp/functions.log for errors${NC}"
  fi
fi

# Check AI availability
echo ""
echo -e "${BLUE}Checking AI configuration...${NC}"

OPENAI_KEY=$(grep "OPENAI_API_KEY" "$PROJECT_DIR/.env.local" 2>/dev/null | cut -d'=' -f2)
if [ -n "$OPENAI_KEY" ] && [ "$OPENAI_KEY" != "sk-proj-test" ] && [[ "$OPENAI_KEY" == sk-* ]]; then
  AI_AVAILABLE=true
  echo -e "  ${GREEN}✓${NC} OpenAI API key configured"
else
  AI_AVAILABLE=false
  echo -e "  ${YELLOW}!${NC} OpenAI API key not configured (AI tests will be limited)"
fi

# Get JWT token directly from Supabase
echo ""
echo -e "${BLUE}Getting test JWT token...${NC}"

ANON_KEY=$(supabase status -o json 2>/dev/null | jq -r '.ANON_KEY')
JWT=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@yummyyummix.local","password":"devpassword123"}' | jq -r '.access_token // empty')

if [ -n "$JWT" ]; then
  echo -e "  ${GREEN}✓${NC} JWT token obtained"
else
  echo -e "  ${RED}✗${NC} Failed to get JWT token"
  echo -e "  ${YELLOW}Make sure dev user exists: npm run dev:setup${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}Pre-flight checks passed!${NC}"

# ============================================================================
# Run Tests
# ============================================================================

print_header "Running Test Suites"

# Phase 1: Database (run first - verify schema before testing endpoints)
run_test_suite "Database Schema & Seed Data" "$SCRIPT_DIR/test-database.sh"

# Phase 2: Security (run second - most critical)
run_test_suite "Security Tests" "$SCRIPT_DIR/test-security.sh" "$JWT"

# Phase 3: Core Functionality
if [ "$QUICK_MODE" = false ]; then
  run_test_suite "AI Orchestrator" "$SCRIPT_DIR/test-orchestrator.sh" "$JWT"
  run_test_suite "AI Chat" "$SCRIPT_DIR/test-chat.sh" "$JWT"
else
  echo -e "\n${YELLOW}Quick mode: Skipping full endpoint tests${NC}"
fi

# Phase 4: Feature-specific
if [ "$QUICK_MODE" = false ]; then
  run_test_suite "Allergen Filtering" "$SCRIPT_DIR/test-allergen-filter.sh" "$JWT"
  run_test_suite "Context Builder" "$SCRIPT_DIR/test-context.sh" "$JWT"
fi

# Phase 5: Streaming & Performance
if [ "$QUICK_MODE" = false ]; then
  if [ "$SKIP_LOAD" = true ]; then
    run_test_suite "Streaming" "$SCRIPT_DIR/test-streaming.sh" "$JWT"
  else
    run_test_suite "Streaming & Load" "$SCRIPT_DIR/test-streaming.sh" "$JWT" "--load"
  fi
fi

# Phase 6: Unit Tests (Deno)
print_section "Tool Validator Unit Tests (Deno)"

VALIDATORS_TEST="$PROJECT_DIR/supabase/functions/_shared/tools/tool-validators.test.ts"
if [ -f "$VALIDATORS_TEST" ]; then
  if command -v deno >/dev/null 2>&1; then
    UNIT_START=$(date +%s)
    if (cd "$PROJECT_DIR/supabase/functions/_shared/tools" && deno test tool-validators.test.ts 2>&1); then
      UNIT_END=$(date +%s)
      UNIT_DURATION=$((UNIT_END - UNIT_START))
      echo -e "${GREEN}✓ Unit tests completed (${UNIT_DURATION}s)${NC}"
      RESULTS="${RESULTS}PASS|Tool Validator Unit Tests|${UNIT_DURATION}s\n"
      SUITE_PASS=$((SUITE_PASS + 1))
    else
      UNIT_END=$(date +%s)
      UNIT_DURATION=$((UNIT_END - UNIT_START))
      echo -e "${RED}✗ Unit tests failed (${UNIT_DURATION}s)${NC}"
      RESULTS="${RESULTS}FAIL|Tool Validator Unit Tests|${UNIT_DURATION}s\n"
      SUITE_FAIL=$((SUITE_FAIL + 1))
    fi
  else
    echo -e "${YELLOW}⊘ Skipped: Deno not installed${NC}"
    RESULTS="${RESULTS}SKIP|Tool Validator Unit Tests|Deno not installed\n"
    SUITE_SKIP=$((SUITE_SKIP + 1))
  fi
else
  echo -e "${YELLOW}⊘ Skipped: test file not found${NC}"
  RESULTS="${RESULTS}SKIP|Tool Validator Unit Tests|File not found\n"
  SUITE_SKIP=$((SUITE_SKIP + 1))
fi

# ============================================================================
# Summary Report
# ============================================================================

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

print_header "Test Summary"

echo ""
echo -e "${BOLD}Results:${NC}"
echo -e "  ${GREEN}Passed:${NC}  $SUITE_PASS"
echo -e "  ${RED}Failed:${NC}  $SUITE_FAIL"
echo -e "  ${YELLOW}Skipped:${NC} $SUITE_SKIP"
echo -e "  ${BLUE}Total:${NC}   $((SUITE_PASS + SUITE_FAIL + SUITE_SKIP))"
echo ""
echo -e "${BOLD}Duration:${NC} ${TOTAL_TIME}s"
echo ""

echo -e "${BOLD}Detailed Results:${NC}"
echo -e "$RESULTS" | while IFS='|' read -r status name duration; do
  if [ -n "$status" ]; then
    case $status in
      PASS) echo -e "  ${GREEN}✓${NC} $name ($duration)" ;;
      FAIL) echo -e "  ${RED}✗${NC} $name ($duration)" ;;
      SKIP) echo -e "  ${YELLOW}⊘${NC} $name ($duration)" ;;
    esac
  fi
done

# Generate results file
RESULTS_FILE="$PROJECT_DIR/tests/phase1-test-results.md"
mkdir -p "$(dirname "$RESULTS_FILE")"

# Generate detailed results table first (avoid heredoc issues with case statements)
DETAILED_TABLE=""
echo -e "$RESULTS" | while IFS='|' read -r status name duration; do
  if [ -n "$status" ]; then
    case $status in
      PASS) echo "| $name | ✅ Pass | $duration |" ;;
      FAIL) echo "| $name | ❌ Fail | $duration |" ;;
      SKIP) echo "| $name | ⏭️ Skip | $duration |" ;;
    esac
  fi
done > /tmp/test_results_table.txt
DETAILED_TABLE=$(cat /tmp/test_results_table.txt 2>/dev/null || echo "")

# Generate next steps
if [ $SUITE_FAIL -gt 0 ]; then
  NEXT_STEPS="### Failed Tests
Review the failed test suites above and check:
1. Are all required services running?
2. Are there any recent schema changes?
3. Check Supabase dashboard logs (Edge Functions -> Logs)"
else
  NEXT_STEPS="### All Tests Passed! ✅
The Phase 1 implementation is validated. Consider:
1. Running load tests if skipped: \`./test-irmixy-phase1.sh\`
2. Manual testing of edge cases
3. Proceeding to Phase 2 planning"
fi

# Get versions
NODE_VERSION=$(node --version 2>/dev/null || echo "N/A")
DENO_VERSION=$(deno --version 2>/dev/null | head -1 || echo "N/A")
TEST_MODE=$([ "$QUICK_MODE" = true ] && echo "Quick" || echo "Full")

cat > "$RESULTS_FILE" << EOF
# Phase 1 Irmixy AI - Test Results

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Duration:** ${TOTAL_TIME}s
**Mode:** $TEST_MODE

## Summary

| Status | Count |
|--------|-------|
| Passed | $SUITE_PASS |
| Failed | $SUITE_FAIL |
| Skipped | $SUITE_SKIP |
| **Total** | **$((SUITE_PASS + SUITE_FAIL + SUITE_SKIP))** |

## Detailed Results

| Suite | Status | Duration |
|-------|--------|----------|
$DETAILED_TABLE

## Test Environment

- **Supabase:** Local (localhost:54321)
- **Database:** PostgreSQL (localhost:54322)
- **Node.js:** $NODE_VERSION
- **Deno:** $DENO_VERSION

## Next Steps

$NEXT_STEPS
EOF

echo ""
echo -e "${BLUE}Results saved to: $RESULTS_FILE${NC}"

# Exit with appropriate code
if [ $SUITE_FAIL -gt 0 ]; then
  echo ""
  echo -e "${RED}╔════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  SOME TESTS FAILED - REVIEW REQUIRED  ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════╝${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║      ALL TESTS PASSED! 🎉             ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  exit 0
fi
