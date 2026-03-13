# Database Guidelines

Domain playbook for the YummyYummix database — PostgreSQL on Supabase with RLS, pgvector, and RPC functions.

---

## Migration Workflow (CRITICAL)

**Always follow this exact workflow. No exceptions.**

```bash
# 1. ALWAYS backup first
cd yyx-server
npm run backup              # Database only
# or: npm run backup:all    # Database + Storage

# 2. Create migration file
npm run migration:new <name_in_snake_case>
# Creates: supabase/migrations/YYYYMMDDHHMMSS_<name>.sql

# 3. Edit the SQL file
# Write your DDL (CREATE TABLE, ALTER TABLE, etc.)

# 4. Push to cloud
npm run db:push
```

### NEVER DO

- **NEVER** use MCP `apply_migration` tool — it causes local/remote history divergence
- **NEVER** run DDL directly via MCP `execute_sql` — always use migration files
- **NEVER** push without backing up first
- **NEVER** create migrations that are hard to reverse

### Safe MCP Operations
- `execute_sql` for SELECT queries (reading data)
- `list_migrations` (checking history)
- `list_tables` (viewing schema)
- `get_project` (project info)

---

## Migration File Template

```sql
-- Migration: <description>
-- Author: <name>
-- Date: <date>

-- ============================================================
-- <Section description>
-- ============================================================

CREATE TABLE IF NOT EXISTS public.<table_name> (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- columns...
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS (REQUIRED for every table)
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own data"
  ON public.<table_name>
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
  ON public.<table_name>
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data"
  ON public.<table_name>
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_<table>_user_id ON public.<table_name>(user_id);
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Tables | snake_case, plural | `user_recipes`, `food_safety_rules` |
| User-owned tables | `user_` prefix | `user_profiles`, `user_recipes` |
| Columns | snake_case | `created_at`, `user_id`, `total_time` |
| Primary keys | `id` (uuid) | `id uuid DEFAULT gen_random_uuid()` |
| Foreign keys | `<referenced_table_singular>_id` | `recipe_id`, `user_id` |
| Constraints | `<table>_<column>_<type>` | `user_profiles_skill_level_check` |
| Indexes | `idx_<table>_<columns>` | `idx_recipes_created_at` |
| Functions | snake_case, verb_noun | `find_closest_ingredient`, `batch_find_ingredients` |
| Migration files | `TIMESTAMP_verb_noun.sql` | `20260206_create_food_safety_rules.sql` |

---

## Current Schema (key tables)

### Core Recipe Tables
- `recipes` — Published recipes (title, description, total_time, difficulty, portions, etc.)
- `recipe_ingredients` — Recipe ingredients with quantities and units
- `recipe_to_tag` — Recipe-tag associations
- `recipe_embeddings` — Vector embeddings for semantic search (3072-dim, text-embedding-3-large)

### User Recipe Tables
- `user_recipes` — AI-generated custom recipes
- `user_recipe_ingredients` — Custom recipe ingredients
- `user_recipe_steps` — Custom recipe steps (with Thermomix parameters)
- `user_recipe_tags` — Custom recipe tags
- `user_recipe_useful_items` — Suggested kitchen items

### User Tables
- `user_profiles` — Preferences, equipment, dietary restrictions, skill level
- `food_allergies` — User allergy records
- `diet_types` — User diet type records
- `cuisine_preferences` — User cuisine preferences

### Chat/Voice Tables
- `user_chat_sessions` — Chat sessions
- `conversation_messages` — Chat message history with metadata
- `ai_voice_sessions` — Voice session records
- `ai_voice_usage` — Voice quota tracking (30 min/month)

### Reference Tables
- `allergen_groups` — Allergen category mapping
- `food_safety_rules` — USDA cooking temperatures (read-only)
- `ingredient_aliases` — Ingredient synonym mapping

### i18n Tables
- `locales` — Supported locales with `parent_code` for fallback chain
- `recipe_translations` — Translatable recipe fields (`name`, `tips_and_tricks`)
- `recipe_step_translations` — Translatable step fields (`instruction`, `recipe_section`, `tip`)
- `ingredient_translations` — Translatable ingredient names (`name`, `plural_name`)
- `recipe_ingredient_translations` — Translatable ingredient-in-recipe fields (`notes`, `recipe_section`, `tip`)
- `measurement_unit_translations` — Translatable unit labels (`name`, `name_plural`, `symbol`, `symbol_plural`)
- `recipe_tag_translations` — Translatable tag names
- `useful_item_translations` — Translatable useful item names
- `recipe_useful_item_translations` — Translatable useful-item-in-recipe notes

### Analytics
- `user_events` — User event tracking

---

## RLS Policies (REQUIRED)

**Every new table MUST have Row Level Security enabled.** Missing RLS is a Critical-severity finding.

### Common Patterns

**User-owned data:**
```sql
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data"
  ON public.my_table FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
  ON public.my_table FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data"
  ON public.my_table FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own data"
  ON public.my_table FOR DELETE
  USING (auth.uid() = user_id);
