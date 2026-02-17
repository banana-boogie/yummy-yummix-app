# YummyYummix Analytics

This document is the high-level reference for product analytics and customer AI cost tracking.

## Goals

We track:
- Product engagement and retention (recipe discovery/cooking flow)
- Customer AI usage by channel (text + voice)
- Customer AI cost trends over time

We avoid:
- PII in analytics payloads
- Raw prompt/message content in cost logs

---

## Data Sources

## 1) Product events (`user_events`)

```sql
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Allowed event types:
- `view_recipe`
- `cook_start`
- `cook_complete`
- `search`
- `rate_recipe` (reserved)
- `save_recipe` (reserved)
- `chat_message` (reserved)
- `recipe_generate`
- `suggestion_click`
- `ai_chat_start` (reserved, not instrumented yet)
- `ai_voice_start` (reserved, not instrumented yet)

## 2) Text AI usage (`ai_usage_logs`)

Customer-facing text AI calls (chat orchestration + recipe generation attempts) are logged to `ai_usage_logs`.

Key fields:
- `user_id`, `session_id`, `request_id`
- `call_phase` (`tool_decision`, `response_stream`, `recipe_generation`, `modification`)
- `attempt` (retry index)
- `status` (`success`, `partial`, `error`)
- `usage_type`, `model`, `input_tokens`, `output_tokens`
- `estimated_cost_usd`, `pricing_version`
- `duration_ms`, `metadata`

Design notes:
- Idempotent writes via unique key `(request_id, call_phase, attempt)`
- `estimated_cost_usd` is derived from token usage when available
- Metadata is operational only; no prompts/user text are stored

## 3) Voice AI usage (`ai_voice_sessions`)

Voice usage and costs come from persisted voice session records (`duration_seconds`, `cost_usd`, token columns where available).

For admin reporting, voice cost uses **actual stored DB cost**, not a UI estimate.

---

## Event Tracking in App

Source service: `yyx-app/services/eventService.ts`

Tracked methods:
- `logRecipeView(recipeId, recipeName)`
- `logCookStart(recipeId, recipeName)`
- `logCookComplete(recipeId, recipeName)`
- `logSearch(query)`
- `logRecipeGenerate(recipeName, success, durationMs)`
- `logSuggestionClick(label, location)`

Current behavior note:
- If auth user cache is not ready yet, events are dropped. This is intentional and matches existing event behavior.

---

## Admin Dashboard Metrics

Dashboard route: `/admin/analytics`

Primary RPCs:
- `admin_analytics(action, timeframe, limit_count)`
- `admin_ai_usage(timeframe)`

AI tab shows two groups:
1. **AI adoption** (chat/voice sessions, adoption rate, returning AI users)
2. **AI costs & usage** (text cost, voice cost, total cost, token usage, latency, error rate, model and phase breakdowns, daily cost trend)

Timeframes:
- `today`
- `7_days`
- `30_days`
- `all_time`

---

## Pricing Model (Text AI)

Pricing is versioned in backend code:
- File: `yyx-server/supabase/functions/_shared/usage-logger.ts`
- Constant: `PRICING_VERSION`
- Map: `MODEL_PRICING_PER_MILLION`

## When model pricing changes

1. Update rates in `MODEL_PRICING_PER_MILLION`
2. Increment `PRICING_VERSION`
3. Deploy edge functions
4. (Optional) run a backfill migration/script if you want historical rows recalculated under new rates

Important:
- Historical rows remain auditable because each row stores the pricing version used at write time.
- `estimated_cost_usd` is a convenience metric; raw token columns remain source-of-truth.

---

## What Is Included in AI Cost Tracking

Included now:
- Customer text chat orchestration usage
- Customer text recipe-generation usage (including retry attempts)
- Customer voice session cost from DB session records

Excluded intentionally:
- Admin/internal parsing tools (for now)
- Embedding/RAG batch costs

---

## Validation Queries

Use these after deployment:

```sql
-- 1) Check text AI usage volume by status and phase
SELECT call_phase, status, COUNT(*)
FROM ai_usage_logs
GROUP BY 1, 2
ORDER BY 1, 2;

-- 2) Verify dedupe key behavior
SELECT request_id, call_phase, attempt, COUNT(*)
FROM ai_usage_logs
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;

-- 3) Validate AI usage RPC shape
SELECT admin_ai_usage('7_days');

-- 4) Validate recipe generation event ingestion
SELECT COUNT(*)
FROM user_events
WHERE event_type = 'recipe_generate';

-- 5) Compare voice cost aggregate for sanity
SELECT COALESCE(SUM(cost_usd), 0)
FROM ai_voice_sessions
WHERE status = 'completed'
  AND COALESCE(completed_at, started_at) >= now() - interval '7 days';
```

---

## Operational Checklist

When adding a new customer AI flow:
1. Add instrumentation via `logAIUsage()` in backend flow
2. Set `function_name`, `call_phase`, and `usage_type` clearly
3. Ensure metadata stays non-sensitive
4. Add tests for success/partial/error paths
5. Update this doc if new metrics or pricing behavior changes
