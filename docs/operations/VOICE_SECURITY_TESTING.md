# Voice Assistant Security Testing Guide

## Overview
This document outlines how to test the security of the OpenAI Realtime API ephemeral token implementation to ensure costs don't go wild.

## How Ephemeral Tokens Work

### Token Generation Flow
1. Client requests a voice session from backend (`/irmixy-voice-orchestrator`)
2. Backend validates user auth and checks quota
3. Backend calls OpenAI API to generate ephemeral token
4. Backend returns ephemeral token + session ID to client
5. Client uses token to establish WebRTC connection directly to OpenAI
6. Token expires after connection is established

### Security Features
- **Single-use**: Token can only be used once to establish WebRTC connection
- **Time-limited**: Token expires in ~60 seconds if not used
- **Scoped**: Token only works for WebRTC handshake, not API calls
- **Server-generated**: Never exposed in client code
- **Quota-protected**: Backend checks usage limits before issuing token

## Security Tests

### Test 1: Ephemeral Token Expiration
**Purpose**: Verify token expires and cannot be reused

**Steps**:
1. Start a voice session and capture the ephemeral token from backend response
2. Complete the session normally
3. Try to use the same token to establish a new WebRTC connection
4. **Expected**: Connection should fail with invalid token error

**How to capture token**:
```bash
# Enable detailed logging in OpenAIRealtimeProvider.ts
console.log('[DEBUG] Ephemeral token:', ephemeralToken);
```

**Test command** (after capturing token):
```bash
curl -X POST "https://api.openai.com/v1/realtime?model=gpt-realtime-mini" \
  -H "Authorization: Bearer <CAPTURED_TOKEN>" \
  -H "Content-Type: application/sdp" \
  --data "<SDP_OFFER>"
```

**Expected result**: `401 Unauthorized` or `Invalid token` error

### Test 2: Token Lifespan
**Purpose**: Verify token expires after ~60 seconds

**Steps**:
1. Request a voice session to get an ephemeral token
2. Wait 65 seconds WITHOUT using the token
3. Try to establish WebRTC connection with the expired token
4. **Expected**: Connection should fail

**Monitor**:
```javascript
// In OpenAIRealtimeProvider.ts initialize()
const tokenGeneratedAt = Date.now();
console.log('[DEBUG] Token generated at:', new Date(tokenGeneratedAt));

// Later, when connection fails
console.log('[DEBUG] Time elapsed:', (Date.now() - tokenGeneratedAt) / 1000, 'seconds');
```

### Test 3: Backend Quota Enforcement
**Purpose**: Verify backend refuses to issue tokens when quota exceeded

**Steps**:
1. Check current usage in database:
```sql
SELECT minutes_used, quota_limit
FROM ai_voice_usage
WHERE user_id = '<YOUR_USER_ID>'
  AND month = TO_CHAR(NOW(), 'YYYY-MM');
```

2. Manually set usage to exceed quota:
```sql
UPDATE ai_voice_usage
SET minutes_used = 31
WHERE user_id = '<YOUR_USER_ID>'
  AND month = TO_CHAR(NOW(), 'YYYY-MM');
```

3. Try to start a voice session
4. **Expected**: Backend returns `429 Too Many Requests` with error "Monthly quota exceeded"

5. Reset for testing:
```sql
UPDATE ai_voice_usage
SET minutes_used = 0
WHERE user_id = '<YOUR_USER_ID>'
  AND month = TO_CHAR(NOW(), 'YYYY-MM');
```

### Test 4: Session Duration Tracking
**Purpose**: Verify sessions are properly tracked in database

**Steps**:
1. Start a voice session
2. Have a short conversation (~30 seconds)
3. Click stop/hangup to end session
4. Check database:
```sql
SELECT
  id,
  status,
  duration_seconds,
  started_at,
  completed_at
FROM ai_voice_sessions
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY started_at DESC
LIMIT 5;
```

5. **Expected**:
   - Status should be 'completed'
   - Duration should match actual conversation time (~30 seconds)
   - completed_at should be set

6. Check usage aggregation:
```sql
SELECT
  month,
  minutes_used,
  conversations_count
FROM ai_voice_usage
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY month DESC
LIMIT 1;
```

7. **Expected**: minutes_used should increment by ~0.5 (30 seconds / 60)

### Test 5: Inactivity Timeout
**Purpose**: Verify sessions end after 30 seconds of inactivity

**Steps**:
1. Start a voice session
2. Say something to AI
3. Wait 30 seconds WITHOUT speaking
4. **Expected**: Session should auto-disconnect
5. Check console logs for: `[OpenAI] Inactivity timeout - no speech for 30 seconds, ending session`
6. Verify session duration in database is ~30-35 seconds (conversation time + timeout)

### Test 6: Goodbye Detection
**Purpose**: Verify sessions end when user says goodbye

**Steps**:
1. Start a voice session
2. Say one of the goodbye keywords:
   - English: "bye", "goodbye", "see you", "thanks", "that's all"
   - Spanish: "adiós", "hasta luego", "gracias", "eso es todo"
