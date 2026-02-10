# The Data Kitchen

Where raw database entries get cooked into production-ready content.

---

## What This Is

YummyYummix is a cooking app with recipes, ingredients, step-by-step cooking guides, and AI-powered features — all in English and Mexican Spanish. Before launch, the database needs to be fully populated: every ingredient needs nutritional facts, every entity needs translations in both languages, and every recipe/ingredient/item needs an image.

Doing this manually for hundreds of entities would take days. The Data Kitchen is a set of **automated CLI tools** that handle the tedious parts — fetching nutrition data from the USDA, translating missing content with AI, and generating images with DALL-E. Raw rows go in, fully-baked recipes come out. This feature also includes **analytics** to understand user behavior post-launch, **backup scripts** for disaster recovery, and **database hardening** for security and performance.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Tools (Deno)                      │
│                                                         │
│   audit-data ──► Reports what's missing                 │
│   fetch-nutrition ──► USDA API + OpenAI fallback        │
│   translate-content ──► GPT-4o-mini translations        │
│   generate-images ──► DALL-E 3 + Supabase Storage       │
│                                                         │
│   All tools: --local / --production / --dry-run         │
├─────────────────────────────────────────────────────────┤
│                  Shared Libraries                        │
│   db.ts · config.ts · logger.ts · utils.ts              │
│   entity-matcher.ts · budget.ts · recipe-parser.ts      │
├─────────────────────────────────────────────────────────┤
│                    Supabase                              │
│   PostgreSQL · Storage · Edge Functions · RLS Policies   │
├─────────────────────────────────────────────────────────┤
│                   Backup Scripts                         │
│   backup-db.sh · backup-storage.sh · backup-all.sh      │
├─────────────────────────────────────────────────────────┤
│                   Analytics                              │
│   admin_analytics() RPC · analyticsService.ts           │
└─────────────────────────────────────────────────────────┘
```

---

## The Data Pipeline

### The Problem

A recipe app is only as good as its content. For each of our ~200+ ingredients, we need:
- A name in English AND Spanish
- Nutritional facts (calories, protein, fat, carbs per 100g)
- A product photo

For each recipe, we need names in both languages, a plated photo, and all steps translated. Useful items (whisk, cutting board, etc.) need the same treatment. That's potentially thousands of individual data points.

### The Solution: Four CLI Tools

All tools live in `yyx-server/data-pipeline/cli/` and share common flags:

| Flag | Purpose |
|------|---------|
| `--local` | Target local Supabase (development) |
| `--production` | Target cloud Supabase (live database) |
| `--limit N` | Process at most N items |
| `--dry-run` | Preview what would happen without making changes |

#### 1. Audit (`deno task pipeline:audit`)

**What it does:** Scans every recipe, ingredient, and useful item in the database and reports what's missing.

**Why it exists:** Before running the other tools, you need to know the current state of your data. The audit tells you "42 ingredients are missing images, 15 need translations, 8 need nutritional data."

**Output:** A JSON report at `data-pipeline/audit-report.json` plus a terminal summary.

```bash
# Check local database
deno task pipeline:audit --local

# Check production, save report to specific file
deno task pipeline:audit --production --output ./my-report.json
```

The report groups issues by type (`missing_image`, `missing_nutrition`, `missing_english_name`, `missing_spanish_name`) so you can feed it directly into the other tools.

#### 2. Fetch Nutrition (`deno task pipeline:nutrition`)

**What it does:** Finds ingredients without nutritional data and fetches it automatically.

**How it works:**
1. Tries the **USDA FoodData Central API** first (free, authoritative, per-100g data)
2. If USDA has no match, falls back to **OpenAI GPT-4o-mini** for an estimate
3. Saves `{ calories, protein, fat, carbohydrates }` per 100g to the database

**Why two sources:** The USDA database is the gold standard for common ingredients (chicken, rice, tomato) but doesn't cover everything — regional ingredients or prepared items might not exist. GPT-4o-mini fills the gaps with reasonable estimates.

```bash
# Process up to 50 ingredients locally
deno task pipeline:nutrition --local

# Only process items from a previous audit report
deno task pipeline:nutrition --local --from-audit ./audit-report.json --limit 20

