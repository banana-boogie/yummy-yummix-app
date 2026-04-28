---
name: review-recipe
description: Review a YummyYummix recipe against the quality rubric and emit a YAML config for the recipe-metadata apply pipeline
---

# Recipe Review Skill

Review the recipe identified by `$ARGUMENTS` (an EN/ES name fragment, or a UUID) and produce or refresh the YAML config at `yyx-server/data-pipeline/data/recipe-metadata/<slug>.yaml`. The YAML, once committed, is applied transactionally by `deno task pipeline:apply-recipe-metadata` (Plan 12).

Read [docs/agent-guidelines/RECIPE-REVIEW.md](../../../docs/agent-guidelines/RECIPE-REVIEW.md) before proceeding — that file is the rubric.

## Preflight — reasoning effort gate (required)

Recipe quality is reputation-critical. A wrong tag, an invented Spanish translation, or a misclassified `planner_role` ships to real users. Before doing **anything else** in this skill:

1. Confirm you are running at the highest reasoning level your harness exposes (`$effort high` in Codex, equivalently `o1`/`gpt-5` thinking-tier or whatever the current top tier is). If you cannot confirm high reasoning, stop and tell the user:
   > Recipe review requires the highest reasoning effort available. The judgment-call portion of the rubric (planner role, tag selection, translation, ingredient/step quality) is the failure mode that hurts reputation, and high effort is the floor for those calls. Please raise effort and re-invoke `$review-recipe`.
2. Do not start Step 1 until effort is confirmed high. This is not negotiable — even on follow-up turns of an existing `$review-recipe` session, if effort drops below high, pause and prompt for re-elevation.
3. When you are uncertain on a judgment call (translation correctness, tag fit, role assignment, ingredient quality), prefer routing to `requires_authoring.notes` over guessing. The skill never penalizes caution.

## Inputs

- `$ARGUMENTS` — the recipe to review. Examples:
  - `"Mongolian Beef"` (EN name fragment)
  - `"Sopa de tortilla"` (ES name fragment)
  - `8e3a9b2c-...` (UUID)

If `$ARGUMENTS` is empty, surface the worklist instead of asking blind. Run both:

```bash
cd yyx-server && deno task pipeline:apply-recipe-metadata --list-missing
cd yyx-server && deno task pipeline:apply-recipe-metadata --list-authoring
```

Present them as two numbered groups:

- **Needs YAML** (from `--list-missing`) — recipes with no `<slug>.yaml` yet
- **Flagged `requires_authoring`** (from `--list-authoring`) — committed YAMLs whose authors flagged unresolvable gaps

Ask the user which one to review (by name or by number). Once they pick, proceed to Step 1 with that as the argument.

If both lists are empty, tell the user every recipe in the DB already has a YAML and ask if they want to refresh an existing one.

## Step 1 — Resolve the recipe

