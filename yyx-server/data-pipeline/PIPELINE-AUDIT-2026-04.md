# Pipeline Audit — April 2026

Status: **COMPLETE** — all drift fixed, tests passing, dry-runs verified.

Baseline: `deno task test:pipeline` → **120 passed, 0 failed** (before any changes).
Final: `deno task test:pipeline` → **135 passed, 0 failed** (15 new tests across audit + follow-up + Codex feedback).

---

## Fixes Made

### Fix 1 — `lib/image-manifest.ts` — Wrong storage bucket for kitchen tools

`getImageBucket('kitchen_tool')` returned `'useful-items'` (bucket does not exist). Changed to `'kitchen-tools'` (the live bucket name). Added a test asserting the correct bucket value.

**Files:** `lib/image-manifest.ts:31`, `lib/image-manifest.test.ts`

---

### Fix 2 — `lib/openai-client.ts` + `lib/db.ts` — Nutrition micro-fields not written

`ingredient_nutrition` has `fiber`, `sugar`, `sodium` columns that were never populated.

- `NutritionData` interface: added `fiber: number | null`, `sugar: number | null`, `sodium: number | null`.
- Nutrition prompt: updated to request these fields (with `null` fallback if unknown).
- `upsertIngredientNutrition()`: added the three columns to the upsert payload (all `?? null`).

---

### Fix 3 — `lib/recipe-parser.ts`, `lib/import-helpers.ts`, `lib/db.ts`, `cli/import-recipes.ts` — 8 meal-planning columns and 2 step columns never written

**recipe_steps** had `thermomix_mode` (text) and `timer_seconds` (int) never set by the pipeline.

**recipes** had 8 columns never written: `planner_role`, `equipment_tags`, `meal_components`, `is_complete_meal`, `cooking_level`, `leftovers_friendly`, `max_household_size_supported`, `batch_friendly`. This was why all 292 DB drafts had empty `equipment_tags` and null `planner_role`.

Changes:

**`recipe-parser.ts`:**
- `ParsedRecipeData` step type: added `thermomixMode: 'open_cooking' | 'steaming' | null` and `timerSeconds: number | null`.
- `ParsedRecipeData` recipe type: added all 8 meal-planning fields.
- JSON schema: added `thermomixMode`, `timerSeconds` to step schema (both in `properties` and `required`); added all 8 meal-planning fields to recipe schema.
- System prompt: added "Meal Planning Metadata" section documenting the aside-block keys (`Rol:`, `Equipo:`, `Componentes:`, `Comida completa:`, `Nivel de cocina:`, `Apto para sobras:`, `Porciones máximas:`, `Batch cooking:`) and "Thermomix Mode and Step Timers" section.
- Validators: added checks for `thermomixMode` (enum), `timerSeconds` (number|null), and all 8 recipe-level fields.

**`lib/db.ts`:**
- `RecipeStepInsert`: added `thermomix_mode: string | null` and `timer_seconds: number | null`.
- `insertRecipeSteps()`: added both to the base row insert.
- `RecipeInsertData`: added all 8 meal-planning fields as optional.
- `createRecipe()`: writes all 8 fields (defaulting to `null`/`[]`/`false` where not supplied).

**`lib/import-helpers.ts`:**
- `buildRecipeSteps()`: maps `step.thermomixMode` → `thermomix_mode` and `step.timerSeconds` → `timer_seconds`.

**`cli/import-recipes.ts`:**
- `createRecipe()` call: passes all 8 meal-planning fields from the parsed recipe.
- Dry-run output: now logs `plannerRole`, `equipmentTags`, `mealComponents`, `cookingLevel`, `isCompleteMeal`, `leftoversFriendly`, `batchFriendly`.

**Tests updated (schema drift, not logic drift):**
- `lib/recipe-parser.test.ts`: `baseRecipe` fixture extended with `thermomixMode: null`, `timerSeconds: null` on the step, plus all 8 meal-planning fields.
- `cli/import-recipes.test.ts`: `makeStep()` and `makeParsed()` helpers extended with the same.
- `lib/step-ingredient-resolver.test.ts`: `createParsedRecipe()` and `createStep()` helpers extended with the same.

---

## Dry-Run Output

### `deno task pipeline:import -- --local --dry-run --limit 1`

Run against a single air-fryer recipe fixture (gitignored, removed after test):

