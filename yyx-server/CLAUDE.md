# YummyYummix Server (Supabase Edge Functions)

This directory contains the backend for YummyYummix, built on Supabase Cloud with Edge Functions written in Deno/TypeScript.

## Cloud Development Workflow

### First-Time Setup

```bash
npm run link          # Link to cloud project (follow prompts)
```

### Daily Development

**Deploy functions:**
```bash
npm run deploy irmixy-chat-orchestrator  # Single function
npm run deploy:all                       # All functions
```

**Push migrations:**
```bash
npm run backup        # ALWAYS backup first!
npm run db:push       # Push to cloud
```

**View logs:**
Use Supabase Dashboard: `Edge Functions -> irmixy-chat-orchestrator -> Logs`.

### Backup Before Deploy (REQUIRED)

**Always backup before deploying migrations:**
```bash
npm run backup:all    # Database + Storage
```

Supabase Free tier has NO automated backups. You must manage your own.

---

## Edge Functions

Located in `supabase/functions/`:

- **irmixy-chat-orchestrator/** - Main AI routing and conversation management (modularized: types, logger, session, meal-context, suggestions, modification, system-prompt, ai-calls, history, response-builder)
- **irmixy-voice-orchestrator/** - OpenAI Realtime session bootstrap + quota checks + secure voice tool execution
- **get-nutritional-facts/** - AI-powered nutrition data lookup (per 100g macros)
- **semantic-recipe-search/** - Lightweight semantic (vector) search endpoint for Explore tab fallback
- **admin-ai-recipe-import/** - Admin AI-powered recipe import from markdown
- **meal-planner/** - Meal planning action router (get/generate/swap/skip plans, preferences). Modules: `scoring-config.ts` (SCORING_CONFIG_V1 weights), `slot-classifier.ts` (canonical meal-type + busy-day/weekend/leftover-target classification), `candidate-retrieval.ts` (SQL prefilter), `scoring/` (7 pure factor functions), `bundle-builder.ts` (explicit-pairing component bundles), `week-assembler.ts` (beam search width 5, leftover source/target resolution, first-week trust mode), `plan-generator.ts` (orchestration + two-phase component persistence with rollback), `selection-reason-templates.ts` (locale-keyed en/es templates). Scoring reference: `../docs/MEAL-PLANNER-SCORING.md`.
- **_shared/** - Shared utilities (CORS, auth, AI gateway)

### Deploying Functions

```bash
npm run deploy irmixy-chat-orchestrator    # Deploy single function
npm run deploy:all                # Deploy all functions
```

### Viewing Logs

Use Supabase Dashboard: `Edge Functions -> irmixy-chat-orchestrator -> Logs`.

---

## Database Migrations

Located in `supabase/migrations/`.

### CRITICAL: Never Use MCP for Migrations

**NEVER use the Supabase MCP `apply_migration` tool to apply database migrations.**

The MCP tool bypasses the local migration file workflow and causes the local `supabase/migrations/` folder to diverge from the remote migration history. This breaks `supabase db push` and makes the migration history unmaintainable.

**Always use the CLI workflow:**
1. Create migration file locally with `npm run migration:new`
2. Edit the SQL file in `supabase/migrations/`
3. Push with `npm run db:push`

The MCP Supabase tools are safe for:
- Reading data (`execute_sql` for SELECT queries)
- Checking migration history (`list_migrations`)
- Viewing tables (`list_tables`)
- Getting project info

**Never use MCP for:**
- `apply_migration` - Creates history divergence
- Any DDL changes (CREATE, ALTER, DROP) outside the migration workflow

### Creating Migrations

```bash
npm run backup                    # ALWAYS backup first!
npm run migration:new add_feature # Create new migration
# Edit the SQL file in supabase/migrations/
npm run db:push                   # Push to cloud
```

### If Migration History Diverges

If local and remote migration histories get out of sync:

```bash
# 1. Backup local migrations (in case you need the SQL)
cp -r supabase/migrations ~/migrations_backup

# 2. Clear local migrations
rm -rf supabase/migrations/*

# 3. Pull current remote state as new baseline
supabase db pull

# 4. Now create new migrations from this synced state
npm run migration:new my_new_feature
```

### Migration Rollback

If a migration breaks the database:

1. **Create rollback migration:**
   ```bash
   npm run migration:new rollback_bad_feature
   # Edit migration to undo changes
   ```

2. **Push rollback:**
   ```bash
   npm run db:push
   ```

---

## Data Pipeline

Located in `data-pipeline/`. CLI tools for recipe import, translation, nutrition fetching, image upload, and data auditing.

Run tools with `npm run pipeline:<tool>` or `deno task pipeline:<tool>`:
```bash
deno task pipeline:import --local          # Import recipes from Notion export
deno task pipeline:nutrition --local       # Fetch missing nutritional data
deno task pipeline:upload-images --local --dir /path/to/images
deno task pipeline:audit --local           # Audit data quality
deno task pipeline:translate --local       # Translate content
deno task pipeline:apply-recipe-metadata --local --recipe <slug> --dry-run  # Apply YAML-driven recipe edits (Plan 12)
deno task pipeline:apply-recipe-metadata --list-missing                     # Recipes that still need a YAML
deno task pipeline:apply-recipe-metadata --list-authoring                   # Committed YAMLs flagged requires_authoring
```

The `apply-recipe-metadata` pipeline is Plan 12's declarative recipe-curation
workflow. Despite the "metadata" name, it edits ingredients, steps, kitchen
tools, pairings, tags, descriptions, and planner config — basically anything
the rubric ([docs/agent-guidelines/RECIPE-REVIEW.md](../docs/agent-guidelines/RECIPE-REVIEW.md))
covers. Pairs with the `/review-recipe` skill (Claude and Codex), which writes
the YAML at `--effort high` and re-decides `planner_role` from scratch every
time. The dry-run shows a recipe snapshot, a grouped diff, per-layer row counts
for `cleanup.delete_locales`, and any `requires_authoring` notes. See
`data-pipeline/data/recipe-metadata/README.md` for the workflow diagram.

All tools require `--local` or `--production` to select the target environment.

See `docs/operations/PIPELINE.md` for full documentation.

---

## Environment Variables

### Required in `.env.local`:

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Get from dashboard

GEMINI_API_KEY=AIza...        # For text, recipe_generation, recipe_modification
OPENAI_API_KEY=sk-proj-...   # For parsing, embedding
USDA_API_KEY=...
```

### Cloud Secrets

API keys should also be set as cloud secrets for deployed functions:
- GEMINI_API_KEY
- OPENAI_API_KEY
- USDA_API_KEY

---

## Testing

```bash
npm test              # Run unit tests
npm run test:watch    # Watch mode
npm run test:integration  # Integration tests
```

---

## Database Functions

Custom PostgreSQL functions for RPC calls are documented in `docs/DATABASE_FUNCTIONS.md`.

**Quick reference:**
- `find_closest_ingredient(name, lang)` — Fuzzy ingredient search with language preference
- Admin RPCs: `admin_overview`, `admin_retention`, `admin_funnel`, `admin_top_viewed_recipes`, `admin_top_cooked_recipes`, `admin_top_searches`, `admin_ai_adoption`, `admin_ai_usage`, `admin_ai_chat_session_depth`, `admin_recipe_generation`, `admin_daily_signups`, `admin_daily_active_users`, `admin_daily_ai_users`, `admin_content_source_split`, `admin_content_health`
- `is_admin()` — Check current user's admin status
- `get_cooked_recipes(language, query, after, before, limit)` — Current user's cooked recipe history with optional search and date range
- `upsert_cooking_session_progress(...)` — Upsert active cooking progress
- `match_recipe_embeddings(...)` — Vector similarity search for recipes
- `update_ai_voice_usage()` — Track AI voice minutes
- `admin_set_membership_tier(target_user_id, new_tier)` — Change user membership (free/premium). Admin-only from app; also works from Dashboard SQL Editor

See `docs/DATABASE_FUNCTIONS.md` for full details on all functions.

To list all available functions:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
```

---

See the main [CLAUDE.md](../CLAUDE.md) for:
- Project overview
- AI architecture and gateway
- General conventions