```

**Public read, owner write:**
```sql
CREATE POLICY "Anyone can read"
  ON public.my_table FOR SELECT
  USING (true);

CREATE POLICY "Owners can modify"
  ON public.my_table FOR ALL
  USING (auth.uid() = user_id);
```

**Admin only:**
```sql
CREATE POLICY "Admins only"
  ON public.my_table FOR ALL
  USING (public.is_admin());
```

**Service role only (e.g., embeddings):**
```sql
-- No policies + RLS enabled = only service role can access
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;
```

---

## PostgreSQL Functions (RPC)

### Existing Functions
- `resolve_locale(requested text)` — Walk the locale fallback chain; returns `text[]` ordered most-specific to least (e.g., `es-MX` → `['es-MX', 'es', 'en']`). Strips unknown region suffixes and uses `['es']` as the ultimate fallback for unknown locales (Mexico-first audience). See Translation Tables section for full behaviour.
- `batch_find_ingredients(names text[], preferred_locale text)` — Bulk ingredient lookup via translation tables
- `get_cooked_recipes(p_locale text, ...)` — User's cooked recipes with locale-based name resolution
- `match_recipe_embeddings(query_embedding vector, match_threshold float, match_count int)` — Vector similarity search
- `admin_analytics(action text, timeframe text, "limit" int)` — Admin dashboard metrics
- `is_admin()` — Check current user's admin status

### Function Template

```sql
CREATE OR REPLACE FUNCTION public.my_function(
  param1 text,
  param2 integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  score float
)
LANGUAGE plpgsql
SECURITY DEFINER  -- or INVOKER depending on needs
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.score
  FROM public.my_table t
  WHERE t.name ILIKE '%' || param1 || '%'
  ORDER BY t.score DESC
  LIMIT param2;
END;
$$;
```

- Use `SECURITY DEFINER` when the function needs to bypass RLS (e.g., admin functions)
- Use `SECURITY INVOKER` when RLS should apply to the caller
- Always set `search_path = public` for security

---

## Translation Tables (i18n)

All translatable content uses **per-entity translation tables**. No translatable text on entity tables.

### Architecture

```
locales (code PK, parent_code FK, display_name, is_active)
  ├── en (parent: NULL)         ← base English (US English content)
  ├── es (parent: en)           ← base Spanish (Mexican Spanish content)
  ├── es-MX (parent: es)        ← regional override (only if needed)
  └── es-ES (parent: es)        ← regional override (only if needed)

recipes ←→ recipe_translations (recipe_id, locale) PK
           └── name, tips_and_tricks