Use the Supabase MCP `execute_sql` tool (read-only — safe per the project's MCP rules) to find candidate matches:

```sql
SELECT r.id, r.updated_at,
       en.name AS name_en, es.name AS name_es,
       r.is_published, r.planner_role
  FROM public.recipes r
  LEFT JOIN public.recipe_translations en ON en.recipe_id = r.id AND en.locale = 'en'
  LEFT JOIN public.recipe_translations es ON es.recipe_id = r.id AND es.locale = 'es'
 WHERE en.name ILIKE '%<argument>%' OR es.name ILIKE '%<argument>%' OR r.id::text = '<argument>';
```

- If 0 matches: tell the user, stop.
- If 2+ matches: list them and ask which one.
- If 1 match: capture `id`, `updated_at`, `name_en`, `name_es` for use throughout.

## Step 2 — Fetch full recipe state

Run these in parallel via `execute_sql` (each is read-only). Capture the full result of each — you will reference it in steps 3-5.

```sql
-- recipe row
SELECT * FROM public.recipes WHERE id = '<recipe_id>';

-- translations
SELECT locale, name, description, tips_and_tricks, scaling_notes
  FROM public.recipe_translations WHERE recipe_id = '<recipe_id>';

-- ingredients (with EN ingredient names for slug derivation)
SELECT ri.id, ri.display_order, ri.ingredient_id, ri.measurement_unit_id,
       ri.quantity, ri.optional, it.name AS ingredient_name_en
  FROM public.recipe_ingredients ri
  LEFT JOIN public.ingredient_translations it
    ON it.ingredient_id = ri.ingredient_id AND it.locale = 'en'
  WHERE ri.recipe_id = '<recipe_id>'
  ORDER BY ri.display_order;

-- steps
SELECT id, "order", thermomix_time, thermomix_speed,
       thermomix_speed_start, thermomix_speed_end,
       thermomix_temperature, thermomix_temperature_unit,
       thermomix_mode, thermomix_is_blade_reversed, timer_seconds
  FROM public.recipe_steps WHERE recipe_id = '<recipe_id>' ORDER BY "order";

-- step text (any locale's instructions are needed for the rubric checks)
SELECT recipe_step_id, locale, instruction
  FROM public.recipe_step_translations
  WHERE recipe_step_id IN (SELECT id FROM public.recipe_steps WHERE recipe_id = '<recipe_id>');

-- kitchen tools
SELECT rkt.id, rkt.kitchen_tool_id, rkt.display_order, ktt.name AS name_en
  FROM public.recipe_kitchen_tools rkt
  LEFT JOIN public.kitchen_tool_translations ktt
    ON ktt.kitchen_tool_id = rkt.kitchen_tool_id AND ktt.locale = 'en'
  WHERE rkt.recipe_id = '<recipe_id>';

-- pairings
SELECT rp.target_recipe_id, rp.pairing_role, rp.reason,
       en.name AS target_name_en
  FROM public.recipe_pairings rp
  LEFT JOIN public.recipe_translations en
    ON en.recipe_id = rp.target_recipe_id AND en.locale = 'en'
  WHERE rp.source_recipe_id = '<recipe_id>';

-- tags (must include slug + categories — Track H schema)
SELECT rt.slug, rt.categories
  FROM public.recipe_to_tag rtt
  JOIN public.recipe_tags rt ON rt.id = rtt.tag_id
  WHERE rtt.recipe_id = '<recipe_id>';
```

## Step 3 — Run auto-checks

Walk every item in the **Deterministic auto-checks** section of `RECIPE-REVIEW.md`. For each positive hit, note what the YAML needs to express.

For check #15 (`no_steps`) and #16 (`few_ingredients`): **stop fixing those sections** and add the trigger to `requires_authoring.reasons`. Never fabricate steps or ingredients.

For check #14 (`same_en_es_name`): if the ES translation is unambiguous (e.g. proper noun translates clearly), set `name.es`. If subjective, flag `requires_authoring.reasons: ['same_en_es_name']` and leave the name alone.

## Step 4 — Run judgment-call checks

For each item in the **Judgment-call checks** section of `RECIPE-REVIEW.md`, reason about the recipe and decide what (if anything) the YAML should change. When in doubt, flag the concern in `requires_authoring.notes` instead of silently changing.

**`planner_role` is special — re-decide it from scratch every time.** Do not look at the current DB value first; look at the recipe (ingredients, portions, meal_components, dish identity) and decide what role/meal_components/is_complete_meal *should* be. Only then compare against the DB. Many recipes were imported with mis-coded roles (complete-meal salads as `side`, dips as `snack`), so the "preserve if present" default is unsafe here. Always include the `planner` section in the YAML with at least `role`, `meal_components`, and `is_complete_meal`, even when your decision matches the current DB value — re-asserting the same value is a zero-write idempotent op and makes the review's role decision visible in git history.

**Exclusion-style diet tags must be audited against user-visible content.** Adding `vegan`, `vegetarian`, `gluten_free`, or `pescatarian` is a promise to the user. Before keeping or adding one of these tags, scan the description, `tips_and_tricks`, ingredient list, and step text for items that violate the promise (cheese mentioned in a vegan tip; bread mentioned in a gluten-free description; anchovies in a vegetarian dressing). If you find a contradiction: rewrite the content to surface a compliant alternative alongside the existing suggestion, or drop the tag. Never ship the contradiction — these tags are reputation-critical.

## Step 5 — Write the YAML

Write the YAML to `yyx-server/data-pipeline/data/recipe-metadata/<slug>.yaml` where `<slug>` is the EN name slugified (lowercase, hyphen-separated, e.g. `Mongolian Beef` → `mongolian-beef.yaml`).

Required sections:

- `recipe_match.id` — the UUID from step 1
- `recipe_match.name_en` — the live EN name (so the apply hard-fails if the YAML drifts to a different recipe)
- `recipe_match.expected_recipe_updated_at` — the live `updated_at` from step 1
- `review.reviewed_by_label` — your model label (e.g. `'codex-gpt-5'`)
- `review.reviewed_at` — current ISO 8601 timestamp

**`planner` is the exception**: always include it with at least `role`, `meal_components`, and `is_complete_meal` (per Step 4's "re-decide planner_role from scratch" rule), even when your decision matches the current DB value. Re-asserting the same value is a zero-write idempotent op and makes the role decision visible in git history.

For every other section, write only what changes. If a section's current state is already correct, omit it (idempotent dry-run will report zero writes for omitted sections).

Match-key rules:
- `ingredient_updates`/`ingredient_removes`: prefer `existing_id` (the `id` from step 2's recipe_ingredients query). Fallback: `ingredient_slug` + `display_order`. Compute the slug exactly as the SQL helper does — the JS reproduction is in `data-pipeline/lib/recipe-metadata-fetch.ts:slugifyName()`. Never use names directly.
- `step_overrides`: prefer `step_id`. Fallback: `order`.
- `kitchen_tools` and `pairings`: declarative `set:` blocks list the full desired state.

Validate the YAML before stopping:

```bash
cd yyx-server && deno task pipeline:apply-recipe-metadata --local --recipe <slug> --dry-run
```

The dry-run prints the diff. If validation fails, fix the YAML and re-run.

## Step 6 — requires_authoring triage

If you flagged any unfixable issues, write a clear note:

```yaml
requires_authoring:
  reasons: [no_steps, few_ingredients]
  notes: 'Recipe imported from Notion as a stub. Steps section is empty and only 1 ingredient (chocolate) is listed. Needs human authoring before publication.'
```

The applier ignores this section — it is YAML-only, surfaced by `--list-authoring`. Recipes flagged this way are NOT publishable until a human authors the missing pieces in the admin UI.

## Step 7 — Report

Tell the user, in 3-5 short bullets:

- Recipe reviewed: `<name>` (`<id>`)
- Auto-check hits: N (list categories)
- Judgment-call concerns: N (list)
- requires_authoring: yes/no (list reasons if yes)
- Next step: `deno task pipeline:apply-recipe-metadata --local --recipe <slug> --dry-run`

Do not apply the YAML yourself — that is the human's call after reviewing the diff.

## Things this skill never does

- Fabricate ingredients, steps, or names not present in the live data.
- Auto-create tags or kitchen tools (taxonomy is human-curated).
- Touch `recipes.verified_by` (UUID FK reserved for admin-UI verification).
- Write to MCP `apply_migration` or run any DDL.
- Push to git — output is a YAML file change for human review and commit.
