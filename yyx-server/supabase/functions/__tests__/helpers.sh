#!/bin/bash

# ============================================================================
# Integration Test Helpers
# ============================================================================
#
# Common utilities for integration tests.
# Source this file at the beginning of test scripts.
#
# FOR AI AGENTS:
# - Use test_case() for individual API test assertions
# - Use assert_status() for HTTP status code checks
# - Use assert_json_field() to verify JSON response fields
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Base URL for functions
FUNCTIONS_URL="${STAGING_SUPABASE_URL}/functions/v1"

# ============================================================================
# HTTP HELPERS
# ============================================================================

# Make an authenticated request to an edge function
# Usage: call_function "function-name" '{"json": "body"}' [extra_curl_args...]
call_function() {
  local function_name=$1
  local body=$2
  shift 2

  curl -sS \
    -X POST \
    "${FUNCTIONS_URL}/${function_name}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${STAGING_SUPABASE_ANON_KEY}" \
    -d "$body" \
    "$@"
}

# Make a request and capture both response and status code
# Usage: call_function_with_status "function-name" '{"json": "body"}'
# Returns: JSON with "body" and "status" fields
call_function_with_status() {
  local function_name=$1
  local body=$2

  local response
  response=$(curl -sS -w "\n%{http_code}" \
    -X POST \
    "${FUNCTIONS_URL}/${function_name}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${STAGING_SUPABASE_ANON_KEY}" \
    -d "$body")

  local http_code=$(echo "$response" | tail -n1)
  local body_response=$(echo "$response" | head -n-1)

  echo "{\"body\": $body_response, \"status\": $http_code}"
}

# ============================================================================
# ASSERTION HELPERS
# ============================================================================

# Test a single API endpoint
# Usage: test_case "description" "function-name" '{"body": "json"}' expected_status [expected_field]
test_case() {
  local description=$1
  local function_name=$2
  local body=$3
  local expected_status=$4
  local expected_field=${5:-}

  echo -e "  Testing: $description"

  local response
  response=$(curl -sS -w "\n%{http_code}" \
    -X POST \
    "${FUNCTIONS_URL}/${function_name}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${STAGING_SUPABASE_ANON_KEY}" \
    -d "$body" 2>&1)

  local http_code=$(echo "$response" | tail -n1)
  local body_response=$(echo "$response" | head -n-1)

  # Check status code
  if [ "$http_code" != "$expected_status" ]; then
    echo -e "    ${RED}✗ FAILED: Expected status $expected_status, got $http_code${NC}"
    echo -e "    Response: $body_response"
    return 1
  fi

  # Check for expected field if specified
  if [ -n "$expected_field" ]; then
    if echo "$body_response" | grep -q "\"$expected_field\""; then
      echo -e "    ${GREEN}✓ PASSED${NC}"
      return 0
    else
      echo -e "    ${RED}✗ FAILED: Expected field '$expected_field' not found${NC}"
      echo -e "    Response: $body_response"
      return 1
    fi
  fi

  echo -e "    ${GREEN}✓ PASSED${NC}"
  return 0
}

# Assert HTTP status code
# Usage: assert_status "$response" 200
assert_status() {
  local response=$1
  local expected=$2

  local actual=$(echo "$response" | jq -r '.status // empty' 2>/dev/null)

  if [ "$actual" != "$expected" ]; then
    echo -e "${RED}✗ Expected status $expected, got $actual${NC}"
    return 1
  fi
  return 0
}

# Assert JSON field exists and optionally check value
# Usage: assert_json_field "$response" "field.path" [expected_value]
assert_json_field() {
  local json=$1
  local field_path=$2
  local expected_value=${3:-}

  if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq not available, using grep fallback${NC}"
    if echo "$json" | grep -q "\"${field_path}\""; then
      return 0
    fi
    return 1
  fi

  local actual=$(echo "$json" | jq -r ".body.${field_path} // .${field_path} // empty" 2>/dev/null)

  if [ -z "$actual" ]; then
    echo -e "${RED}✗ Field '$field_path' not found${NC}"
    return 1
  fi

  if [ -n "$expected_value" ] && [ "$actual" != "$expected_value" ]; then
    echo -e "${RED}✗ Field '$field_path': expected '$expected_value', got '$actual'${NC}"
    return 1
  fi

  return 0
}

# Assert response contains text
# Usage: assert_contains "$response" "expected text"
assert_contains() {
  local response=$1
  local expected=$2

  if echo "$response" | grep -q "$expected"; then
    return 0
  fi

  echo -e "${RED}✗ Response does not contain: $expected${NC}"
  return 1
}

# Assert response does not contain text
# Usage: assert_not_contains "$response" "unexpected text"
assert_not_contains() {
  local response=$1
  local unexpected=$2

  if echo "$response" | grep -q "$unexpected"; then
    echo -e "${RED}✗ Response contains unexpected: $unexpected${NC}"
    return 1
  fi

  return 0
}

# ============================================================================
# UTILITY HELPERS
# ============================================================================

# Wait for a condition with timeout
# Usage: wait_for "description" check_command timeout_seconds
wait_for() {
  local description=$1
  local check_command=$2
  local timeout=${3:-30}

  echo -e "Waiting for: $description (timeout: ${timeout}s)"

  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if eval "$check_command" > /dev/null 2>&1; then
      echo -e "${GREEN}✓ $description ready${NC}"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo -e "${RED}✗ Timeout waiting for: $description${NC}"
  return 1
}

# Generate a random string
# Usage: random_string [length]
random_string() {
  local length=${1:-8}
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w "$length" | head -n 1
}

# Print section header
# Usage: print_section "Section Name"
print_section() {
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}  $1${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}
