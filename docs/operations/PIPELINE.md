# Data Pipeline

CLI tools for populating and maintaining production data. All tools live in `yyx-server/data-pipeline/`.

## Quick Reference

Run from `yyx-server/`:

| Command | Purpose |
|---------|---------|
| `npm run pipeline:audit -- --local` | Check what's missing (images, nutrition, translations) |
| `npm run pipeline:import -- --local --dir ../path/to/RECIPES` | Import recipes from Notion markdown |
| `npm run pipeline:nutrition -- --local` | Backfill nutritional facts (gpt-4.1-mini) |
| `npm run pipeline:translate -- --local` | Translate missing EN/ES content |
| `npm run pipeline:backfill -- --local` | Backfill es-ES (Spain Spanish) translations |
| `npm run pipeline:images -- --local --type all` | List entities missing images |
| `npm run pipeline:scan -- --local --dir ../path/to/RECIPES` | Scan Notion export for entities |

All commands also work with `deno task` directly (e.g., `deno task pipeline:audit --local`).

## Common Flags

| Flag | Purpose |
|------|---------|
| `--local` | Target the cloud database (required — safety confirmation) |
| `--production` | Same as `--local` (both use cloud credentials) |
| `--limit N` | Process at most N items |
| `--dry-run` | Preview what would happen without making changes |

**Why `--local` is required:** It's a safety guard to prevent accidentally running pipeline commands. You must explicitly confirm which environment you're targeting. Both `--local` and `--production` use the same Supabase credentials from `.env.local`.

## Typical Workflow

```bash
cd yyx-server

# 1. Audit — see what's missing
npm run pipeline:audit -- --local

# 2. Import recipes from Notion export
npm run pipeline:import -- --local --dir ../YYX-Notion-Recipe-MAR-14-2026/RECIPES --limit 5

# 3. Backfill nutrition for new ingredients
npm run pipeline:nutrition -- --local

# 4. Translate missing content
npm run pipeline:translate -- --local

# 5. Backfill Spain Spanish translations
npm run pipeline:backfill -- --local

# 6. Check missing images
npm run pipeline:images -- --local --type all --format md

# 7. Re-audit to verify progress
npm run pipeline:audit -- --local
```

## Tool Details

### Audit (`pipeline:audit`)

Scans recipes, ingredients, and kitchen tools for missing data. Outputs a summary to the terminal and a JSON report to `data-pipeline/audit-report.json`.

```bash
npm run pipeline:audit -- --local
npm run pipeline:audit -- --local --output ./my-report.json
```

### Import Recipes (`pipeline:import`)

Parses Notion markdown exports with OpenAI (gpt-4.1-mini) and inserts full recipe graphs: ingredients, steps with Thermomix parameters, tags, kitchen tools, and translations (EN, ES, es-ES).

```bash
# Dry run first
npm run pipeline:import -- --local --dir ../RECIPES --limit 5 --dry-run

# Import for real
npm run pipeline:import -- --local --dir ../RECIPES --limit 10
```

**Key behaviors:**
- Skips files without an `### Ingredientes` section (Notion stubs)
- Tracks progress in `data-pipeline/import-progress.json` — resume-safe
- Matches ingredients, tags, and kitchen tools against existing DB records
- Creates new entities when no match is found
- Generates es-ES (Spain Spanish) translations for each recipe
- On failure, cleans up the orphaned recipe (atomic per-recipe)

### Fetch Nutrition (`pipeline:nutrition`)

Fetches per-100g nutritional facts (calories, protein, fat, carbs) using OpenAI gpt-4.1-mini. Automatically finds ingredients missing nutrition data.

```bash
npm run pipeline:nutrition -- --local
npm run pipeline:nutrition -- --local --limit 20
npm run pipeline:nutrition -- --local --from-audit ./audit-report.json
```

### Translate Content (`pipeline:translate`)

Finds ingredients, kitchen tools, and tags that have a name in one language but not the other, and translates using OpenAI.

```bash
npm run pipeline:translate -- --local
npm run pipeline:translate -- --local --dry-run
```

### Backfill Translations (`pipeline:backfill`)

Backfills es-ES (Spain Spanish) translations for recipes that only have ES (Mexican Spanish). Translates recipe names, steps, ingredient notes, and kitchen tool notes.

```bash
npm run pipeline:backfill -- --local
npm run pipeline:backfill -- --local --limit 10
```

### List Missing Images (`pipeline:images`)

Generates a manifest of entities missing images. Output formats: `md`, `csv`, `json`.

```bash
npm run pipeline:images -- --local --type all
npm run pipeline:images -- --local --type ingredient --format csv --output ./missing.csv
```

Types: `ingredient`, `recipe`, `kitchen_tool`, `all`.

### Scan Entities (`pipeline:scan`)

Scans Notion markdown exports and cross-references against the database to find new ingredients, tags, and kitchen tools that would need to be created during import.

```bash
npm run pipeline:scan -- --local --dir ../RECIPES
```

## Architecture

```
data-pipeline/
├── cli/                          # CLI entry points
│   ├── import-recipes.ts         # Recipe importer
│   ├── audit-data.ts             # Data quality scanner
│   ├── fetch-nutrition.ts        # Nutrition backfill
│   ├── translate-content.ts      # EN/ES translation
│   ├── backfill-translations.ts  # es-ES backfill
│   ├── list-missing-images.ts    # Missing image manifest
│   └── scan-entities.ts          # Notion entity scanner
├── lib/                          # Shared libraries
│   ├── db.ts                     # All Supabase CRUD operations
│   ├── config.ts                 # Environment + API key loading
│   ├── entity-matcher.ts         # Fuzzy ingredient/tag/tool matching
│   ├── recipe-parser.ts          # OpenAI structured output for recipes
│   ├── spain-adapter.ts          # Mexico → Spain Spanish adaptation
│   ├── spain-constants.ts        # Shared Spain adaptation rules
│   ├── step-ingredient-resolver.ts # Step↔ingredient resolution
│   ├── import-helpers.ts         # Import utility functions
│   ├── progress-tracker.ts       # Resume-safe batch tracking
│   ├── budget.ts                 # Shared limit counter
│   ├── translation-backfill.ts   # Translation backfill logic
│   ├── translation-limit.ts      # Translation rate limiting
│   ├── logger.ts                 # Colored terminal output
│   └── utils.ts                  # sleep(), parseJsonFromLLM()
└── data/
    └── notion-exports/           # Place Notion exports here
```

## Environment

Requires these keys in `yyx-server/.env.local`:

```bash
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>   # Required for DB writes
OPENAI_API_KEY=<your-openai-key>                    # For AI parsing/translation/nutrition
```
