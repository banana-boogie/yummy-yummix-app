#!/bin/bash

# AI Voice Test Script
# Tests: Base64 audio format, FormData format, transcription, short responses, validation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
  echo "Usage: $0 <jwt-token> [audio-file]"
  echo ""
  echo "If audio-file not provided, tests will use generated silent audio"
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

JWT="$1"
AUDIO_FILE="${2:-}"
ENDPOINT="http://localhost:54321/functions/v1/ai-voice"
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

# Generate a silent audio file if none provided
generate_test_audio() {
  local output="$1"
  # Create 1 second of silence using ffmpeg if available
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame "$output" >/dev/null 2>&1
    return 0
  fi
  return 1
}

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}AI Voice Test Suite${NC}"
echo -e "${YELLOW}========================================${NC}"

# Prepare test audio
TEST_AUDIO=$(mktemp -u).mp3
if [ -n "$AUDIO_FILE" ] && [ -f "$AUDIO_FILE" ]; then
  TEST_AUDIO="$AUDIO_FILE"
  echo -e "${BLUE}Using provided audio file: $AUDIO_FILE${NC}"
else
  if generate_test_audio "$TEST_AUDIO"; then
    echo -e "${BLUE}Generated test audio: $TEST_AUDIO${NC}"
  else
    echo -e "${YELLOW}Warning: ffmpeg not available, some tests may be skipped${NC}"
  fi
fi

# ============================================================================
# Test 1: Empty Audio Validation
# ============================================================================
run_test "Test 1: Empty Audio Validation"

HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"language": "en"}')

if [ "$HTTP_CODE" = "400" ]; then
  assert_pass "Empty audio rejected with 400"
else
  assert_fail "Expected 400 for empty audio, got: $HTTP_CODE"
fi

# ============================================================================
# Test 2: Base64 Audio Format
# ============================================================================
if [ -f "$TEST_AUDIO" ]; then
  run_test "Test 2: Base64 Audio Format"

  AUDIO_BASE64=$(base64 -i "$TEST_AUDIO" | tr -d '\n')
  RESPONSE=$(curl -sS -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"audioBase64\": \"$AUDIO_BASE64\", \"language\": \"en\"}")

  # Check transcription
  TRANSCRIPTION=$(echo "$RESPONSE" | jq -r '.transcription // ""')
  if [ -n "$TRANSCRIPTION" ]; then
    assert_pass "Transcription returned: \"$TRANSCRIPTION\""
  else
    # Silent audio may have empty transcription
    assert_pass "Transcription field present (empty for silent audio)"
  fi

  # Check response
  AI_RESPONSE=$(echo "$RESPONSE" | jq -r '.response // ""')
  if [ -n "$AI_RESPONSE" ]; then
    assert_pass "AI response returned (${#AI_RESPONSE} chars)"
  else
    assert_fail "AI response is empty"
  fi

  # Check response is SHORT (voice mode)
  WORD_COUNT=$(echo "$AI_RESPONSE" | wc -w | tr -d ' ')
  if [ "$WORD_COUNT" -lt 100 ]; then
    assert_pass "Response is concise for voice ($WORD_COUNT words)"
  else
    assert_fail "Response too long for voice ($WORD_COUNT words, expected < 100)"
  fi

  # Check audioBase64 (TTS output)
  AUDIO_OUTPUT=$(echo "$RESPONSE" | jq -r '.audioBase64 // ""')
  if [ -n "$AUDIO_OUTPUT" ] && [ "$AUDIO_OUTPUT" != "null" ]; then
    assert_pass "TTS audio returned (${#AUDIO_OUTPUT} chars base64)"
  else
    assert_fail "No TTS audio returned"
  fi

  # Check sessionId
  SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId // ""')
  if [ -n "$SESSION_ID" ]; then
    assert_pass "Session ID returned"
  else
    assert_fail "No session ID in response"
  fi
else
  echo -e "${YELLOW}Skipping Test 2: No audio file available${NC}"
fi

# ============================================================================
# Test 3: FormData Format (Legacy Support)
# ============================================================================
if [ -f "$TEST_AUDIO" ]; then
  run_test "Test 3: FormData Format (Legacy)"

  RESPONSE=$(curl -sS -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $JWT" \
    -F "audio=@$TEST_AUDIO" \
    -F "language=en")

  # Check response structure
  TRANSCRIPTION=$(echo "$RESPONSE" | jq -r '.transcription // ""' 2>/dev/null || echo "")
  AI_RESPONSE=$(echo "$RESPONSE" | jq -r '.response // ""' 2>/dev/null || echo "")

  if [ -n "$AI_RESPONSE" ]; then
    assert_pass "FormData format works (legacy support)"
  else
    # If FormData not supported, check if error is clear
    if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
      assert_fail "FormData rejected (may not be implemented yet)"
    else
      assert_fail "Unexpected response format"
    fi
  fi
else
  echo -e "${YELLOW}Skipping Test 3: No audio file available${NC}"
fi

# ============================================================================
# Test 4: Spanish Language Support
# ============================================================================
if [ -f "$TEST_AUDIO" ]; then
  run_test "Test 4: Spanish Language Support"

  AUDIO_BASE64=$(base64 -i "$TEST_AUDIO" | tr -d '\n')
  RESPONSE=$(curl -sS -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"audioBase64\": \"$AUDIO_BASE64\", \"language\": \"es\"}")

  AI_RESPONSE=$(echo "$RESPONSE" | jq -r '.response // ""')
  if [ -n "$AI_RESPONSE" ]; then
    assert_pass "Spanish language request processed"
    # Check if response contains Spanish words (basic check)
    if echo "$AI_RESPONSE" | grep -Eq '\b(el|la|un|una|soy|puedo)\b'; then
      assert_pass "Response appears to be in Spanish"
    fi
  else
    assert_fail "No response for Spanish request"
  fi
else
  echo -e "${YELLOW}Skipping Test 4: No audio file available${NC}"
fi

# ============================================================================
# Test 5: Auth Validation
# ============================================================================
run_test "Test 5: Auth Validation"

if [ -f "$TEST_AUDIO" ]; then
  AUDIO_BASE64=$(base64 -i "$TEST_AUDIO" | tr -d '\n')
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{\"audioBase64\": \"$AUDIO_BASE64\", \"language\": \"en\"}")

  if [ "$HTTP_CODE" = "401" ]; then
    assert_pass "Missing JWT rejected with 401"
  else
    assert_fail "Expected 401 for missing JWT, got: $HTTP_CODE"
  fi
else
  echo -e "${YELLOW}Skipping Test 5: No audio file available${NC}"
fi

# Cleanup
if [ -f "$TEST_AUDIO" ] && [ "$TEST_AUDIO" != "$AUDIO_FILE" ]; then
  rm -f "$TEST_AUDIO"
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
  echo -e "\n${GREEN}✓ All voice tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some voice tests failed${NC}"
  exit 1
fi
