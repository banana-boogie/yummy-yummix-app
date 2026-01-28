#!/bin/bash

# ============================================================================
# Integration Test Runner for Supabase Edge Functions
# ============================================================================
#
# Runs all integration tests against the staging Supabase environment.
#
# Prerequisites:
#   - STAGING_SUPABASE_URL environment variable
#   - STAGING_SUPABASE_ANON_KEY environment variable
#   - curl and jq installed
#
# Usage:
#   ./run-integration-tests.sh [--quick] [--verbose]
#
# Options:
#   --quick     Run only essential tests
#   --verbose   Show detailed output
#
# FOR AI AGENTS:
# - Add new integration tests as test-*.sh files in this directory
# - Each test file should exit with 0 on success, non-zero on failure
# - Use helpers.sh for common test utilities
# ============================================================================

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Options
QUICK_MODE=false
VERBOSE=false

for arg in "$@"; do
  case $arg in
    --quick)
      QUICK_MODE=true
      ;;
    --verbose)
      VERBOSE=true
      ;;
  esac
done

# ============================================================================
# ENVIRONMENT CHECK
# ============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Integration Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"

# Check required environment variables
if [ -z "$STAGING_SUPABASE_URL" ]; then
  echo -e "${RED}Error: STAGING_SUPABASE_URL not set${NC}"
  echo "Please set the STAGING_SUPABASE_URL environment variable."
  exit 1
fi

if [ -z "$STAGING_SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}Error: STAGING_SUPABASE_ANON_KEY not set${NC}"
  echo "Please set the STAGING_SUPABASE_ANON_KEY environment variable."
  exit 1
fi

# Check for required tools
if ! command -v curl &> /dev/null; then
  echo -e "${RED}Error: curl is required but not installed${NC}"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}Warning: jq is not installed. JSON parsing will be limited.${NC}"
fi

echo -e "Environment: ${YELLOW}Staging${NC}"
echo -e "URL: ${YELLOW}${STAGING_SUPABASE_URL}${NC}"
echo ""

# ============================================================================
# TEST EXECUTION
# ============================================================================

# Track results
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
declare -a FAILED_TESTS=()

# Source helpers
if [ -f "$SCRIPT_DIR/helpers.sh" ]; then
  source "$SCRIPT_DIR/helpers.sh"
fi

# Run a single test file
run_test() {
  local test_file=$1
  local test_name=$(basename "$test_file" .sh)

  # Skip if quick mode and test is slow
  if [ "$QUICK_MODE" = true ]; then
    if [[ "$test_name" == *"slow"* ]] || [[ "$test_name" == *"load"* ]]; then
      echo -e "${YELLOW}⊘ Skipped (quick mode): $test_name${NC}"
      SKIP_COUNT=$((SKIP_COUNT + 1))
      return 0
    fi
  fi

  echo -e "${BLUE}▶ Running: $test_name${NC}"

  # Make executable if not already
  chmod +x "$test_file"

  # Run the test
  if [ "$VERBOSE" = true ]; then
    if "$test_file"; then
      echo -e "${GREEN}✓ Passed: $test_name${NC}"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "${RED}✗ Failed: $test_name${NC}"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      FAILED_TESTS+=("$test_name")
    fi
  else
    if "$test_file" > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Passed: $test_name${NC}"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "${RED}✗ Failed: $test_name${NC}"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      FAILED_TESTS+=("$test_name")
    fi
  fi
}

# Find and run all test files
echo -e "${YELLOW}Discovering tests...${NC}"

test_files=$(find "$SCRIPT_DIR" -name "test-*.sh" -type f | sort)
test_count=$(echo "$test_files" | wc -l | tr -d ' ')

if [ -z "$test_files" ] || [ "$test_count" -eq 0 ]; then
  echo -e "${YELLOW}No integration tests found.${NC}"
  echo "Add test files matching 'test-*.sh' pattern to run integration tests."
  exit 0
fi

echo -e "Found ${YELLOW}$test_count${NC} test file(s)"
echo ""

# Run each test
for test_file in $test_files; do
  run_test "$test_file"
done

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Passed:  $PASS_COUNT${NC}"
echo -e "${RED}Failed:  $FAIL_COUNT${NC}"
echo -e "${YELLOW}Skipped: $SKIP_COUNT${NC}"
echo -e "Total:   $((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))"

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}Failed tests:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "  - $test"
  done
fi

echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✓ All integration tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ $FAIL_COUNT test(s) failed${NC}"
  exit 1
fi