```

### `locales` Table

```sql
CREATE TABLE public.locales (
  code        text PRIMARY KEY,          -- e.g. 'en', 'es', 'es-MX'
  parent_code text REFERENCES locales(code),  -- fallback parent; NULL for root
  display_name text NOT NULL,
  is_active   boolean DEFAULT true,
  CHECK (code != parent_code)
);
```

Seed data:

| code | parent_code | display_name |
|------|-------------|--------------|
| `en` | NULL | English |
| `es` | `en` | Español |
| `es-MX` | `es` | Español (México) |
| `es-ES` | `es` | Español (España) |

RLS: public read (`USING (true)`), admin write.

### `resolve_locale()` RPC

```sql
SELECT public.resolve_locale('es-MX');
-- Returns: ARRAY['es-MX', 'es', 'en']

SELECT public.resolve_locale('en');
-- Returns: ARRAY['en']
```

The function walks the `parent_code` chain recursively (up to depth 5) and returns an ordered array from most-specific to least-specific. Callers then `COALESCE` or use `ANY()` to pick the best available translation. Ultimate fallback is `['es']` for completely unknown locales (Mexico-first audience).

Fallback behaviour:
- `es-MX` → `['es-MX', 'es', 'en']` (walks parent_code chain — `es.parent_code = 'en'` in seed data)
- `en` → `['en']` (en has no parent_code)
- Unknown region (`en-CA`) → strips region suffix, recurses on `en` → `['en']`
- Completely unknown code → `['es']` (ultimate fallback)

**Important — no cross-language fallback at the application layer:** The RPC returns `en` in the chain for Spanish locales because of the seed data structure, but application code (Edge Functions) uses `buildLocaleChain()` from `_shared/locale-utils.ts` which stops at the language boundary. `es` and `en` are separate user groups; a Spanish-language user must never receive English content as a fallback. Only use `resolve_locale()` directly in SQL where you are already filtering to a single language, or slice the result to exclude cross-language entries.

### 8 Translation Tables

| Translation Table | Parent Table | Translated Fields | RLS Read Pattern |
|---|---|---|---|
| `recipe_translations` | `recipes` | `name`, `tips_and_tricks` | parent `is_published` |
| `recipe_step_translations` | `recipe_steps` | `instruction`, `recipe_section`, `tip` | grandparent `is_published` (via `recipe_steps`) |
| `ingredient_translations` | `ingredients` | `name`, `plural_name` | `USING (true)` — reference data |
| `recipe_ingredient_translations` | `recipe_ingredients` | `notes`, `recipe_section`, `tip` | grandparent `is_published` (via `recipe_ingredients`) |
| `measurement_unit_translations` | `measurement_units` | `name`, `name_plural`, `symbol`, `symbol_plural` | `USING (true)` — reference data |
| `recipe_tag_translations` | `recipe_tags` | `name` | `USING (true)` — reference data |
| `useful_item_translations` | `useful_items` | `name` | `USING (true)` — reference data |
| `recipe_useful_item_translations` | `recipe_useful_items` | `notes` | grandparent `is_published` (via `recipe_useful_items`) |

All use composite PK `(entity_id, locale)` with `ON DELETE CASCADE` from parent. Note: `measurement_unit_translations.measurement_unit_id` is `text` (not `uuid`) because `measurement_units.id` is `text`.

### Locale Design Rules

- **Base codes (`en`, `es`) store all content.** These serve all speakers of that language.
- **Regional codes (`es-MX`, `es-ES`) are override-only.** Only create regional translation rows when content genuinely differs from the base.
- **Never store base content under a regional code** — it breaks fallback for other regions.
- **No cross-language fallback.** `en` and `es` are separate user groups. A Spanish speaker should never see English content as a fallback, and vice versa.
- **Within-family fallback only:** `es-MX` → `es` (via `buildLocaleChain()` in server-side TypeScript). The DB `resolve_locale()` RPC walks `parent_code` and returns `['es-MX', 'es', 'en']` because `es.parent_code = 'en'` in the locales seed; application code stops at the language boundary using `buildLocaleChain()`.
- **Ultimate fallback for unknown locales** in `resolve_locale()` is `['es']` (Mexico-first audience).

### RLS Patterns for Translation Tables

There are two distinct patterns depending on whether the translation table is for **reference data** or **recipe-scoped content**.

#### Pattern 1 — Reference data (`USING (true)`)

Use this for standalone reference tables (ingredients, measurement units, tags, useful items). Their translations are always public regardless of any recipe's publish status.

```sql
ALTER TABLE public.ingredient_translations ENABLE ROW LEVEL SECURITY;

