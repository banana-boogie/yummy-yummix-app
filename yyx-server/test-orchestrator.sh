#!/bin/bash

# Test Irmixy AI Orchestrator
# This script tests the orchestrator endpoint with both streaming and non-streaming modes

SUPABASE_URL="http://127.0.0.1:54321"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

echo "========================================="
echo "Testing Irmixy AI Orchestrator"
echo "========================================="
echo ""

# Test 1: Non-streaming request (simple message)
echo "Test 1: Non-streaming request"
echo "Request: 'Hello, I want to find a pasta recipe'"
echo ""

curl -X POST "${SUPABASE_URL}/functions/v1/ai-orchestrator" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, I want to find a pasta recipe",
    "mode": "text",
    "stream": false
  }' | jq '.'

echo ""
echo "========================================="
echo ""

# Test 2: Streaming request
echo "Test 2: Streaming request"
echo "Request: 'Find me a quick healthy dinner'"
echo ""

curl -X POST "${SUPABASE_URL}/functions/v1/ai-orchestrator" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find me a quick healthy dinner",
    "mode": "text",
    "stream": true
  }'

echo ""
echo ""
echo "========================================="
echo "Tests complete!"
echo "========================================="
