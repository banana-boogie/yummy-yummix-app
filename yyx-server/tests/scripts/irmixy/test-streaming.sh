#!/bin/bash

# Streaming & Performance Test Script
# Tests: SSE format, timing, performance benchmarks, load testing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
  echo "Usage: $0 <jwt-token> [--load]"
  echo ""
  echo "Options:"
  echo "  --load    Run load tests (10 concurrent requests)"
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

JWT="$1"
RUN_LOAD_TESTS=false
if [ "${2:-}" = "--load" ]; then
  RUN_LOAD_TESTS=true
fi

BASE_URL="http://localhost:54321/functions/v1"
PASS_COUNT=0
FAIL_COUNT=0

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

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Streaming & Performance Test Suite${NC}"
echo -e "${YELLOW}========================================${NC}"

# Cross-platform millisecond timestamp function
get_ms() {
  if command -v gdate >/dev/null 2>&1; then
    gdate +%s%3N
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: use python for milliseconds
    python3 -c 'import time; print(int(time.time() * 1000))'
  else
    date +%s%3N
  fi
}

# ============================================================================
# Test 1: SSE Content-Type Header
# ============================================================================
run_test "Test 1: SSE Content-Type Header"

HEADERS=$(curl -sS -I -X POST "$BASE_URL/ai-orchestrator" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "mode": "text", "stream": true}' 2>&1 | head -20)

if echo "$HEADERS" | grep -qi "text/event-stream"; then
  assert_pass "Content-Type is text/event-stream"
else
  assert_fail "Content-Type is not text/event-stream"
fi

# ============================================================================
# Test 2: SSE Event Format
# ============================================================================
run_test "Test 2: SSE Event Format (data: prefix)"

STREAM_OUTPUT=$(mktemp)
curl -sS -N -X POST "$BASE_URL/ai-orchestrator" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Say hello", "mode": "text", "stream": true}' \
  --max-time 30 > "$STREAM_OUTPUT" 2>&1 || true

# Check all data lines have proper format
DATA_LINES=$(grep -c "^data:" "$STREAM_OUTPUT" || echo "0")
if [ "$DATA_LINES" -gt 0 ]; then
  assert_pass "Found $DATA_LINES SSE data events"
else
  assert_fail "No SSE data events found"
fi

rm -f "$STREAM_OUTPUT"

# ============================================================================
# Test 3: Event Sequence (status -> content -> done)
# ============================================================================
run_test "Test 3: Event Sequence Validation"

STREAM_OUTPUT=$(mktemp)
curl -sS -N -X POST "$BASE_URL/ai-orchestrator" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Count to 3", "mode": "text", "stream": true}' \
  --max-time 30 > "$STREAM_OUTPUT" 2>&1 || true

# Extract event types in order
EVENT_SEQUENCE=""
while IFS= read -r line; do
  if [[ $line == data:* ]]; then
    JSON="${line#data: }"
    TYPE=$(echo "$JSON" | jq -r '.type // ""' 2>/dev/null || echo "")
    if [ -n "$TYPE" ]; then
      EVENT_SEQUENCE="$EVENT_SEQUENCE $TYPE"
    fi
  fi
done < "$STREAM_OUTPUT"

# Check sequence (use grep -o to count occurrences, not lines)
HAS_STATUS=$(echo "$EVENT_SEQUENCE" | grep -o "status" | wc -l | tr -d ' ')
HAS_CONTENT=$(echo "$EVENT_SEQUENCE" | grep -o "content" | wc -l | tr -d ' ')
HAS_DONE=$(echo "$EVENT_SEQUENCE" | grep -o "done" | wc -l | tr -d ' ')

# Ensure they're valid integers
HAS_STATUS=${HAS_STATUS:-0}
HAS_CONTENT=${HAS_CONTENT:-0}
HAS_DONE=${HAS_DONE:-0}

if [ "$HAS_STATUS" -ge 1 ]; then
  assert_pass "Status event present"
else
  assert_fail "Missing status event"
fi

if [ "$HAS_CONTENT" -ge 1 ]; then
  assert_pass "Content events present ($HAS_CONTENT)"