```
--- DRY RUN OUTPUT ---
Name (EN): Garlic Chicken (Airfryer)
Name (ES): Pollo al ajillo (airfryer)
Difficulty: easy | Prep: 10min | Total: 30min | Portions: 4
Tags (3): Pollo, Air Fryer, Fácil
Ingredients (6):
  - 600 g chicken breast / pechuga de pollo
  - 6 clove garlic / ajo
  - 2 tbsp olive oil / aceite de oliva
  - 1 tsp paprika / pimentón dulce
  - 0 taste salt / sal
  - 0 taste pepper / pimienta
Steps (3):
  1. Mix the chopped garlic, oil, paprika, salt, and pepper in a bowl.
  2. Marinate the chicken with the mixture for 10 minutes.
  3. Place the chicken in the air fryer at 200°C and bake for 20 minutes, turning halfway through.
Kitchen tools (2): Air fryer, Mixing bowl
Tips: You can marinate the chicken the night before for more flavor.
Planner role: main | Complete meal: false | Cooking level: beginner
Equipment: air_fryer
Meal components: protein
  leftovers_friendly: true | batch_friendly: false
--- END DRY RUN ---

Summary:
  Total files: 1
  Imported this run: 1
  Failed this run: 0
  Ingredients in DB: 631
  Tags in DB: 89
  Kitchen tools in DB: 112
```

All new fields (`plannerRole`, `equipmentTags`, `mealComponents`, `cookingLevel`, `leftoversFriendly`, `batchFriendly`) are correctly extracted from the aside block and shown in the output. `max_household_size_supported` was not in the fixture aside so is null (expected).

### `deno task pipeline:images -- --local --dry-run --type all --limit 5`

```
Summary:
  Limit requested: 5
  Rows selected: 5
  Ingredient missing: 482
  Recipe missing: 288
  Kitchen tool missing: 38

Top pending items:
- [ingredient] Achiote paste / Pasta de achiote -> ingredients/images/ingredient_achiote_paste.png
- [ingredient] Almond flour / Harina de almendra -> ingredients/images/ingredient_almond_flour.png
- [ingredient] Almond granules / Granillo de almendra -> ingredients/images/ingredient_almond_granules.png
- [ingredient] Almond meal / Almendra molida -> ingredients/images/ingredient_almond_meal.png
- [ingredient] Anchovy fillet / Filete de anchoa -> ingredients/images/ingredient_anchovy_fillet.png
```

Storage bucket paths now correctly use `ingredients/`, `recipes/`, `kitchen-tools/` (the live buckets).

---

## Resolved Questions

| Question | Decision |
|----------|----------|
| Meal planning fields: extract from markdown? | Yes — extract from aside block |
| `thermomix_mode` / `timer_seconds`: pipeline or admin UI? | Pipeline — extracted from step text |
| es-ES locale: keep or drop? | Keep generating |
| `verified_at`: pipeline concern? | No — human review step only, pipeline never sets it |

---

## Open Questions (none blocking)

None. All original open questions resolved.

---

## Scripts Not Affected by Drift

- **`audit-data.ts`**: Reads via `db.ts` fetch functions — no drift.
- **`scan-entities.ts`**: Read-only markdown scanner — no drift.
- **`translate-content.ts`**: Table/column names all correct — no drift.
- **`backfill-translations.ts`** / **`translation-backfill.ts`**: es-ES locale retained as confirmed.
- **`upload-images.ts`**: Hardcodes `ingredients` bucket — correct for its purpose.

---

## Commits

**Audit phase (drift fixes):**

1. `fix(pipeline): correct kitchen_tool storage bucket name`
2. `fix(pipeline): add fiber, sugar, sodium to nutrition upsert`
3. `fix(pipeline): add meal-planning fields and step mode/timer to parser and db`
4. `fix(pipeline): log meal-planning fields in dry-run output`

**Follow-up phase (multi-source readiness + review feedback):**

