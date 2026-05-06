# Database Functions Reference

Custom PostgreSQL functions available via Supabase RPC.

## Quick Reference

| Function | Purpose | Used By |
|----------|---------|---------|
| `is_admin()` | Check if current user has admin role | RLS policies |
| `admin_overview()` | Active users (DAU/WAU/MAU), signups, onboarding rate | Admin Overview tab |
| `admin_retention()` | D1/D7/D30 retention, time to first cook, weekly cook rate | Admin Overview tab |
| `admin_funnel(timeframe)` | Cooking funnel metrics (views/starts/completes + rates) | Admin Content tab |
| `admin_top_viewed_recipes(timeframe, limit_count)` | Top viewed recipes with source (catalog/user) | Admin Content tab |
| `admin_top_cooked_recipes(timeframe, limit_count)` | Top cooked recipes with source (catalog/user) | Admin Content tab |
| `admin_top_searches(timeframe, limit_count)` | Top search queries | Admin Content tab |
| `admin_ai_adoption(timeframe)` | AI adoption rate, session counts, return users | Admin AI tab |
| `admin_ai_usage(timeframe)` | AI cost/usage breakdown (text + voice) | Admin AI tab |
| `admin_recipe_generation(timeframe)` | Recipe generation success/failure rates | Admin AI tab |
| `admin_daily_signups(timeframe)` | Daily signup and onboarding counts | Admin Overview charts |
| `admin_daily_active_users(timeframe)` | Daily unique active users | Admin Overview charts |
| `admin_daily_ai_users(timeframe)` | Daily unique AI users (chat + voice) | Admin AI charts |
| `admin_content_source_split(timeframe)` | Catalog vs user-generated cook counts | Admin Content tab |
| `admin_ai_chat_session_depth(timeframe, filter_user_id)` | Chat session depth, distribution, tool usage | Admin Operations tab |
| `find_closest_ingredient(name, lang)` | Find ingredient by fuzzy name match | Custom recipe generation |
| `update_ai_voice_usage()` | Track AI voice minutes | Voice endpoints |
| `upsert_cooking_session_progress(recipe_id, recipe_type, recipe_name, current_step, total_steps)` | Upsert active cooking progress per user+recipe | Cooking guide progress + resume prompt |
| `get_cooked_recipes(p_language, p_query, p_after, p_before, p_limit)` | Retrieve user's cooked recipe history with optional search and date range | Cooked recipes tool |
| `match_recipe_embeddings(query_embedding, match_threshold, match_count)` | Vector similarity search for published recipes | Hybrid recipe search tool |
| `admin_set_membership_tier(target_user_id, new_tier)` | Change a user's membership tier (free/premium) | Admin dashboard, SQL Editor |
| `regenerate_plan_shopping_list_items(p_plan_id, p_list_id, p_items)` | Atomically replace plan-sourced shopping-list rows | meal-planner edge function (`generate_shopping_list` action) |

## Function Details

### `find_closest_ingredient(search_name, preferred_lang)`

Find the best matching ingredient using trigram similarity. Prioritizes matches in the user's preferred language.

**Parameters:**
- `search_name` (text): Ingredient name to search for
- `preferred_lang` (text, default 'en'): User's language ('en' or 'es')

**Returns:** `{id, name_en, name_es, image_url, match_score}`

**Example:**
```sql
SELECT * FROM find_closest_ingredient('mixed vegetables', 'en');
-- Returns: frozen mixed veggies (score: 0.45)

SELECT * FROM find_closest_ingredient('mezcla de verduras', 'es');
-- Returns: frozen mixed veggies (score: 1.0, exact match)
```

### `admin_ai_usage(timeframe)`

Get AI usage/cost breakdown for the admin dashboard. Requires admin role.

**Parameters:**
- `timeframe` (text): 'today', '7_days', '30_days', 'all_time'

**Returns:** JSONB containing:
- `summary`: text requests/tokens/cost, voice sessions/minutes/cost, total cost, unique users, latency, error rate
- `modelBreakdown`: per-model request/token/cost totals for text usage
- `dailyCost`: per-day cost and request totals (text + voice)
- `phaseBreakdown`: per-call-phase request counts, avg tokens, error rate

### `admin_ai_chat_session_depth(timeframe, filter_user_id)`

Get AI chat session depth metrics for the admin dashboard. Requires admin role.

**Parameters:**
- `timeframe` (text): 'today', '7_days', '30_days', 'all_time'
- `filter_user_id` (uuid, optional): Filter to a specific user

**Returns:** JSONB containing:
- `avgMessagesPerSession`, `avgUserMessagesPerSession`, `avgAssistantMessagesPerSession`, `avgSessionDurationMin`, `totalSessions`
- `messageDistribution`: bucketed session counts (2-4, 5-10, 11-20, 21+)
- `toolUsage`: sessions with search, generation, both, or chat-only
- `sessionsExceedingWindow`: sessions exceeding 50-message context window
- `topUsers`: top 10 users by session count
- `dailySessions`: per-day session counts

### `is_admin()`

Check if the current authenticated user has admin privileges.

**Returns:** boolean

### `upsert_cooking_session_progress(p_recipe_id, p_recipe_type, p_recipe_name, p_current_step, p_total_steps)`

Create or update an active `cooking_sessions` row for the authenticated user (`auth.uid()`), keyed by `(user_id, recipe_id, status='active')`.

**Parameters:**
- `p_recipe_id` (uuid): Recipe being cooked
- `p_recipe_type` (text): `'custom'` or `'database'`
- `p_recipe_name` (text): Display name for resume prompt
- `p_current_step` (integer): Current step index (1-based)
- `p_total_steps` (integer): Total step count