else
  assert_fail "Missing content events"
fi

if [ "$HAS_DONE" -eq 1 ]; then
  assert_pass "Done event present (exactly 1)"
else
  assert_fail "Done event missing or duplicated ($HAS_DONE)"
fi

rm -f "$STREAM_OUTPUT"

# ============================================================================
# Test 4: All Events Are Valid JSON
# ============================================================================
run_test "Test 4: All Events Are Valid JSON"

STREAM_OUTPUT=$(mktemp)
curl -sS -N -X POST "$BASE_URL/ai-orchestrator" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about cooking", "mode": "text", "stream": true}' \
  --max-time 30 > "$STREAM_OUTPUT" 2>&1 || true

INVALID_COUNT=0
VALID_COUNT=0
while IFS= read -r line; do
  if [[ $line == data:* ]]; then
    JSON="${line#data: }"
    if echo "$JSON" | jq empty 2>/dev/null; then
      ((VALID_COUNT++))
    else
      ((INVALID_COUNT++))
      echo -e "${RED}  Invalid JSON: ${line:0:50}...${NC}"
    fi
  fi
done < "$STREAM_OUTPUT"

if [ "$INVALID_COUNT" -eq 0 ] && [ "$VALID_COUNT" -gt 0 ]; then
  assert_pass "All $VALID_COUNT events are valid JSON"
else
  assert_fail "$INVALID_COUNT invalid JSON events (of $((VALID_COUNT + INVALID_COUNT)) total)"
fi

rm -f "$STREAM_OUTPUT"

# ============================================================================
# Test 5: Time to First Byte (TTFB)
# ============================================================================
run_test "Test 5: Time to First Byte (TTFB)"

START_TIME=$(get_ms)
FIRST_BYTE_TIME=""

# Use timeout to capture first byte timing
STREAM_OUTPUT=$(mktemp)
(
  curl -sS -N -X POST "$BASE_URL/ai-orchestrator" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"message": "Hi", "mode": "text", "stream": true}' \
    --max-time 10 > "$STREAM_OUTPUT" 2>&1
) &
CURL_PID=$!

# Wait for first data
while [ ! -s "$STREAM_OUTPUT" ]; do
  sleep 0.05
  if ! kill -0 $CURL_PID 2>/dev/null; then
    break
  fi
done

FIRST_BYTE_TIME=$(get_ms)
TTFB=$((FIRST_BYTE_TIME - START_TIME))

# Wait for curl to finish (with timeout)
wait $CURL_PID 2>/dev/null || true

if [ "$TTFB" -lt 1000 ]; then
  assert_pass "TTFB: ${TTFB}ms (target: < 1000ms)"
elif [ "$TTFB" -lt 2000 ]; then
  echo -e "${YELLOW}  TTFB: ${TTFB}ms (acceptable but slow)${NC}"
  assert_pass "TTFB: ${TTFB}ms (under max threshold)"
else
  assert_fail "TTFB: ${TTFB}ms (too slow, target: < 1000ms)"
fi

rm -f "$STREAM_OUTPUT"

# ============================================================================
# Test 6: Non-Streaming Response Time
# ============================================================================
run_test "Test 6: Non-Streaming Response Time"

