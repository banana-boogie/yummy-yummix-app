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
- `find_closest_ingredient(name text, lang text)` — Fuzzy ingredient search with language preference
- `batch_find_ingredients(names text[], lang text)` — Bulk ingredient lookup
- `match_recipe_embeddings(query_embedding vector, match_threshold float, match_count int)` — Vector similarity search
- `admin_analytics(action text, timeframe text, limit_count int)` — Admin dashboard metrics
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