-- Public read: reference data is always visible
CREATE POLICY "Anyone can read ingredient translations"
  ON public.ingredient_translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write ingredient translations"
  ON public.ingredient_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
```

Same pattern applies to: `measurement_unit_translations`, `recipe_tag_translations`, `useful_item_translations`.

#### Pattern 2 — Recipe-scoped content (gate on parent `is_published`)

Use this for translation tables whose rows belong to a specific recipe. Unpublished draft content must not leak to public users. These tables join through one intermediate table to reach `recipes.is_published`.

**`recipe_translations`** (direct FK to `recipes`):

```sql
ALTER TABLE public.recipe_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published recipe translations"
  ON public.recipe_translations FOR SELECT TO anon, authenticated
  USING (recipe_id IN (SELECT id FROM public.recipes WHERE is_published = true));

CREATE POLICY "Admins can read all recipe translations"
  ON public.recipe_translations FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin write recipe translations"
  ON public.recipe_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
```

**`recipe_step_translations`** (FK chain: `recipe_step_id` → `recipe_steps.recipe_id` → `recipes.is_published`):

```sql
ALTER TABLE public.recipe_step_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published recipe step translations"
  ON public.recipe_step_translations FOR SELECT TO anon, authenticated
  USING (
    recipe_step_id IN (
      SELECT rs.id FROM public.recipe_steps rs
      JOIN public.recipes r ON r.id = rs.recipe_id
      WHERE r.is_published = true
    )
  );

CREATE POLICY "Admins can read all recipe step translations"
  ON public.recipe_step_translations FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin write recipe step translations"
  ON public.recipe_step_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
```

**`recipe_ingredient_translations`** (FK chain: `recipe_ingredient_id` → `recipe_ingredients.recipe_id` → `recipes.is_published`):

```sql
CREATE POLICY "Anyone can read published recipe ingredient translations"
  ON public.recipe_ingredient_translations FOR SELECT TO anon, authenticated
  USING (
    recipe_ingredient_id IN (
      SELECT ri.id FROM public.recipe_ingredients ri
      JOIN public.recipes r ON r.id = ri.recipe_id
      WHERE r.is_published = true
    )
  );

CREATE POLICY "Admins can read all recipe ingredient translations"
  ON public.recipe_ingredient_translations FOR SELECT TO authenticated
  USING (public.is_admin());
```

**`recipe_useful_item_translations`** (FK chain: `recipe_useful_item_id` → `recipe_useful_items.recipe_id` → `recipes.is_published`):

```sql
CREATE POLICY "Anyone can read published recipe useful item translations"
  ON public.recipe_useful_item_translations FOR SELECT TO anon, authenticated
  USING (
    recipe_useful_item_id IN (
      SELECT rui.id FROM public.recipe_useful_items rui
      JOIN public.recipes r ON r.id = rui.recipe_id
      WHERE r.is_published = true
    )
  );

CREATE POLICY "Admins can read all recipe useful item translations"
  ON public.recipe_useful_item_translations FOR SELECT TO authenticated
  USING (public.is_admin());