3. **Expected**:
   - Console shows: `[OpenAI] Goodbye detected in transcript: "<keyword>"`
   - Session ends after 2 seconds (allowing AI to respond)
   - Session duration matches actual conversation time

### Test 7: Multiple Sessions Quota Accumulation
**Purpose**: Verify quota accumulates correctly across sessions

**Steps**:
1. Start session 1, talk for 1 minute, end session
2. Start session 2, talk for 1 minute, end session
3. Start session 3, talk for 1 minute, end session
4. Check database:
```sql
SELECT
  minutes_used,
  conversations_count
FROM ai_voice_usage
WHERE user_id = '<YOUR_USER_ID>'
  AND month = TO_CHAR(NOW(), 'YYYY-MM');
```

5. **Expected**:
   - minutes_used ≈ 3.0 (3 minutes total)
   - conversations_count = 3

### Test 8: Network Monitoring
**Purpose**: Monitor actual OpenAI API costs

**Steps**:
1. Visit [OpenAI Usage Dashboard](https://platform.openai.com/usage)
2. Note current usage for the day
3. Run 5 test conversations (~30 seconds each)
4. Check dashboard again
5. **Expected cost**:
   - Input audio: ~2.5 minutes × $10/1M tokens ≈ $0.04
   - Output audio: ~2.5 minutes × $20/1M tokens ≈ $0.08
   - Total: ~$0.12 for 2.5 minutes of conversation

### Test 9: Connection Cleanup
**Purpose**: Verify WebRTC connections are properly closed

**Steps**:
1. Start a voice session
2. Open Chrome DevTools → Network tab
3. Filter for WebSocket/WebRTC connections
4. End the session
5. **Expected**: All WebRTC connections should close (status: closed)
6. Check console for:
   - `[OpenAI] Closing data channel`
   - `[OpenAI] Closing peer connection`
   - `[OpenAI] Audio routing stopped`

### Test 10: Unauthorized Access Attempt
**Purpose**: Verify backend rejects unauthenticated requests

**Steps**:
1. Try to call `/irmixy-voice-orchestrator` without auth token:
```bash
curl -X POST \
  "https://<YOUR_SUPABASE_URL>/functions/v1/irmixy-voice-orchestrator" \
  -H "Content-Type: application/json"
```

2. **Expected**: `401 Unauthorized` response

## Monitoring Best Practices

### Daily Monitoring
1. Check OpenAI Usage Dashboard daily for unexpected spikes
2. Set up billing alerts in OpenAI dashboard (e.g., alert at $2/day)

### Weekly Monitoring
1. Run this query to check for anomalies:
```sql
SELECT
  u.user_id,
  u.month,
  u.minutes_used,
  u.conversations_count,
  ROUND(u.minutes_used / NULLIF(u.conversations_count, 0), 2) as avg_minutes_per_conversation
FROM ai_voice_usage u
WHERE u.month = TO_CHAR(NOW(), 'YYYY-MM')
ORDER BY u.minutes_used DESC
LIMIT 10;
```

2. Look for:
   - Users with unusually high minutes_used
   - Conversations with very long avg_minutes_per_conversation (should be 0.5-2.0)

### Cost Alerts
Set up alerts in OpenAI dashboard:
- Warning: $2/day (4 hours of conversation)
- Critical: $5/day (10 hours - indicates abuse)

## Security Checklist

- [ ] Ephemeral tokens expire after 60 seconds
- [ ] Tokens cannot be reused after connection established
- [ ] Backend enforces 30-minute monthly quota
- [ ] Sessions properly tracked in database with accurate durations
- [ ] Inactivity timeout works (30 seconds)
- [ ] Goodbye detection works for all keywords
- [ ] WebRTC connections properly closed on session end
- [ ] Unauthorized requests rejected
- [ ] OpenAI costs match expected rates (~$0.025 per 30s conversation)
- [ ] Database triggers correctly aggregate usage

## Troubleshooting

### Sessions not completing in database
**Symptom**: ai_voice_sessions entries have status='active' forever

**Debug**:
```javascript
// Check console logs for:
[OpenAI] stopConversation called
[OpenAI] Session duration: X.XXs
[OpenAI] Updating session...
[OpenAI] Session updated successfully
```

**Fix**: Ensure stopConversation() is being called when:
- User clicks hangup
- Inactivity timeout fires
- Goodbye detected

### Costs higher than expected
**Symptom**: OpenAI bills more than $0.025 per 30s conversation

**Check**:
1. Verify no initial AI greeting (costs extra):
```javascript
// Should NOT see this in code:
this.sendEvent({ type: 'response.create', ... })
```

2. Check for long-running sessions:
```sql
SELECT id, duration_seconds
FROM ai_voice_sessions
WHERE duration_seconds > 120 -- sessions longer than 2 minutes
ORDER BY duration_seconds DESC;
```

3. Verify inactivity timeout is working (check logs)

## Additional Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime-webrtc)
- [OpenAI Usage Dashboard](https://platform.openai.com/usage)
- [OpenAI Billing Limits](https://platform.openai.com/account/billing/limits)