5. `feat(pipeline): add English recipe support` — `hasRecipeContent()` recognizes English `### Ingredients` headers; system prompt accepts English-first H1 and English aside keys.
6. `refactor(pipeline): decontaminate recipe parser from Notion specifics` — rename `parseRecipeMarkdown` → `parseRecipe`; reframe prompt around source-agnostic conventions so future sources (URL scrapes, AI-generated, hand-written) can feed the same `ParsedRecipeData` boundary.
7. `refactor(pipeline): hoist meal-planning enums + tighten validators` — single source for `PLANNER_ROLES`, `EQUIPMENT_TAGS`, `MEAL_COMPONENTS`, `COOKING_LEVELS`, `THERMOMIX_MODES`; `hasRecipeContent` switched to a heading-level-tolerant regex; thermomix_mode prompt expanded with more "open lid" phrasings; new fixture-based parser test locks in round-trip of all meal-planning fields.
8. `fix(pipeline): align meal-planning enums with DB CHECK constraints + add db.ts payload tests` — Codex found that `MEAL_COMPONENTS` included `'snack'` (DB rejects), `COOKING_LEVELS` used `'advanced'` (DB uses `'experienced'`), and `EQUIPMENT_TAGS` was missing `'none'` (frontend type includes it). All would have caused the bulk import to fail at insert time. Added 6 payload-capturing tests for `createRecipe`, `insertRecipeSteps`, `upsertIngredientNutrition` to catch this drift class going forward.

**Real-world validation phase (2026-04-28 evening):**

End-to-end exercised by importing 12 air-fryer recipes (Chicken Breast, Salmon, Shrimp, Pork Chops, Meatballs, Fish Fillets, Tofu, Potato Wedges, Broccoli, Cauliflower, Carrots, Brussels Sprouts) into the live cloud DB. All 12 landed cleanly with `is_published=false`, all 8 meal-planning fields populated, and locales `[en, es, es-ES]` (Spain adaptation working).

Two real bugs surfaced and were fixed during the validation pass:

9. `fix(pipeline): gate thermomix step extraction on equipmentTags` — the system prompt was extracting `thermomixTime` / `thermomixTemperature` from any step with "X min" / "X°C" text regardless of the recipe's `equipment_tags`. Air-fryer recipes were landing with bogus `thermomix_time=480` and similar pollution on every step. Parser is now gated: `thermomix_*` fields stay null on every step unless `equipmentTags` includes `'thermomix'`. `timerSeconds` was widened to capture all timed actions (oven, air-fryer, stovetop, rest) — previously it was scoped to "non-Thermomix" only. New regression test in `recipe-parser.test.ts` locks in the gate.

10. `fix(pipeline): clarify ingredient vs kitchen-tool classification` — aerosol/spray products (cooking spray, "aceite en spray") were being randomly classified as either ingredients or kitchen tools across recipes. Parser prompt now codifies the rule: items APPLIED TO or BECOMING PART OF the food (sprays, oils, seasonings) are ingredients; items that HOLD, SHAPE, or SEPARATE the food (parchment paper, foil, plastic wrap, towels) are kitchen tools. Matches existing DB convention (`Baking paper`, `Wax Paper`, `Kitchen towel` already live in `kitchen_tools`).

11. `chore(pipeline): rename data/notion-exports → data/recipes-to-import` — folder name was a vestige of the original Notion-only era. Pipeline is source-agnostic now (per commit 6), so the directory name should match. Updated CLI default, error message, usage doc, gitignore, and `docs/operations/PIPELINE.md` tree diagram.

## Validation Summary

- 136 unit tests passing (was 135 before commit 9).
- 12 recipes round-tripped through the full pipeline: parse → entity match → DB insert → Spain adaptation → tracker update.
- 0 thermomix-field pollution across ~96 imported air-fryer recipe steps.
- 1 new ingredient (`kosher salt`) and 0 unexpected new entities created during the imports — entity matching is working.
- Discovered post-import data hygiene items (cooking-spray-as-tool, breadcrumb/panko duplicates with mismatched Spanish) are review-time concerns, not pipeline bugs.

## Cross-Contract Reference

The meal-planning enum constants in `lib/recipe-parser.ts` are mirrored from these canonical sources. Update there before changing them here:

| Enum | Canonical contract |
|---|---|
| `PLANNER_ROLES` | `supabase/migrations/20260415120000_recipe_role_model_extension.sql:112` |
| `MEAL_COMPONENTS` | `supabase/migrations/20260415120000_recipe_role_model_extension.sql:94` |
| `COOKING_LEVELS` | `supabase/migrations/20260410000001_add_meal_plans.sql:495` |
| `EQUIPMENT_TAGS` | `yyx-app/types/recipe.types.ts:72` (no DB CHECK; frontend type is canonical) |

*Authored by Claude Code, 2026-04-28.*
