# Database Functions Reference

Custom PostgreSQL functions available via Supabase RPC.

## Quick Reference

| Function | Purpose | Used By |
|----------|---------|---------|
| `is_admin()` | Check if current user has admin role | RLS policies |
| `admin_analytics(action, timeframe, limit)` | Get admin dashboard metrics | Admin dashboard |
| `admin_ai_usage(timeframe)` | Get AI usage and cost metrics (text + voice) | Admin AI tab |
| `find_closest_ingredient(name, lang)` | Find ingredient by fuzzy name match | Custom recipe generation |
| `update_ai_voice_usage()` | Track AI voice minutes | Voice endpoints |
| `upsert_cooking_session_progress(recipe_id, recipe_type, recipe_name, current_step, total_steps)` | Upsert active cooking progress per user+recipe | Cooking guide progress + resume prompt |
| `match_recipe_embeddings(query_embedding, match_threshold, match_count)` | Vector similarity search for published recipes | Hybrid recipe search tool |

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

### `admin_analytics(action, timeframe, limit_count)`

Get aggregated analytics for the admin dashboard. Requires admin role.

**Parameters:**
- `action` (text): 'overview', 'funnel', 'top_viewed_recipes', 'top_cooked_recipes', 'top_searches', 'ai', 'patterns', 'retention', 'recipe_generation'
- `timeframe` (text): 'today', '7_days', '30_days', 'all_time'
- `limit_count` (int): Max items to return

**Returns:** JSONB with metrics

Notes:
- `ai` action is timeframe-aware and returns adoption/session metrics.
- `recipe_generation` action returns `totalGenerated`, `totalFailed`, `successRate`, `avgDurationMs`.

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

---

## Adding New Functions

1. Create migration: `npm run migration:new add_function_name`
2. Use `SECURITY DEFINER` with explicit `SET search_path = public`
3. Add `COMMENT ON FUNCTION` for documentation
4. Update this file with the new function
5. Push: `npm run db:push`
