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
| `get_cooked_recipes(p_language, p_query, p_after, p_before, p_limit)` | Retrieve user's cooked recipe history with optional search and date range | Cooked recipes tool |
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

---

## Adding New Functions

1. Create migration: `npm run migration:new add_function_name`
2. Use `SECURITY DEFINER` with explicit `SET search_path = public`
3. Add `COMMENT ON FUNCTION` for documentation
4. Update this file with the new function
5. Push: `npm run db:push`