# See what would be processed without making changes
deno task pipeline:nutrition --production --dry-run
```

#### 3. Translate Content (`deno task pipeline:translate`)

**What it does:** Finds entities that have a name in one language but not the other, and translates them using GPT-4o-mini.

**What it covers:** Ingredients (including plural forms), useful items, and recipe tags.

**Why GPT-4o-mini:** It handles food/cooking terminology well, understands Mexican Spanish (not just Castilian), and is cheap enough for batch processing. The prompt is specific: "Translate the following English food/cooking term to Mexican Spanish."

```bash
# Translate everything missing, locally
deno task pipeline:translate --local

# Preview what needs translating in production
deno task pipeline:translate --production --dry-run
```

#### 4. Generate Images (`deno task pipeline:images`)

**What it does:** Creates AI-generated product photos for any entity missing an image, then uploads them to Supabase Storage.

**How it works:**
1. Generates an image with **DALL-E 3** using entity-specific prompts
2. Downloads the generated image
3. Uploads to Supabase Storage (organized by bucket: `ingredients/`, `recipes/`, `useful-items/`)
4. Saves the public URL back to the database

**Prompt design matters:** Each entity type gets a tailored prompt:
- **Recipes** → Overhead food photography, rustic table, warm lighting
- **Ingredients** → Clean studio shot, white background, fresh and vibrant
- **Useful items** → Product photo, white background, isolated object

**Failure recovery:** If the upload to Supabase fails after generating an image (network issue, storage quota, etc.), the image is saved locally to `data-pipeline/data/failed-uploads/` so the DALL-E credit isn't wasted. You can manually upload these later.

**Budget system:** The `--limit` flag caps the total number of images across ALL entity types. If you say `--limit 10`, it might generate 5 ingredient images and 5 recipe images, or any other combination up to 10 total.

```bash
# Generate up to 5 ingredient images locally
deno task pipeline:images --local --type ingredient --limit 5

# Generate all types in production, max 20 total
deno task pipeline:images --production --type all --limit 20
```

### Typical Workflow

```bash
# 1. See what's missing
deno task pipeline:audit --local

# 2. Fill in nutrition data (cheapest API calls)
deno task pipeline:nutrition --local --limit 50

# 3. Translate missing names
deno task pipeline:translate --local

# 4. Generate images (most expensive — DALL-E costs add up)
deno task pipeline:images --local --type all --limit 10

# 5. Re-audit to verify progress
deno task pipeline:audit --local
```

### Shared Libraries

The CLI tools share a set of utility modules in `data-pipeline/lib/`:

| Module | Purpose |
|--------|---------|
| `db.ts` | All Supabase CRUD operations (fetch, create, update for every entity type) |
| `config.ts` | Environment detection, API key loading, Supabase client creation |
| `logger.ts` | Color-coded terminal output with sections and summaries |
| `utils.ts` | `sleep()` for rate limiting, `parseJsonFromLLM()` for stripping markdown fences |
| `entity-matcher.ts` | Fuzzy matching of ingredient names (handles plurals, prep prefixes like "chopped", typos) |
| `budget.ts` | Shared counter so `--limit N` works across entity types |
| `recipe-parser.ts` | Parses recipe markdown into structured data for import |

---

## Analytics

### The Problem

After launch, we need to understand: Are users actually cooking recipes, or just browsing? Where do they drop off? What recipes are popular? Are the AI features being used?

### The Solution

A server-side analytics system built on Supabase RPC, with a typed frontend service.

#### How It Works

1. The app already logs user events (view recipe, start cook, complete cook, search, etc.) to a `user_events` table
2. A PostgreSQL function `admin_analytics()` aggregates these events into meaningful metrics
3. The frontend `analyticsService.ts` calls this function with type-safe methods

#### Available Metrics

| Method | What It Returns |
|--------|-----------------|
| `getOverviewMetrics()` | DAU, WAU, MAU, total signups, onboarding rate |
| `getRetentionMetrics()` | Day 1/7/30 retention, avg time to first cook |
| `getFunnelMetrics(timeframe)` | View → Start → Complete conversion rates |
| `getTopViewedRecipes(timeframe)` | Most viewed recipes |
| `getTopCookedRecipes(timeframe)` | Most completed recipes |
| `getTopSearches(timeframe)` | Popular search queries |
| `getAIMetrics()` | AI adoption rate, chat/voice session counts |
| `getPatternMetrics()` | Cooking by hour of day, language split |

All list/funnel methods accept a timeframe: `'today'`, `'7_days'`, `'30_days'`, or `'all_time'`.

#### Design Decisions

- **Server-side aggregation:** Metrics are computed in PostgreSQL, not the client. This means the admin dashboard loads one RPC call instead of fetching thousands of raw events.
- **Admin-only:** The RPC function checks `is_admin()` before returning data.
- **Null-safe list methods:** Methods like `getTopViewedRecipes()` return `[]` instead of `null` when there's no data, so the UI doesn't need null checks.

See [ANALYTICS.md](../ANALYTICS.md) for event schemas, SQL queries, and tracking philosophy.

---

## Backup System

### The Problem

Production data (database + uploaded images) needs regular backups. Supabase provides automatic backups on paid plans, but having your own independent copies is essential.

### The Solution

Three bash scripts in `yyx-server/scripts/`:

```bash
# Back up everything (database + storage) into a timestamped folder
npm run backup          # → backups/Feb-03_8-19pm/

