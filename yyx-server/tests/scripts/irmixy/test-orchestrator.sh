#!/bin/bash

# AI Orchestrator Test Script
# Tests: basic non-streaming, streaming SSE, tool execution, session creation, voice mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage
usage() {
  echo "Usage: $0 <jwt-token>"
  echo ""
  echo "Example:"
  echo "  JWT=\$(./scripts/get-test-jwt.sh | grep 'YYX_JWT=' | cut -d'=' -f2)"
  echo "  ./scripts/tests/test-orchestrator.sh \"\$JWT\""
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

JWT="$1"
ENDPOINT="http://localhost:54321/functions/v1/ai-orchestrator"
PASS_COUNT=0
FAIL_COUNT=0

# Helper: Run test
run_test() {
  local test_name="$1"
  echo -e "\n${BLUE}▶ $test_name${NC}"
}

# Helper: Assert pass
assert_pass() {
  local message="$1"
  echo -e "${GREEN}✓${NC} $message"
  PASS_COUNT=$((PASS_COUNT + 1))
}

# Helper: Assert fail
assert_fail() {
  local message="$1"
  echo -e "${RED}✗${NC} $message"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}AI Orchestrator Test Suite${NC}"
echo -e "${YELLOW}========================================${NC}"

# ============================================================================
# Test 1: Basic Non-Streaming Request
# ============================================================================
run_test "Test 1: Basic Non-Streaming Request"

RESPONSE=$(curl -sS -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "What can you help me with?", "mode": "text", "stream": false}')

# Check version
VERSION=$(echo "$RESPONSE" | jq -r '.version // ""')
if [ "$VERSION" = "1.0" ]; then
  assert_pass "Response has version 1.0"
else
  assert_fail "Expected version 1.0, got: $VERSION"
fi

# Check message is non-empty
MESSAGE=$(echo "$RESPONSE" | jq -r '.message // ""')
if [ -n "$MESSAGE" ]; then
  assert_pass "Message is non-empty (${#MESSAGE} chars)"
else
  assert_fail "Message is empty"
fi

# Check language
LANGUAGE=$(echo "$RESPONSE" | jq -r '.language // ""')
if [ "$LANGUAGE" = "en" ] || [ "$LANGUAGE" = "es" ]; then
  assert_pass "Language is valid: $LANGUAGE"
else
  assert_fail "Invalid language: $LANGUAGE"
fi

# ============================================================================
# Test 2: Streaming Request
# ============================================================================
run_test "Test 2: Streaming Request"

STREAM_OUTPUT=$(mktemp)
curl -sS -N -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about pasta", "mode": "text", "stream": true}' \
  > "$STREAM_OUTPUT" 2>&1

# Check for status event
if grep -q '"type":"status"' "$STREAM_OUTPUT"; then
  assert_pass "Status event received"
else
  assert_fail "No status event found"
fi

# Check for content events
CONTENT_COUNT=$(grep -c '"type":"content"' "$STREAM_OUTPUT" 2>/dev/null || echo "0")
CONTENT_COUNT=$(echo "$CONTENT_COUNT" | tr -d '\n' | head -c 10)
if [ "$CONTENT_COUNT" -gt 0 ] 2>/dev/null; then
  assert_pass "Received $CONTENT_COUNT content events"
else
  assert_fail "No content events received"
fi

# Check for done event
if grep -q '"type":"done"' "$STREAM_OUTPUT"; then
  assert_pass "Done event received"
else
  assert_fail "No done event found"
fi

# Verify all events are valid JSON
INVALID_JSON_COUNT=0
while IFS= read -r line; do
  if [[ $line == data:* ]]; then
    JSON="${line#data: }"
    if ! echo "$JSON" | jq empty 2>/dev/null; then
      ((INVALID_JSON_COUNT++))
    fi
  fi
done < "$STREAM_OUTPUT"

if [ "$INVALID_JSON_COUNT" -eq 0 ]; then
  assert_pass "All events are valid JSON"
else
  assert_fail "Found $INVALID_JSON_COUNT malformed JSON events"
fi

rm "$STREAM_OUTPUT"

# ============================================================================
# Test 3: Recipe Search Tool Execution
# ============================================================================
run_test "Test 3: Recipe Search Tool Execution"

RESPONSE=$(curl -sS -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me easy Italian recipes under 30 minutes", "mode": "text", "stream": false}')

MESSAGE=$(echo "$RESPONSE" | jq -r '.message // ""')

# Check if response mentions recipes (AI should have triggered search)
if echo "$MESSAGE" | grep -qi "recipe"; then
  assert_pass "Response mentions recipes"
else
  assert_fail "Response doesn't mention recipes"
fi

# Note: Cannot directly verify tool execution without inspecting logs,
# but if AI mentions recipes, it likely used the tool

# ============================================================================
# Test 4: Session Auto-Creation
# ============================================================================
run_test "Test 4: Session Auto-Creation"

# First request without sessionId
RESPONSE=$(curl -sS -i -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "My favorite food is pizza", "mode": "text", "stream": false}')

# Check for X-Session-Id header
SESSION_ID=$(echo "$RESPONSE" | grep -i "x-session-id:" | cut -d' ' -f2 | tr -d '\r\n')
if [ -n "$SESSION_ID" ]; then
  assert_pass "Session ID created: ${SESSION_ID:0:20}..."
else
  assert_fail "No X-Session-Id header found"
fi

# Second request with sessionId to test context memory
if [ -n "$SESSION_ID" ]; then
  RESPONSE2=$(curl -sS -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"What is my favorite food?\", \"mode\": \"text\", \"stream\": false, \"sessionId\": \"$SESSION_ID\"}")

  MESSAGE2=$(echo "$RESPONSE2" | jq -r '.message // ""')
  if echo "$MESSAGE2" | grep -qi "pizza"; then
    assert_pass "AI remembers context from previous message"
  else
    assert_fail "AI doesn't remember context (expected mention of pizza)"
  fi
fi

# ============================================================================
# Test 5: Voice Mode (Short Responses)
# ============================================================================
run_test "Test 5: Voice Mode (Short Responses)"

RESPONSE=$(curl -sS -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I cook pasta?", "mode": "voice", "stream": false}')

MESSAGE=$(echo "$RESPONSE" | jq -r '.message // ""')
WORD_COUNT=$(echo "$MESSAGE" | wc -w | tr -d ' ')

# Voice responses should be concise (typically < 50 words)
if [ "$WORD_COUNT" -lt 100 ]; then
  assert_pass "Voice response is concise ($WORD_COUNT words)"
else
  assert_fail "Voice response is too long ($WORD_COUNT words, expected < 100)"
fi

# ============================================================================
# Test 6: Input Validation (Empty Message)
# ============================================================================
run_test "Test 6: Input Validation (Empty Message)"

HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "", "mode": "text"}')

if [ "$HTTP_CODE" = "400" ]; then
  assert_pass "Empty message rejected with 400"
else
  assert_fail "Expected 400 for empty message, got: $HTTP_CODE"
fi

# ============================================================================
# Test 7: Auth Validation (Missing JWT)
# ============================================================================
run_test "Test 7: Auth Validation (Missing JWT)"

HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "mode": "text"}')

if [ "$HTTP_CODE" = "401" ]; then
  assert_pass "Missing JWT rejected with 401"
else
  assert_fail "Expected 401 for missing JWT, got: $HTTP_CODE"
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
  echo -e "\n${GREEN}✓ All orchestrator tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some orchestrator tests failed${NC}"
  exit 1
fi
