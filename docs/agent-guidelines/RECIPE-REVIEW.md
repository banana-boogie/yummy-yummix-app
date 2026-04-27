# Recipe Review Rubric

Reference for the `/review-recipe <name>` skill and any human reviewing a recipe by hand. Pairs with the recipe-metadata pipeline at `yyx-server/data-pipeline/cli/apply-recipe-metadata.ts`.

The reviewer's job: produce a YAML config at `yyx-server/data-pipeline/data/recipe-metadata/<slug>.yaml` that, once applied, takes a raw recipe to planner-ready (tagged + paired + described + bilingual). The Applier is dumb on purpose — every judgment call belongs in the YAML.

---

## How to use this rubric

1. Fetch the current recipe state from the DB (recipe row + ingredients, steps, translations, kitchen tools, pairings, tags, recipe_to_tag).
2. Walk the **deterministic auto-checks** below and record any positive hits as YAML diffs.
3. Walk the **judgment-call checks** and decide what (if anything) needs changing. When unsure, flag in `requires_authoring.notes` rather than guess.
4. If any **unfixable-by-Applier** signal fires (`no_steps`, `few_ingredients`, `same_en_es_name` without an obvious ES name), set `requires_authoring.reasons` and STOP — do not fabricate content.
5. Capture `recipe_match.expected_recipe_updated_at` from the row you fetched in step 1. The Applier rejects the apply if the DB row has advanced since.
6. Set `review.reviewed_by_label` and `review.reviewed_at` (ISO 8601) — this is YAML-only attestation, never written to `recipes.verified_by`.

---

## 16-point quality checklist

### Deterministic auto-checks (a script can answer these)

1. **Missing units.** `recipe_ingredients.measurement_unit_id IS NULL` for any non-pinch ingredient.
2. **Zero quantity.** `recipe_ingredients.quantity = 0`.
3. **Zero prep time.** `recipes.prep_time = 0` and `total_time = 0` (the dual-zero is the real signal — single-zero may be intentional for raw assemblies).
4. **Thermomix steps without equipment tag.** Step instructions mention "Thermomix", "Varoma", "TM6", or speed/temperature numerics, but `recipes.equipment_tags` does not include `thermomix`.
5. **Missing description or tips.** `recipe_translations.description IS NULL` or `tips_and_tricks = ''` for any locale the recipe supports.
6. **Duplicate `es-ES` rows.** Translation rows for `es-ES` that mirror `es` exactly — import artifact. Strip via `cleanup.delete_locales: ['es-ES']`.
7. **Published without planner role.** `recipes.is_published = true` and `planner_role IS NULL`.
8. **No kitchen tools.** Zero entries in `recipe_kitchen_tools`. (Pantry recipes that genuinely need none — e.g. spice blends — can stay empty.)
9. **Step text vs structured Thermomix fields.** Step instructions specify temperature/speed in prose but the corresponding columns (`thermomix_speed`, `thermomix_temperature`) are NULL.
10. **Step references unknown ingredient.** Step instruction names an ingredient that is not in `recipe_ingredients`.
11. **Non-complete-meal mains without pairings.** `planner_role = 'main'`, `is_complete_meal = false`, and no outgoing rows in `recipe_pairings`.
12. **Implausible quantities.** Sugar < 5 g in a sweet sauce, salt > 10 g per kg of meat, raisins > 80 g in a savory dish, etc. Use cuisine context.
13. **Non-pantry recipes without `meal_type` tag.** Admin form enforces `requiresMealType = recipe.plannerRole !== 'pantry'` (see `MealPlanningForm.tsx`). A non-pantry recipe with no `meal_type` tag is unplannable.
14. **`same_en_es_name`.** `recipe_translations.name` identical between `en` and `es`. Reviewer fixes via `name.es` override **only when the translation is unambiguous** (e.g. "Mongolian Beef" → "Res Mongola"). Anything subjective: flag `requires_authoring.reasons: ['same_en_es_name']`.
15. **`no_steps`.** `recipe_steps` is empty. Always flag `requires_authoring.reasons: ['no_steps']`. Never fabricate steps.
16. **`few_ingredients`.** `recipe_ingredients` has fewer than 3 entries. Almost always means the import was incomplete. Flag `requires_authoring.reasons: ['few_ingredients']` unless the recipe is genuinely 2-ingredient (e.g. matcha butter — confirm from name).

### Judgment-call checks (require Claude's reasoning)