# Or individually
npm run backup:db       # → backups/[timestamp]/database.sql.gz
npm run backup:storage  # → backups/[timestamp]/storage/
```

#### How They Work

- **Database:** Uses `pg_dump` with credentials extracted from Supabase CLI. Output is gzip-compressed. Auto-cleanup keeps only the last 10 backups.
- **Storage:** Recursively downloads all buckets via the Supabase Storage REST API using the service role key. Preserves folder structure.
- **Combined:** `backup-all.sh` runs both with a synchronized timestamp so DB and storage snapshots are paired.

#### Prerequisites

```bash
brew install libpq     # For pg_dump
brew install supabase   # Supabase CLI (already required)
```

The storage backup requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your `.env` or `.env.local`.

---

## Database Hardening

This branch includes 11 database migrations that address security, performance, and schema quality:

### Security
- **Fixed function search paths** — All triggers/functions now use `SET search_path = public` to prevent SQL injection via search_path manipulation
- **Tightened RLS policies** — Replaced permissive `USING(true)` policies on master data tables (ingredients, tags, etc.) with proper admin checks. Regular users get read-only access; only admins can modify.

### Performance
- **Added foreign key indexes** — Every foreign key column now has an index, preventing slow sequential scans on JOINs
- **Added analytics index** — `user_events(event_type, created_at DESC)` for fast analytics queries
- **Cleaned up duplicate indexes** — Removed redundant indexes that were wasting write performance

### Schema Quality
- **Unpublished recipe filtering** — RLS now hides `is_published = false` recipes from regular users
- **Removed duplicate columns** — Cleaned up schema redundancy
- **Added ordering constraints** — Ensures consistent ordering in recipe steps/ingredients
- **Made migrations idempotent** — All migrations use `IF NOT EXISTS` / `IF EXISTS` so they can safely be re-run

---

## Frontend Improvements

### Cooking Guide
- **Event tracking:** Cook start and cook complete events are now tracked for analytics
- **expo-image:** Replaced React Native's built-in `Image` with `expo-image` for better caching and performance (`cachePolicy="memory-disk"`)
- **Design tokens:** Replaced hardcoded color `#f9f9f9` with `COLORS.grey.light` from the design system
- **Performance:** `MiseEnPlaceIngredient`, `MiseEnPlaceUsefulItem`, and `StepItem` are wrapped with `React.memo` to prevent unnecessary re-renders in lists
- **Extracted inline styles:** Moved `contentContainerStyle` objects to module-level constants to avoid re-creation on every render

### RecipeInfo Component
- Removed the unused `difficulty` prop that was defined in the interface but never rendered. This was dead code flowing through 4 components and their tests — cleaning it up reduces confusion for future developers.

---

## Code Quality: Review Fixes

