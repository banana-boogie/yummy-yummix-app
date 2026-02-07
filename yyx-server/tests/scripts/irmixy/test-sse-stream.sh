#!/bin/bash

# SSE Stream Helper Utility
# Parses and displays Server-Sent Events (SSE) streams for debugging

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage info
usage() {
  echo "Usage: $0 <endpoint-url> <jwt-token> <json-body>"
  echo ""
  echo "Example:"
  echo "  $0 'http://localhost:54321/functions/v1/irmixy-chat-orchestrator' \\"
  echo "     'eyJhbGc...' \\"
  echo "     '{\"message\": \"Hello\", \"mode\": \"text\", \"stream\": true}'"
  exit 1
}

# Check arguments
if [ $# -lt 3 ]; then
  usage
fi

ENDPOINT="$1"
JWT="$2"
BODY="$3"

echo -e "${BLUE}=== SSE Stream Test ===${NC}"
echo -e "${BLUE}Endpoint:${NC} $ENDPOINT"
echo -e "${BLUE}Body:${NC} $BODY"
echo ""

# Track event counts
STATUS_COUNT=0
CONTENT_COUNT=0
DONE_COUNT=0
ERROR_COUNT=0
TOTAL_EVENTS=0

# Track timing
START_TIME=$(date +%s%3N)
FIRST_EVENT_TIME=""

echo -e "${YELLOW}Streaming events:${NC}"
echo "----------------------------------------"

# Stream and parse SSE events
while IFS= read -r line; do
  # Skip empty lines (SSE delimiter)
  if [ -z "$line" ]; then
    continue
  fi

  # Extract data after "data: " prefix
  if [[ $line == data:* ]]; then
    JSON="${line#data: }"

    # Record first event time
    if [ -z "$FIRST_EVENT_TIME" ]; then
      FIRST_EVENT_TIME=$(date +%s%3N)
      TTFB=$((FIRST_EVENT_TIME - START_TIME))
      echo -e "${GREEN}[Time to First Byte: ${TTFB}ms]${NC}"
      echo ""
    fi

    # Parse event type
    EVENT_TYPE=$(echo "$JSON" | jq -r '.type // "unknown"' 2>/dev/null || echo "malformed")

    if [ "$EVENT_TYPE" = "malformed" ]; then
      echo -e "${RED}[MALFORMED JSON]${NC} $line"
      ((ERROR_COUNT++))
      continue
    fi

    ((TOTAL_EVENTS++))

    case "$EVENT_TYPE" in
      "status")
        ((STATUS_COUNT++))
        STATUS=$(echo "$JSON" | jq -r '.status // "unknown"')
        echo -e "${BLUE}[STATUS]${NC} $STATUS"
        ;;
      "content")
        ((CONTENT_COUNT++))
        CONTENT=$(echo "$JSON" | jq -r '.content // ""')
        # Truncate long content
        if [ ${#CONTENT} -gt 80 ]; then
          CONTENT="${CONTENT:0:80}..."
        fi
        echo -e "${GREEN}[CONTENT]${NC} $CONTENT"
        ;;
      "done")
        ((DONE_COUNT++))
        echo -e "${YELLOW}[DONE]${NC}"
        # Show full response summary
        FULL_CONTENT=$(echo "$JSON" | jq -r '.response.message // ""' 2>/dev/null || echo "")
        if [ -n "$FULL_CONTENT" ]; then
          CONTENT_LENGTH=${#FULL_CONTENT}
          echo -e "${BLUE}  Full response length: ${CONTENT_LENGTH} chars${NC}"
        fi
        SESSION_ID=$(echo "$JSON" | jq -r '.response.sessionId // ""' 2>/dev/null || echo "")
        if [ -n "$SESSION_ID" ]; then
          echo -e "${BLUE}  Session ID: ${SESSION_ID}${NC}"
        fi
        ;;
      "error")
        ((ERROR_COUNT++))
        ERROR_MSG=$(echo "$JSON" | jq -r '.error // "unknown error"')
        echo -e "${RED}[ERROR]${NC} $ERROR_MSG"
        ;;
      *)
        echo -e "${YELLOW}[UNKNOWN TYPE: $EVENT_TYPE]${NC}"
        ;;
    esac
  fi
done < <(curl -sS -N -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "$BODY")

END_TIME=$(date +%s%3N)
TOTAL_TIME=$((END_TIME - START_TIME))

echo "----------------------------------------"
echo -e "${BLUE}=== Summary ===${NC}"
echo -e "Total events: $TOTAL_EVENTS"
echo -e "  Status: $STATUS_COUNT"
echo -e "  Content: $CONTENT_COUNT"
echo -e "  Done: $DONE_COUNT"
echo -e "  Errors: $ERROR_COUNT"
echo -e "Total time: ${TOTAL_TIME}ms"

# Validation checks
PASS=true

if [ $DONE_COUNT -ne 1 ]; then
  echo -e "${RED}✗ Expected exactly 1 'done' event, got $DONE_COUNT${NC}"
  PASS=false
fi

if [ $ERROR_COUNT -gt 0 ]; then
  echo -e "${RED}✗ Encountered $ERROR_COUNT errors${NC}"
  PASS=false
fi

if [ $TOTAL_EVENTS -eq 0 ]; then
  echo -e "${RED}✗ No events received${NC}"
  PASS=false
fi

if [ "$PASS" = true ]; then
  echo -e "${GREEN}✓ Stream format valid${NC}"
  exit 0
else
  echo -e "${RED}✗ Stream validation failed${NC}"
  exit 1
fi