START_TIME=$(get_ms)
RESPONSE=$(curl -sS -X POST "$BASE_URL/ai-orchestrator" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi", "mode": "text", "stream": false}')
END_TIME=$(get_ms)

DURATION=$((END_TIME - START_TIME))

if echo "$RESPONSE" | jq -e '.message' >/dev/null 2>&1; then
  if [ "$DURATION" -lt 5000 ]; then
    assert_pass "Response time: ${DURATION}ms (target: < 5000ms)"
  else
    assert_fail "Response time: ${DURATION}ms (too slow, target: < 5000ms)"
  fi
else
  assert_fail "Invalid response"
fi

# ============================================================================
# Test 7: Stream Closes Properly
# ============================================================================
run_test "Test 7: Stream Closes Properly"

STREAM_OUTPUT=$(mktemp)
START_TIME=$(get_ms)

curl -sS -N -X POST "$BASE_URL/ai-orchestrator" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Say OK", "mode": "text", "stream": true}' \
  --max-time 30 > "$STREAM_OUTPUT" 2>&1

EXIT_CODE=$?
END_TIME=$(get_ms)
DURATION=$((END_TIME - START_TIME))

if [ $EXIT_CODE -eq 0 ]; then
  assert_pass "Stream closed cleanly (${DURATION}ms)"
else
  assert_fail "Stream did not close cleanly (exit code: $EXIT_CODE)"
fi

rm -f "$STREAM_OUTPUT"

# ============================================================================
# Test 8: AI Chat Streaming
# ============================================================================
run_test "Test 8: AI Chat Streaming"

STREAM_OUTPUT=$(mktemp)
curl -sS -N -X POST "$BASE_URL/ai-chat" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "stream": true}' \
  --max-time 30 > "$STREAM_OUTPUT" 2>&1 || true

DATA_LINES=$(grep -c "^data:" "$STREAM_OUTPUT" || echo "0")
if [ "$DATA_LINES" -gt 0 ]; then
  assert_pass "AI Chat streaming works ($DATA_LINES events)"
else
  assert_fail "AI Chat streaming failed"
fi

rm -f "$STREAM_OUTPUT"

# ============================================================================
# Load Tests (optional)
# ============================================================================
if [ "$RUN_LOAD_TESTS" = true ]; then
  run_test "Test 9: Load Test (10 Concurrent Requests)"

  RESULTS_DIR=$(mktemp -d)

  echo "  Starting 10 concurrent requests..."
  for i in {1..10}; do
    (
      START=$(get_ms)
      HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/ai-orchestrator" \
        -H "Authorization: Bearer $JWT" \
        -H "Content-Type: application/json" \
        -d '{"message": "Hello", "mode": "text", "stream": false}' \
        --max-time 30)
      END=$(get_ms)
      DURATION=$((END - START))
      echo "$i,$HTTP_CODE,$DURATION" > "$RESULTS_DIR/result_$i.txt"
    ) &
  done

  # Wait for all requests
  wait

  # Analyze results
  SUCCESS=0
  FAILED=0
  MAX_TIME=0
  TOTAL_TIME=0

  for f in "$RESULTS_DIR"/result_*.txt; do
    if [ -f "$f" ]; then
      IFS=',' read -r NUM CODE DURATION < "$f"
      TOTAL_TIME=$((TOTAL_TIME + DURATION))
      if [ "$DURATION" -gt "$MAX_TIME" ]; then
        MAX_TIME=$DURATION
      fi
      if [ "$CODE" = "200" ]; then
        ((SUCCESS++))
      else
        ((FAILED++))
        echo -e "${RED}    Request $NUM failed with code $CODE${NC}"
      fi
    fi
  done

  AVG_TIME=$((TOTAL_TIME / 10))

  echo -e "  Results:"
  echo -e "    Success: $SUCCESS/10"
  echo -e "    Avg time: ${AVG_TIME}ms"
  echo -e "    Max time: ${MAX_TIME}ms"

  if [ "$SUCCESS" -eq 10 ]; then
    assert_pass "All 10 concurrent requests succeeded"
  else
    assert_fail "$FAILED of 10 requests failed"
  fi

  if [ "$MAX_TIME" -lt 15000 ]; then
    assert_pass "Max response time ${MAX_TIME}ms (target: < 15000ms)"
  else
    assert_fail "Max response time ${MAX_TIME}ms exceeds threshold"
  fi

  rm -rf "$RESULTS_DIR"
else
  echo -e "\n${YELLOW}Skipping load tests. Run with --load to enable.${NC}"
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

echo -e "\n${BLUE}Performance Benchmarks:${NC}"
echo -e "  TTFB (streaming): < 1000ms target"
echo -e "  Non-streaming: < 5000ms target"
echo -e "  Load test max: < 15000ms target"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "\n${GREEN}✓ All streaming tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some streaming tests failed${NC}"
  exit 1
fi