**Returns:** active session row `{id, recipe_id, recipe_type, recipe_name, current_step, total_steps, status, last_active_at}`

**Security/Behavior:**
- Requires authenticated user (`auth.uid()`), rejects unauthenticated calls
- Validates `p_recipe_type` and step bounds
- Handles concurrent insert races by retrying update on `unique_violation`

### `match_recipe_embeddings(query_embedding, match_threshold, match_count)`

Search recipe vectors via cosine similarity for hybrid search ranking.

**Parameters:**
- `query_embedding` (`vector(3072)`): Query embedding from `text-embedding-3-large`
- `match_threshold` (float, default `0.0`): Similarity floor, clamped to `[0, 1]`
- `match_count` (int, default `50`): Maximum rows, clamped to `[1, 50]`

**Returns:** `{recipe_id, similarity}`

**Security/Behavior:**
- `SECURITY DEFINER` with explicit search path (`public, extensions`)
- Execute is restricted to `service_role`
- Intended to be called from server-side edge functions only

### `get_cooked_recipes(p_language, p_query, p_after, p_before, p_limit)`

Retrieve the current user's cooked recipe history, optionally filtered by search query and date range. Returns recipes from both published catalog and user-generated recipes, sorted by relevance when searching or by most recent otherwise.

**Parameters:**
- `p_language` (text): Display language (`'en'` or `'es'`) — determines which recipe name column to use
- `p_query` (text, nullable): Optional search term for filtering by recipe name (uses `LIKE` + trigram similarity)
- `p_after` (timestamptz, nullable): Only include recipes cooked on or after this date
- `p_before` (timestamptz, nullable): Only include recipes cooked on or before this date
- `p_limit` (integer, default 5): Maximum results to return (clamped to 1–10)

**Returns:** `{recipe_id, recipe_table, name, image_url, total_time, difficulty, portions, last_cooked_at}`

**Security/Behavior:**
- `SECURITY INVOKER` — runs with caller's permissions (`auth.uid()`)
- No `p_user_id` parameter — always scopes to the authenticated user via `auth.uid()`
- Deduplicates by recipe: if cooked multiple times, returns only the most recent
- When `p_query` is provided, results are sorted by `match_score DESC`, then `cooked_at DESC`
- When `p_query` is null, results are sorted by `cooked_at DESC` only

### `admin_set_membership_tier(target_user_id, new_tier)`

Change a user's membership tier. Admin-only when called from the app; also callable from Dashboard SQL Editor (no auth context).

**Parameters:**
- `target_user_id` (uuid): The user whose tier to change
- `new_tier` (text): New tier value — must exist in `ai_membership_tiers` table (currently `'free'` or `'premium'`)

**Returns:** void

**Example:**
```sql
-- From Dashboard SQL Editor
SELECT admin_set_membership_tier('a1b2c3d4-...', 'premium');

-- From app (admin users only)
await supabase.rpc('admin_set_membership_tier', {
  target_user_id: userId,
  new_tier: 'premium',
});
```

**Security/Behavior:**
- `SECURITY DEFINER` — bypasses the `prevent_client_membership_tier_update` trigger
- When `auth.uid()` is set (app context), caller must have `is_admin = true` in `user_profiles`
- When `auth.uid()` is null (Dashboard SQL Editor), allows through — Dashboard access is already protected by project credentials
- Validates tier against `ai_membership_tiers` table
- Granted to `authenticated` role (admin check is inside the function)

---

### `regenerate_plan_shopping_list_items(p_plan_id, p_list_id, p_items)`

Atomically replace all plan-sourced rows on a shopping list while preserving manually-added rows. Used by the meal-planner edge function's `generate_shopping_list` action; the consolidator builds the row list, this RPC commits it.

**Parameters:**
- `p_plan_id` (uuid): The meal plan being synced.
- `p_list_id` (uuid): The shopping list to write into.
- `p_items` (jsonb): Array of consolidated items. Each entry: `{ ingredient_id, name_custom, category_id, quantity, unit_id, display_order, source_meal_plan_slot_id, source_meal_plan_slot_component_id }`.

**Returns:** void

**Behavior:**
- DELETE phase: removes only rows where `source_meal_plan_slot_id IS NOT NULL`. Manual additions (null source) are preserved.
- INSERT phase: bulk-inserts the new rows from `jsonb_to_recordset`. Each row carries its source slot/component IDs so future regenerations know what's plan-sourced.
- Sync state: flips `meal_plans.shopping_sync_state` and `meal_plan_slots.shopping_sync_state` to `'current'`.
- Atomicity: PL/pgSQL function default — if INSERT fails, DELETE rolls back. The list cannot end up half-empty.

**Security:** `SECURITY INVOKER`. RLS still applies; caller must own the plan.

**Example (called from edge function):**
```typescript
const { error } = await supabase.rpc('regenerate_plan_shopping_list_items', {
  p_plan_id: mealPlanId,
  p_list_id: shoppingListId,
  p_items: rows, // see consolidation in generate-shopping-list.ts
});
```

**Migration:** `20260427000001_atomic_regenerate_shopping_list.sql`

---

## Adding New Functions

1. Create migration: `npm run migration:new add_function_name`
2. Use `SECURITY DEFINER` with explicit `SET search_path = public`
3. Add `COMMENT ON FUNCTION` for documentation
4. Update this file with the new function
5. Push: `npm run db:push`