```

**Why the two-policy admin pattern matters:** Supabase evaluates `SELECT` policies with `OR` logic — if any policy matches the request is allowed. Admins need a separate `SELECT` policy (not just the write policy) to read unpublished rows, because the public-read policy would otherwise block them on drafts.

### Adding a New Translatable Entity

Determine which pattern applies first:
- **Reference data** (standalone lookup table, no publish gate) → use Pattern 1
- **Recipe-scoped content** (belongs to a recipe, should respect `is_published`) → use Pattern 2

```sql
-- 1. Create translation table
CREATE TABLE public.<entity>_translations (
  <entity>_id uuid REFERENCES public.<entity>(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  <field1> text NOT NULL,
  <field2> text,
  PRIMARY KEY (<entity>_id, locale)
);

-- 2. Enable RLS
ALTER TABLE public.<entity>_translations ENABLE ROW LEVEL SECURITY;

-- 3a. Pattern 1 (reference data)
CREATE POLICY "Anyone can read <entity> translations"
  ON public.<entity>_translations FOR SELECT TO anon, authenticated
  USING (true);

-- 3b. Pattern 2 (recipe-scoped) — adjust the JOIN path to reach recipes.is_published
CREATE POLICY "Anyone can read published <entity> translations"
  ON public.<entity>_translations FOR SELECT TO anon, authenticated
  USING (
    <entity>_id IN (
      SELECT e.id FROM public.<entity> e
      JOIN public.recipes r ON r.id = e.recipe_id
      WHERE r.is_published = true
    )
  );

CREATE POLICY "Admins can read all <entity> translations"
  ON public.<entity>_translations FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4. Admin write (both patterns)
CREATE POLICY "Admin write <entity> translations"
  ON public.<entity>_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
```

### Adding a New Language

1. Insert into `locales`: `INSERT INTO locales (code, parent_code, display_name, is_active) VALUES ('pt', 'en', 'Português', true);`
2. Add translation rows for the new locale in each translation table
3. Add UI string translations in `i18n/locales/`

---

## Extensions

| Extension | Purpose | Usage |
|-----------|---------|-------|
| `pgvector` | Vector similarity search | `recipe_embeddings` table, `match_recipe_embeddings()` function |
| `pg_trgm` | Trigram fuzzy matching | `find_closest_ingredient()` function |

---

## Index Strategy

| Type | Use Case | Example |
|------|----------|---------|
| B-tree (default) | Exact match, range queries, sorting | `CREATE INDEX idx_recipes_created_at ON recipes(created_at)` |
| GIN | Full-text search, array containment | `CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags)` |
| HNSW (pgvector) | Vector similarity | `CREATE INDEX ON recipe_embeddings USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)` |
| B-tree (FK) | Foreign key joins | `CREATE INDEX idx_messages_session_id ON conversation_messages(session_id)` |

**Rules:**
- Always add indexes on foreign key columns
- Add indexes on columns used in WHERE clauses or JOIN conditions
- Don't over-index — each index slows writes
- Use `CONCURRENTLY` for adding indexes to tables with production data (but not inside migrations — Supabase doesn't support it in `db push`)

---

## Performance Patterns

- **Pagination:** Always use `.range()` or `LIMIT/OFFSET` — never unbounded `SELECT *`
- **N+1 prevention:** Use JOINs or batch queries instead of loops
- **Batch operations:** Use `batch_find_ingredients()` pattern for bulk lookups
- **Connection pooling:** Supabase handles this — use the provided client
- **Selective columns:** Use `SELECT col1, col2` instead of `SELECT *` when possible

---

## Rollback Strategy

If a migration breaks production:

1. **Create rollback migration:** `npm run migration:new rollback_<name>`
2. **Write reverse DDL:** DROP TABLE, DROP COLUMN, etc.
3. **Push:** `npm run db:push`

**Prevention:**
- Always backup before pushing
- Keep migrations small and reversible
- Test complex migrations on a branch first (Supabase branching)

---

## If Migration History Diverges

```bash
# 1. Backup local migrations
cp -r supabase/migrations ~/migrations_backup

# 2. Clear local migrations
rm -rf supabase/migrations/*

# 3. Pull current remote state as new baseline
supabase db pull

# 4. Create new migrations from synced state
npm run migration:new my_new_feature
```
