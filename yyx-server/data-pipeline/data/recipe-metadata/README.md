# Recipe Metadata Pipeline

Plan 12 — declarative YAML configs that take a recipe from "imported but raw" to "fully tagged + paired + described + planner-ready" via a single transactional Postgres RPC. Designed to replace the admin-UI click-fest for the ~65 launch recipes.

Two pieces:

1. **Reviewer** (`/review-recipe <name>` Claude skill) — Claude session that fetches the recipe, walks the [16-point rubric](../../../../docs/agent-guidelines/RECIPE-REVIEW.md), and writes a YAML config here.
2. **Applier** (`deno task pipeline:apply-recipe-metadata`) — deterministic Deno CLI that validates the YAML, computes a diff, and (in `--apply` mode) calls the `apply_recipe_metadata` RPC for a single-transaction apply.

Both are useless apart — the YAML schema is the contract.

---

## End-to-end workflow

```
┌───────────────────────────────────────────────────────────┐
│ 1. Run the Reviewer in a Claude session                   │
│    → /review-recipe Mongolian Beef                        │
│    Reads DB state, runs auto-checks + judgment,           │
│    writes data/recipe-metadata/mongolian-beef.yaml        │
└──────────────┬────────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────────┐
│ 2. Inspect the YAML diff                                  │
│    → git diff data/recipe-metadata/                       │
│    Reviewable like any code change.                       │
└──────────────┬────────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────────┐
│ 3. Dry-run the Applier                                    │
│    → deno task pipeline:apply-recipe-metadata --local \   │
│        --recipe mongolian-beef --dry-run                  │
│    Prints per-section diff. Zero writes.                  │
└──────────────┬────────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────────┐
│ 4. Apply                                                  │
│    → deno task pipeline:apply-recipe-metadata --local \   │
│        --recipe mongolian-beef --apply                    │
│    Single Postgres transaction via apply_recipe_metadata. │
│    Stale-diff guarded — re-run Reviewer if rejected.      │
└───────────────────────────────────────────────────────────┘
```

---

## Files in this directory

- `<slug>.yaml` — one per recipe. Filename is the EN name slugified (lowercase, hyphen-separated).
- `mongolian-beef.yaml` — canonical fixture. Schema-test exercises this file.
- `garlic-shrimp.yaml`, `tortilla-soup.yaml`, `picadillo-tostadas.yaml` — reference YAMLs for the other 3 recipes named in Plan 12. Their `recipe_match.id` is a placeholder until the Reviewer refreshes against the live DB.

---

## CLI commands

```bash
# Worklist: which recipes still need a YAML?
deno task pipeline:apply-recipe-metadata --list-missing

# Worklist: which committed YAMLs flag requires_authoring?
deno task pipeline:apply-recipe-metadata --list-authoring

# Single recipe — dry-run
deno task pipeline:apply-recipe-metadata --local --recipe mongolian-beef --dry-run

# Single recipe — apply (mutating)
deno task pipeline:apply-recipe-metadata --local --recipe mongolian-beef --apply

# Every YAML in this directory — dry-run
deno task pipeline:apply-recipe-metadata --local --all --dry-run

# Verbose dry-run (shows no-op sections too)
deno task pipeline:apply-recipe-metadata --local --recipe mongolian-beef --dry-run --verbose
```

---

## YAML schema cheat sheet

The full Zod schema lives at [`yyx-server/data-pipeline/lib/recipe-metadata-schema.ts`](../../lib/recipe-metadata-schema.ts). Quick reference:

| Section | Required? | Mode | Notes |
|---|---|---|---|
| `recipe_match` | yes | — | `id` (UUID), `name_en`, `expected_recipe_updated_at` (ISO 8601) |
| `review` | yes | — | `reviewed_by_label`, `reviewed_at` (YAML-only — never written to DB) |
| `planner` | optional | UPDATE diff | role, alternate_planner_roles, meal_components, equipment_tags, cooking_level, … |
| `timings` | optional | UPDATE diff | prep_time, total_time, portions |
| `name` | optional | per-locale UPSERT | for `same_en_es_name` cleanup |
| `description` / `tips_and_tricks` / `scaling_notes` | optional | per-locale UPSERT | recipe_translations columns |
| `tags` | optional | per-category set replacement | keyed by Track H slug. 7 categories: `cuisine`, `meal_type`, `diet`, `dish_type`, `primary_ingredient`, `occasion`, `practical` |
| `ingredient_updates` / `_adds` / `_removes` | optional | per-row | match key: `existing_id` OR `ingredient_slug + display_order` |
| `kitchen_tools` | optional | declarative `set:` | `name_en` lookup; ambiguous = hard error |
| `pairings` | optional | declarative `set:` | composite key `(target_id, role)` |
| `step_overrides` | optional | per-row | match key: `step_id` OR `order` |
| `cleanup.delete_locales` | optional | DELETE per-locale | refuses `'en'` (would orphan recipe) |
| `requires_authoring` | optional | YAML-only | `reasons[]`, `notes` — surfaces in `--list-authoring`, never persisted |

---

## Stale-diff guard

The Reviewer captures `recipes.updated_at` at fetch time and writes it to `recipe_match.expected_recipe_updated_at`. The RPC's first statement is `SELECT updated_at FROM recipes WHERE id=$ FOR UPDATE`. If the live `updated_at` has advanced past the expected value (e.g., an admin edited the recipe between review and apply), the RPC raises `stale_diff` and the apply is rejected. Re-run the Reviewer to refresh the snapshot.

---

## Recipe review snapshots (review input only)

For batch reviews, the Reviewer reads recipe state from a local **recipe review snapshot** instead of round-tripping to Supabase per recipe. A snapshot captures the same review-critical state in a single JSON file under `data/recipe-review-snapshots/`.

```bash
# Export every published recipe into a single snapshot
deno task pipeline:export-review-snapshot --local --scope published --label published-review

# Export only recipes named in a newline-separated manifest (IDs preferred,
# names allowed — duplicates surface as unresolved entries)
deno task pipeline:export-review-snapshot --local --manifest /tmp/recipes.txt
```

Snapshots are immutable timestamped files; `latest.json` points at the most recent one. Snapshots are **review input only** — `apply-recipe-metadata` always talks to live Supabase, and the YAML's `recipe_match.expected_recipe_updated_at` plus the RPC's stale-diff guard remain the apply-time safety boundary. The snapshot directory is gitignored (snapshots can be large and may capture unpublished/draft content).

---

## Idempotency

Every section uses `IS DISTINCT FROM` gating, set-replacement diffs, or composite-key existence checks. Re-running an unchanged YAML produces zero data writes. The CLI's dry-run output is the source of truth for what an apply would touch.

---

## Things this pipeline does NOT do

- **Auto-create ingredients, tags, or kitchen tools.** Taxonomy stays human-curated. The applier raises a clear error if a YAML references a slug/name that doesn't exist in the DB; create it in the admin UI first.
- **Fabricate steps or ingredients.** Recipes flagged `no_steps` or `few_ingredients` in `requires_authoring.reasons` are handed back to the admin UI for human authoring.
- **Touch `recipes.verified_by`.** That column is a UUID FK to `auth.users`, reserved for admin-UI verification. Reviewer attestation is YAML-only.
- **Push migrations.** The RPC migration must be applied via the standard `npm run backup && npm run db:push` workflow.

---

## Related files

- Plan: `product-kitchen/repeat-what-works/plans/12-recipe-metadata-pipeline.md`
- Rubric: `docs/agent-guidelines/RECIPE-REVIEW.md`
- Schema: `yyx-server/data-pipeline/lib/recipe-metadata-schema.ts`
- Diff engine: `yyx-server/data-pipeline/lib/recipe-metadata-diff.ts`
- Fetch helpers: `yyx-server/data-pipeline/lib/recipe-metadata-fetch.ts`
- RPC migration: `yyx-server/supabase/migrations/20260427050549_apply_recipe_metadata_rpc.sql`
- Reviewer skill: `.claude/skills/review-recipe/SKILL.md`