- **Authentic seasoning balance.** A Mexican mole missing chocolate or chili is suspect. A Thai green curry without fish sauce or kaffir lime is suspect.
- **Portion size matches ingredient volume.** 4 portions from 200 g of pasta is wrong. 8 portions from 2 kg of beef is wrong.
- **Plausible Thermomix speeds.** Speed 1.5 for sautéing — fine. Speed 4.5 for sautéing — wrong, that's a blender speed. Speed 11 — invalid (max is 10 in numeric, plus `'spoon'`).
- **Equipment choices appropriate.** Varoma cycle for raw shrimp is suspicious if longer than 10 minutes. Oven called for a no-bake dessert is wrong. Thermomix called when the recipe is purely assembly is overkill.
- **Ingredient list completeness vs step narrative.** Step says "add the cilantro garnish" but cilantro isn't in `recipe_ingredients`. Step says "deglaze with white wine" but wine isn't listed.

---

## Schema gotchas

These trip every first-time reviewer. Internalize them.

- **`recipe_steps.order`** — NOT `step_order`. A column-name typo on PostgREST returns null silently, never errors.
- **`recipe_steps.thermomix_temperature`** — NOT `thermomix_temp`. Unit lives in `thermomix_temperature_unit` and is `'C'` or `'F'` (single character), NOT `'celsius'` / `'fahrenheit'`.
- **`recipe_ingredients.measurement_unit_id`** — string FK to `measurement_units.id` (e.g. `'g'`, `'clove'`, `'unit'`), NOT free text. Bogus IDs silently get rejected by the FK; missing FK on an existing row leaves the field null.
- **`recipe_translations.description`, `recipe_translations.tips_and_tricks`, `recipe_translations.scaling_notes`** — these are the canonical text fields. The matching columns on `recipes` itself either don't exist (`scaling_notes` was migrated out in `20260417225253`) or are stale. Always write to `recipe_translations`.
- **No cross-language fallback.** `en` and `es` are independent user groups. A Spanish user must never see English content, and vice versa. Never store base content under a regional code.
- **`recipes.verified_by`** — UUID FK to `auth.users`, reserved for admin-UI verification. Reviewer attestation goes in YAML's `review:` section, NOT this column.
- **PostgREST silently returns null for non-existent columns.** When fetching for review, double-check column names against the live schema if a value looks suspicious.

---

## Match-key rules (the durable-key contract)

Pure name matching is forbidden in YAML configs — it produces silent drift on re-run when admins rename ingredients or steps. Each child table has a documented preferred and fallback key set:

| Table | Preferred | Fallback | Notes |
|---|---|---|---|
| `recipe_ingredients` | `existing_id` (UUID) | `ingredient_slug` + `display_order` | DB unique constraint is `(recipe_id, display_order)` — name is not unique. |
| `recipe_steps` | `step_id` (UUID) | `order` (1-indexed) | DB unique constraint is `(recipe_id, order)`. |
| `recipe_kitchen_tools` | declarative `set` keyed by `name_en` | — | Resolved against `kitchen_tools.name_en` at apply time; ambiguous names = hard error, no auto-create. |
| `recipe_pairings` | `target_id` (UUID) + `role` | — | Composite key `(source_recipe_id, target_recipe_id, pairing_role)`. `target_name_en` is a readability assertion only. |
| `recipe_to_tag` | tag `slug` (under category key) | — | Resolved against `recipe_tags.slug`. Categories: `cuisine`, `meal_type`, `diet`, `dish_type`, `primary_ingredient`, `occasion`, `practical` (Track H taxonomy). Hard error on miss; no auto-create — taxonomy stays human-curated. |

For any `set:` block (kitchen_tools, pairings, tags), the YAML is **declarative**: it lists the full desired state, the Applier diffs against current and emits inserts + deletes. For per-row blocks (ingredient_updates, step_overrides), the YAML is **imperative**: only listed rows are touched.

---

## Reviewer provenance

- `review.reviewed_by_label` — free-form label like `'claude-opus-4-7'` or `'claude-sonnet-4-6'`. Never includes secrets or session IDs.
- `review.reviewed_at` — ISO 8601 timestamp, e.g. `'2026-04-26T18:32:00.000Z'`.
- These are YAML-only and surface via `apply-recipe-metadata --list-authoring`. They never write to `recipes.verified_by` (UUID FK column reserved for admin-UI verification).

---

## Stale-diff guard

The Reviewer captures `recipes.updated_at` when fetching state and writes it to `recipe_match.expected_recipe_updated_at`. The Applier passes this value to the `apply_recipe_metadata` RPC, which acquires a row lock and rejects the apply with `stale_diff` if the live `updated_at` has advanced. If you see `stale_diff`, re-run `/review-recipe` to refresh the snapshot.

---

## Things the Reviewer never does

- **Fabricate steps or ingredients.** Hand back to admin UI via `requires_authoring`.
- **Auto-create tags or kitchen tools.** Taxonomy decisions stay with humans.
- **Touch `recipes.verified_by`.** Reserved for admin-UI verification.
- **Translate UI strings or i18n keys.** Reviewer touches recipe content only.
- **Write to `name_en` to "fix" a stub.** EN is the source of truth for `name`. ES gets the override (`name.es`) when EN/ES collide on a stub translation.