The final commit addresses findings from a code review (PR #11):

### DRY Violations Fixed
- **`sleep()` + `parseJsonFromLLM()`** — Extracted to `utils.ts` from 7 inline copies across 3 files
- **`auditEntities()`** — Extracted from 3 copy-pasted audit loops into one generic function
- **`processEntities<T>()`** — Replaced 3 nearly-identical image processing functions (~135 duplicated lines) with one generic function + 3 config objects
- **`db.updateTag()`** — Added to match the existing pattern of `updateIngredient`/`updateUsefulItem`/`updateRecipe`, replacing a direct Supabase call in translate-content.ts
- **Removed unused `byType` variable** in audit-data.ts

### Correctness Fix
- **Zero-division guard in `convertToPer100g`** — Previously, passing `portionSize = 0` would produce `Infinity` values. Now throws a descriptive error.

### Test Coverage Added
- **entity-matcher.test.ts** (21 tests) — Covers exact match, plural, prep-prefix stripping, fuzzy matching, DISTINCT_INGREDIENTS rejection, case sensitivity, and null returns for all 4 matcher functions
- **analyticsService.test.ts** (9 tests) — Covers successful RPC calls, error propagation, and null-to-empty-array fallback for list methods
- **nutritional-utils.test.ts** (+2 tests) — Zero and negative portion size guards
- **deno.json** — Test config updated to include `data-pipeline/` so `deno task test` runs pipeline tests alongside edge function tests

---

## Running Tests

```bash
# Backend — runs all 158 tests (edge functions + pipeline)
cd yyx-server && deno task test

# Frontend — runs all ~734 tests
cd yyx-app && npx jest --watchAll=false

# Just pipeline tests
cd yyx-server && deno task test:pipeline

# Linting
cd yyx-server && deno lint data-pipeline/
cd yyx-app && npm run lint
```

---

## File Map

```
yyx-server/
├── data-pipeline/
│   ├── cli/
│   │   ├── audit-data.ts          # Data quality scanner
│   │   ├── fetch-nutrition.ts     # USDA + OpenAI nutrition fetcher
│   │   ├── translate-content.ts   # Bilingual translation tool
│   │   ├── generate-images.ts     # DALL-E image generator
│   │   └── import-recipes.ts      # Recipe markdown importer
│   ├── lib/
│   │   ├── db.ts                  # All database operations
│   │   ├── config.ts              # Environment + API key config
│   │   ├── logger.ts              # Colored terminal output
│   │   ├── utils.ts               # sleep(), parseJsonFromLLM()
│   │   ├── entity-matcher.ts      # Fuzzy name matching
│   │   ├── entity-matcher.test.ts # 21 matcher tests
│   │   ├── budget.ts              # Shared rate limiter
│   │   └── recipe-parser.ts       # Markdown → structured recipe
│   └── data/
│       └── failed-uploads/        # Fallback for failed image uploads
├── scripts/
│   ├── backup-all.sh              # Combined DB + storage backup
│   ├── backup-db.sh               # PostgreSQL dump
│   └── backup-storage.sh          # Supabase Storage download
├── supabase/
│   ├── migrations/                # 11 new migrations
│   └── functions/
│       └── _shared/
│           └── nutritional-utils.ts  # Zero-division guard added
└── deno.json                      # Updated test config

yyx-app/
├── services/
│   ├── analyticsService.ts        # Admin analytics client
│   └── __tests__/
│       └── analyticsService.test.ts  # 9 analytics tests
├── components/
│   ├── cooking-guide/
│   │   ├── MiseEnPlaceIngredient.tsx  # React.memo wrapped
│   │   └── MiseEnPlaceUsefulItem.tsx  # React.memo wrapped
│   └── recipe-detail/
│       ├── RecipeInfo.tsx          # difficulty prop removed
│       └── RecipeSteps.tsx         # StepItem memoized
└── app/(tabs)/recipes/[id]/
    └── cooking-guide/
        ├── index.tsx               # expo-image, design tokens, event tracking
        └── [step].tsx              # design tokens, extracted styles

CLAUDE.md                          # Added Dependencies section
AGENTS.md                          # Added "prefer built-in" principle
ANALYTICS.md                       # Analytics event documentation
DEPLOYMENT.md                      # Production deployment checklist
```
