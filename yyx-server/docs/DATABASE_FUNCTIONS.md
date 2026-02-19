# Database Functions Reference

Custom PostgreSQL functions available via Supabase RPC.

## Quick Reference

| Function | Purpose | Used By |
|----------|---------|---------|
| `is_admin()` | Check if current user has admin role | RLS policies |
| `admin_analytics(action, timeframe, limit)` | Get admin dashboard metrics | Admin dashboard |
| `find_closest_ingredient(name, lang)` | Find ingredient by fuzzy name match | Custom recipe generation |
| `update_ai_voice_usage()` | Track AI voice minutes | Voice endpoints |
| `upsert_cooking_session_progress(recipe_id, recipe_type, recipe_name, current_step, total_steps)` | Upsert active cooking progress per user+recipe | Cooking guide progress + resume prompt |
| `check_and_increment_ai_generation_usage(p_user_id, p_limit)` | Atomic check-and-increment for monthly recipe generation budget | Chat/voice orchestrators |
| `get_cooked_recipes(p_user_id, p_query_text, p_limit)` | Retrieve user's cooked recipe history with optional search | Cooked recipes tool |
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
- `action` (text): 'overview', 'top_recipes', 'recent_signups', etc.
- `timeframe` (text): 'today', '7_days', '30_days', 'all_time'
- `limit_count` (int): Max items to return

**Returns:** JSONB with metrics

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

### `check_and_increment_ai_generation_usage(p_user_id, p_limit)`

Atomically checks whether a user is within their monthly recipe generation budget and increments the counter in one step. Prevents TOCTOU race conditions where two concurrent requests could both pass a separate check.

**Parameters:**
- `p_user_id` (uuid): The user to check/increment
- `p_limit` (integer, default 120): Monthly generation cap

**Returns:** `{allowed, used, was_80_warning_sent, was_90_warning_sent}`
- `allowed` (boolean): Whether the user is within budget (counter was incremented)
- `used` (integer): Current count after increment (or current count if blocked)
- `was_80_warning_sent` (boolean): Whether the 80% warning has been sent previously
- `was_90_warning_sent` (boolean): Whether the 90% warning has been sent previously

**Security/Behavior:**
- `SECURITY DEFINER` with explicit `SET search_path = public`
- Execute restricted to `service_role` only
- Uses `FOR UPDATE` row lock to prevent concurrent increments
- Creates the usage row if it doesn't exist (upsert on first call of the month)

### `get_cooked_recipes(p_user_id, p_query_text, p_limit)`

Retrieve a user's cooked recipe history, optionally filtered by a search query. Returns recipes the user has marked as cooked, sorted by relevance when searching or by most recent otherwise.

**Parameters:**
- `p_user_id` (uuid): The user whose history to fetch
- `p_query_text` (text, nullable): Optional search term for filtering by recipe name
- `p_limit` (integer, default 10): Maximum results to return

**Returns:** `{recipe_id, name, image_url, cooked_at, match_score}`

**Security/Behavior:**
- `SECURITY INVOKER` — runs with caller's permissions
- Execute granted to `authenticated` role
- When `p_query_text` is provided, results are sorted by `match_score DESC` (relevance first), then by `cooked_at DESC`
- When `p_query_text` is null, results are sorted by `cooked_at DESC` only

---

## Adding New Functions

1. Create migration: `npm run migration:new add_function_name`
2. Use `SECURITY DEFINER` with explicit `SET search_path = public`
3. Add `COMMENT ON FUNCTION` for documentation
4. Update this file with the new function
5. Push: `npm run db:push`
