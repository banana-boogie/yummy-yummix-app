# Database Functions Reference

Custom PostgreSQL functions available via Supabase RPC.

## Quick Reference

| Function | Purpose | Used By |
|----------|---------|---------|
| `is_admin()` | Check if current user has admin role | RLS policies |
| `admin_analytics(action, timeframe, limit)` | Get admin dashboard metrics | Admin dashboard |
| `find_closest_ingredient(name, lang)` | Find ingredient by fuzzy name match | Custom recipe generation |
| `update_ai_voice_usage()` | Track AI voice minutes | Voice endpoints |

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

---

## Adding New Functions

1. Create migration: `npm run migration:new add_function_name`
2. Use `SECURITY DEFINER` with explicit `SET search_path = public`
3. Add `COMMENT ON FUNCTION` for documentation
4. Update this file with the new function
5. Push: `npm run db:push`
