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
- `rate_recipe` — payload: `{ action, recipe_id, recipe_name, rating?, has_feedback?, has_tags? }`
- `save_recipe` (reserved)
- `chat_message` (reserved)
- `recipe_generate`
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
- `logRatingModalShown(recipeId, recipeName)` — rating modal displayed after cooking
- `logRatingSubmitted(recipeId, recipeName, rating, hasFeedback, hasTags, source)` — rating submitted (modal or inline)
- `logRatingSkipped(recipeId, recipeName)` — user skipped rating modal

Current behavior note:
- If auth user cache is not ready yet, events are dropped. This is intentional and matches existing event behavior.

---

## Admin Dashboard Metrics

Dashboard route: `/admin/analytics`

Primary RPCs (dedicated, extracted from legacy dispatcher):
- `admin_overview()` — DAU/WAU/MAU, signups, onboarding rate
- `admin_retention()` — D1/D7/D30 retention, time to first cook
- `admin_funnel(timeframe)` — cooking funnel metrics
- `admin_top_viewed_recipes(timeframe, limit_count)` — top viewed recipes with source
- `admin_top_cooked_recipes(timeframe, limit_count)` — top cooked recipes with source
- `admin_top_searches(timeframe, limit_count)` — top search queries
- `admin_ai_adoption(timeframe)` — AI adoption rate, session counts
- `admin_ai_usage(timeframe)` — AI cost/usage breakdown
- `admin_ai_chat_session_depth(timeframe, filter_user_id)` — session depth metrics
- `admin_recipe_generation(timeframe)` — recipe generation stats (hidden in UI pending event instrumentation)
- `admin_daily_signups(timeframe)` — daily signup and onboarding counts (Overview charts)
- `admin_daily_active_users(timeframe)` — daily unique active users (Overview charts)
- `admin_daily_ai_users(timeframe)` — daily unique AI users, chat + voice (AI charts)
- `admin_content_source_split(timeframe)` — catalog vs user-generated cook counts (Content tab)

Four tabs:
1. **Overview** — active users, signups, onboarding, retention
2. **Content** — cooking funnel, top cooked recipes, top searches, top viewed (in details)
3. **AI** — adoption, costs & usage, chat session depth
4. **Operations** — feature health, reliability, and workflow diagnostics

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
