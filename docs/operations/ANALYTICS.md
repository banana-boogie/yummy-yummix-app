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

**Source of truth for event names + payload shapes:** `yyx-app/services/analytics/eventTypes.ts` (`EventPayloadMap`).

The `event_type` CHECK allowlist is kept in sync via migration. The current allowlist (see `20260413000000_expand_user_events_event_type_check.sql`) covers:

- **Legacy events (active or reserved):** `view_recipe`, `cook_start`, `cook_complete`, `search`, `recipe_generate`, `action_execute`, `rate_recipe`, `save_recipe`, `chat_message`, `suggestion_click`, `ai_chat_start`, `ai_voice_start`.
- **Plan 06 — Planner funnel:** `week_tab_viewed`, `planner_setup_started`, `planner_setup_completed`, `meal_plan_generation_started`, `meal_plan_generated`, `meal_plan_generation_failed`, `meal_plan_viewed`, `meal_plan_approved`, `meal_plan_meal_swapped`, `meal_plan_swap_failed`, `meal_plan_skipped`, `meal_plan_skip_suggestion_shown` / `_accepted` / `_dismissed`.
- **Plan 06 — Shopping funnel:** `shopping_list_generation_started`, `shopping_list_generated_from_plan`, `shopping_list_generation_failed`, `shopping_list_opened`, `shopping_list_refreshed_from_plan`.
- **Plan 06 — Cooking / ratings:** `planned_meal_cook_started`, `planned_meal_cook_completed`, `recipe_rated`, `recipe_difficulty_flagged_for_review`, `recipe_difficulty_override_applied`.
- **Plan 06 — Entry / discovery:** `chat_home_action_tapped`, `explore_section_viewed`, `explore_recipe_opened`, `explore_filter_applied`.
- **Strategy 2026-04-25 — Mi Menú surface + decision metrics** (back the 5-metric decision filter + cohort breakdown + willingness-to-pay): `mi_menu_today_viewed`, `mi_menu_today_cook_tapped`, `mi_menu_today_swap_tapped`, `mi_menu_week_view_opened`, `pricing_test_response`, `beta_cohort_assigned`, `founder_session_opened`.

To add a new event:
1. Add an entry to `EventPayloadMap` (with a `*Payload` interface for the shape).
2. Create a new migration that extends the `user_events_event_type_check` allowlist.
3. Wire the call-site through `eventService.trackEvent({ name, payload }, envelope)` — never widen the name to a string.
4. Update this doc.

References:
- Plan 06: `product-kitchen/repeat-what-works/plans/06-analytics-and-metrics.md`
- 5-metric decision filter + kill criteria: `product-kitchen/PRODUCT_STRATEGY.md` (Success Metrics) and `product-kitchen/repeat-what-works/plans/EXECUTION.md` (Gates).

### Common envelope

Every event tracked via `trackEvent` carries an `AnalyticsEnvelope` of cross-cutting metadata:

| Field           | Type                                               | Notes                                                                 |
|-----------------|----------------------------------------------------|-----------------------------------------------------------------------|
| `locale`        | `string`                                           | User UI locale (e.g. `'es-MX'`).                                      |
| `appPlatform`   | `'ios' \| 'android' \| 'web'`                      | Derived automatically from `Platform.OS`; not caller-supplied.        |
| `sourceSurface` | `'week' \| 'chat' \| 'explore' \| 'profile' \| 'shopping' \| null` | Canonical Plan 06 surface union. More granular contexts (`recipe_detail`, `notification`) live in event-specific payload fields, not the envelope. |
| `cohortSegment` | `'sofia' \| 'lupita' \| null`                      | Beta cohort. Funnel queries must filter by this to support kill-criteria decisions (week-2 return ≥ 8/15, willingness-to-pay ≥ 5/15). Set at beta enrollment. |

The envelope is currently flattened into `payload._envelope` until a backfill migration adds top-level `locale`, `app_platform`, `source_surface`, `cohort_segment` columns. Funnel queries should read from `payload->'_envelope'` until then.

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

**Preferred entry point** for all new events:

```ts
eventService.trackEvent(
  { name: 'meal_plan_approved', payload: { mealPlanId, weekStart, ... } },
  { locale: 'es-MX', sourceSurface: 'week', cohortSegment: 'sofia' },
);
```

The discriminated `AnalyticsEvent` shape (`{ name, payload }`) keeps the name/payload correlation under the union, so TypeScript rejects mismatched pairs at compile time. Type-level regressions in `services/__tests__/eventService.test.ts` lock this strictness.

**Legacy `logXxx` helpers** (kept for backwards compatibility, pre-date the envelope):
- `logRecipeView(recipeId, recipeName)`
- `logCookStart(recipeId, recipeName)`
- `logCookComplete(recipeId, recipeName)`
- `logSearch(query)`
- `logRecipeGenerate(recipeName, success, durationMs)`
- `logActionExecute(actionType, source, path)`

These ship a `LEGACY_ENVELOPE_INPUT` (empty locale, null `sourceSurface`, null `cohortSegment`). Feature PRs migrating these call-sites to `trackEvent(...)` should supply real envelope values.

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

When adding a new product event:
1. Add the entry + payload interface to `EventPayloadMap` in `yyx-app/services/analytics/eventTypes.ts`.
2. Create a migration that extends the `user_events_event_type_check` allowlist.
3. Wire the call-site through `eventService.trackEvent({ name, payload }, envelope)`.
4. Set `cohortSegment` on the envelope so funnel queries can group by beta cohort.
5. Update the event list in this doc.
