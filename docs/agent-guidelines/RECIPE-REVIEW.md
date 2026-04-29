# Recipe Review Rubric

Reference for the `/review-recipe <name>` skill and any human reviewing a recipe by hand. Pairs with the recipe-metadata pipeline at `yyx-server/data-pipeline/cli/apply-recipe-metadata.ts`.

The reviewer's job: produce a YAML config at `yyx-server/data-pipeline/data/recipe-metadata/<slug>.yaml` that, once applied, takes a raw recipe to planner-ready (tagged + paired + described + bilingual). The Applier is dumb on purpose — every judgment call belongs in the YAML.

---

## How to use this rubric

1. Fetch the current recipe state. Prefer a local **recipe review snapshot** (see "Snapshot-first review workflow" below); fall through to live Supabase only when no snapshot is available or the recipe was created after the snapshot was exported.
2. Walk the **deterministic auto-checks** below and record any positive hits as YAML diffs.
3. Walk the **judgment-call checks** and decide what (if anything) needs changing. When unsure, flag in `requires_authoring.notes` rather than guess.
4. If any **unfixable-by-Applier** signal fires (`no_steps`, `few_ingredients`, `same_en_es_name` without an obvious ES name), set `requires_authoring.reasons` and STOP — do not fabricate content.
5. Capture `recipe_match.expected_recipe_updated_at` verbatim from the snapshot's `recipe.updated_at` (or the live row, when falling through). The Applier rejects the apply if the DB row has advanced since — do not reformat the value.
6. Set `review.reviewed_by_label` and `review.reviewed_at` (ISO 8601) — this is YAML-only attestation, never written to `recipes.verified_by`.

---

## Snapshot-first review workflow

Reviewing dozens of recipes by hitting Supabase per recipe is slow and noisy. The **recipe review snapshot** is a local-first export that captures the same review-critical state — recipe row, translations, ingredients (+ ingredient translations + measurement unit), steps, step translations, step ingredient links, kitchen tools (+ translations), pairings, tags, and global taxonomy (tag slugs, EN kitchen-tool names, measurement units) — in a single JSON file. Reviewers iterate from that snapshot; the live DB is only touched when a recipe is missing from it, the snapshot lacks the required taxonomy version, or apply later raises `stale_diff`.

**Producing a snapshot.** Run from `yyx-server/`:

```bash
deno task pipeline:export-review-snapshot --local --scope published
deno task pipeline:export-review-snapshot --local --scope published --label published-review
deno task pipeline:export-review-snapshot --local --manifest /tmp/recipes.txt
```

Snapshots are written to `yyx-server/data-pipeline/data/recipe-review-snapshots/<timestamp>_<label>.json` (immutable after creation). A `latest.json` pointer is updated to identify the most recent file. Snapshots are gitignored — they can be large and may include unpublished/draft content.

**Resolution order for the reviewer.** Read recipe state from the first source that has the recipe:

1. an explicit snapshot path passed by the user;
2. otherwise, the file referenced by `latest.json`;
3. otherwise (or if the recipe is not in the snapshot), live Supabase.

**Snapshot staleness — narrow definition.** A snapshot does not become stale just because time has passed. A snapshot is stale **for a specific recipe** only when the live `recipes.updated_at` differs from the snapshot's `recipe.updated_at` at dry-run/apply time. The apply RPC's existing stale-diff guard is the sole source of truth for this; the YAML's `recipe_match.expected_recipe_updated_at` carries the captured value forward verbatim. New recipes created after the snapshot was exported are simply "not in snapshot" — that is a fall-through, not staleness.

**On stale-diff at apply time.** Either (a) refresh the single recipe by re-fetching live state and re-running the reviewer, or (b) re-export the snapshot and re-run. Do not patch the snapshot in-place — snapshots are immutable.

**`apply-recipe-metadata` does not read snapshots.** Snapshots are review input only. Dry-run and apply both go through live Supabase, governed by the YAML's stale-diff guard.

---

## Quality checklist

### Deterministic auto-checks (a script can answer these)

1. **Missing units.** `recipe_ingredients.measurement_unit_id IS NULL` for any non-pinch ingredient.
2. **Zero quantity.** `recipe_ingredients.quantity = 0`.
3. **Zero prep time.** `recipes.prep_time = 0` and `total_time = 0` (the dual-zero is the real signal — single-zero may be intentional for raw assemblies).
4. **Portions = 1 on a multi-serving yield.** `recipes.portions = 1` combined with a primary-ingredient mass that yields >200 g of finished food is almost always an import default, not an intentional single-serve spec. Recompute portions from primary-ingredient mass divided by typical serving size for the dish category (cookies: ~20 g/each → ~30 portions for 600 g batter; soup: ~250 g/serving → ~4 portions per liter; dressings/sauces: ~30 g/serving → ~10 portions per 300 g; spreads/dips: ~30 g/serving). Adjust via `timings.portions` when the import default is clearly wrong; flag `requires_authoring.notes` only if the right number is genuinely ambiguous. Single-serve defaults that are correct (e.g. a one-portion smoothie sized for one person) stay at 1 — this check fires on the *yield-portions mismatch*, not on the value alone.
5. **Thermomix steps without equipment tag.** Step instructions mention "Thermomix", "Varoma", "TM6", or speed/temperature numerics, but `recipes.equipment_tags` does not include `thermomix`.
6. **Missing description or tips.** `recipe_translations.description IS NULL` or `tips_and_tricks = ''` for any locale the recipe supports.
7. **`es-ES` rows are retained, not stripped.** The import pipeline intentionally emits `en + es + es-ES`. `es-ES` is the override slot for future Spain-Spanish content; even when it currently mirrors `es` exactly, it stays. **Never** add `cleanup.delete_locales: ['es-ES']` — that wipes the override slot. The only legitimate use of `cleanup.delete_locales` is to remove a locale that genuinely should not exist for this recipe (e.g. an accidental third-party locale). The `es-ES = es` duplication is by design and not a defect.
8. **Published without planner role.** `recipes.is_published = true` and `planner_role IS NULL`. Flag in `requires_authoring.notes` for admin review. The reviewer never sets `is_published` — see the **Publishing policy** section below.
9. **No kitchen tools.** Zero entries in `recipe_kitchen_tools`. (Pantry recipes that genuinely need none — e.g. spice blends — can stay empty.)
10. **Step text vs structured Thermomix fields.** The cooking-guide renderer injects formatted Thermomix params via the `%thermomix%` placeholder (see `yyx-app/utils/thermomix/formatters.ts:168` — `instruction.replace('%thermomix%', '**…**')`). Three failure modes must be flagged:
  - **Hard-coded params in prose.** Instruction contains literal numerics like `28 min.`, `100 °C`, `vel. 4`, `speed 2`, `90 °F`, etc. — even if structured fields are also populated. The hard-coded text duplicates the structured render, drifts on metric/imperial switch, and ships locale mismatches (the EN renderer can't translate prose Spanish numerics). Mechanical grep on instruction text: `\d+\s*min`, `\d+\s*°[CF]`, `vel\.?\s*\d`, `speed\s*\d`. Fix via `step_text_overrides` — replace the prose params with `%thermomix%`.
  - **Structured fields populated, no `%thermomix%` token.** `thermomix_time`, `thermomix_speed`, or `thermomix_temperature` is set on the step but the instruction text never contains `%thermomix%`. The user sees the param strip below the step but no inline render. Fix via `step_text_overrides` — insert `%thermomix%` at the natural spot in the instruction.
  - **`%thermomix%` token with no structured fields.** Instruction contains `%thermomix%` but all three structured columns are NULL. The literal token ships to the user. Fix by populating the structured fields via `step_overrides`, or remove the token via `step_text_overrides` if no Thermomix specs apply.
11. **Step text vs ingredient list (text-level coherence).** Each ingredient *named in step instruction text* must appear in `recipe_ingredients` for the same recipe. Two sub-cases, both fixable via `step_text_overrides`:
  - **Wrong ingredient name.** Step text says "tomato stock" but `recipe_ingredients` has "Chicken bouillon"; ES says "cubos de caldo" while EN says "tomato stock". Fix by rewriting the offending instruction per-locale.
  - **Step references unknown ingredient.** Step instruction names an ingredient (e.g. "add the cilantro garnish") that does not exist in `recipe_ingredients`. Either rewrite the instruction to drop the reference or flag `requires_authoring.notes` if the ingredient is genuinely missing from the recipe and should be added (the YAML cannot mutate `recipe_ingredients` rows).
  This is the *text* check; the *link-table* check (`recipe_step_ingredients` rows misaligned with the step) is #12. Don't conflate them — text issues route to `step_text_overrides`, link-table issues route to `requires_authoring.notes` for admin cleanup.
12. **Step ingredient link mismatches.** `recipe_step_ingredients` must be coherent with both the step instruction and the recipe-level ingredient list:
  - A step that directly adds or handles a recipe ingredient should have that ingredient listed in `recipe_step_ingredients`, except when the step only handles a mixture made in an earlier step. Example: "Add zucchini and water" should link zucchini + water; "blend the soup until smooth" should not relist every ingredient already in the soup.
  - A `recipe_step_ingredients.ingredient_id` whose ingredient is not present in `recipe_ingredients` for the same recipe is an orphan link. Flag it; the step is claiming to use an ingredient the recipe does not list.
  - A `recipe_step_ingredients` row that names an ingredient not mentioned, added, handled, or clearly implied by the step text is suspect. Phrases like "all remaining ingredients" or "the reserved sauce" can justify the link; otherwise flag it.
  - For step **instruction / recipe_section / tip text** that is wrong but fixable (typos, voice fixes — usted→tú, gendered noun agreement, mistranslations that have a clean rewrite), use `step_text_overrides` (per-locale upsert into `recipe_step_translations`). `step_overrides` is for structured Thermomix fields only — it does not edit text.
  - The YAML applier does **not** mutate `recipe_step_ingredients` (the relationship table). If the relationship row itself is wrong (orphan link, missing link, wrong ingredient referenced), record it in `requires_authoring.notes` for admin cleanup. Reserve `requires_authoring.notes` for these structural cases — text-fixable issues belong in `step_text_overrides`.
13. **Non-complete-meal mains without pairings.** `planner_role = 'main'`, `is_complete_meal = false`, and no outgoing rows in `recipe_pairings`.
14. **Implausible quantities.** Sugar < 5 g in a sweet sauce, salt > 10 g per kg of meat, raisins > 80 g in a savory dish, etc. Use cuisine context.
15. **Non-pantry recipes without `meal_type` tag.** Admin form enforces `requiresMealType = recipe.plannerRole !== 'pantry'` (see `MealPlanningForm.tsx`). A non-pantry recipe with no `meal_type` tag is unplannable.
16. **`same_en_es_name`.** `recipe_translations.name` identical between `en` and `es`. Reviewer fixes via `name.es` override **only when the translation is unambiguous** (e.g. "Mongolian Beef" → "Res Mongola"). Anything subjective: flag `requires_authoring.reasons: ['same_en_es_name']`.
17. **`no_steps`.** `recipe_steps` is empty. Always flag `requires_authoring.reasons: ['no_steps']`. Never fabricate steps.
18. **`few_ingredients`.** `recipe_ingredients` has fewer than 3 entries. Almost always means the import was incomplete. Flag `requires_authoring.reasons: ['few_ingredients']` unless the recipe is genuinely 2-ingredient (e.g. matcha butter — confirm from name).
19. **Step tip placeholder text.** `recipe_step_translations.tip` containing emoji-only content, template strings ("tip here", "🙋 tip", etc.), or other obvious import-artifact placeholders. Clear them via `step_text_overrides` setting `tip: ''` (empty string), or replace with a meaningful tip if the dish has one. Easy to miss because tip text isn't surfaced on most cooking-mode screens by default — the placeholder ships to the user's per-step detail view.
20. **Spanish usted-imperative voice in step text.** Project convention is Mexican-Spanish **tú** (see Irmixy personality and `system-prompt-builder.ts`). The usted-imperative form is closed-vocabulary and detectable mechanically. Scan `recipe_step_translations.locale = 'es'` (and `es-ES` if present) `instruction`, `recipe_section`, and `tip` text against this violator vocabulary, matching as whole words at the start of a sentence or after punctuation:
    - **Cooking actions:** `Coloque`, `Añada`, `Agregue`, `Licúe`, `Pique`, `Baje`, `Cocine`, `Transfiera`, `Sirva`, `Enjuague`, `Mezcle`, `Retire`, `Vierta`, `Mueva`, `Pruebe`, `Sazone`, `Caliente`, `Hierva`, `Saltee`, `Fría`, `Hornee`, `Ase`, `Cueza`, `Reduzca`, `Tape`, `Destape`, `Voltee`, `Corte`, `Trocee`, `Pele`, `Lave`, `Escurra`, `Cuele`, `Bata`, `Revuelva`, `Incorpore`, `Espolvoree`, `Decore`, `Acompañe`, `Reserve`, `Deje`, `Use`, `Tome`, `Coja`, `Ponga`, `Quite`, `Cubra`, `Llene`, `Vacíe`, `Apague`, `Encienda`.
    - **Reflexives / negations:** `Asegúrese`, `Permita`, `Proceda`, `Continúe`, `Espere`, `No coloque`, `No añada`, `No deje`, etc.
    Each match → fix via `step_text_overrides` rewriting the locale's instruction (or `recipe_section` / `tip`) to the tú equivalent (`Coloca`, `Añade`, `Agrega`, `Licúa`, `Pica`, `Baja`, `Cocina`, `Transfiere`, `Sirve`, `Enjuaga`, …). Voice fixes are exactly what `step_text_overrides` exists for; do not route to `requires_authoring.notes`.
21. **Step-ingredient quantity / unit drift.** When `recipe_step_ingredients.recipe_ingredient_id` is non-null, the row carries its own `quantity` and `measurement_unit_id` — those should match the recipe-level `recipe_ingredients` row for the same ingredient (within rounding for unit conversions). Mismatch is almost always import drift (e.g. recipe-level cornstarch 30 g, step-level says 20 g). Walk every step ingredient against its recipe-level counterpart; flag any mismatch in `requires_authoring.notes` — the YAML applier cannot mutate `recipe_step_ingredients` (link table, same constraint as auto-check #12), so this routes to admin cleanup. The data is in the snapshot under `recipe.steps[].step_ingredients[]` joined to `recipe.ingredients[]`; no extra query needed.

### Judgment-call checks (require Claude's reasoning)

- **Planner role / meal components / is_complete_meal — re-decide from scratch.** **Do NOT trust the existing DB values.** Many recipes were imported with incorrect planner roles (e.g. complete-meal salads with salmon mis-coded as `side`, dips coded as `snack` when they're really `condiment`). For every review, decide independently:
  - **`role`** — what is this dish? `main` = a meal centerpiece (ingredient volume + protein/carb suggest it stands alone). `side` = accompaniment to a main. `snack` = ready-to-eat small portion. `dessert` = sweet end-of-meal. `beverage`. `condiment` = dip/sauce/dressing meant to season other food. `pantry` = ingredient or building block, not a finished dish.
  - **`is_complete_meal`** — does this single recipe deliver protein + carb + veg in one dish? Caesar Salad with Kale, Arugula, and Salmon is `main` + complete; plain Caesar Salad is `side` (or `main` only with `meal_components: [veg]` if the user adds protein themselves).
  - **`meal_components`** — which of `[protein, carb, veg]` does the dish contribute? A salmon-and-grain bowl is `[protein, carb, veg]`. A side salad is `[veg]`. A dressing is `[]` (it's a condiment, not a component).
  - **Quantify before claiming `carb` or `protein`.** Pattern-matching ("pancakes contain flour → carb"; "chicken dish → protein") rubber-stamps recipes that don't deliver enough of either component to count. Before adding `carb`, estimate **carb grams per serving** = total flour + grain + tortilla + bread + sugar mass divided by `portions`; floor is **~20 g/serving** (≈ one slice of bread). Before adding `protein`, estimate **protein grams per serving** = total meat/fish/eggs/legume mass × ~20-25% (typical protein density of cooked animal protein) divided by `portions`; floor is **~10 g/serving**. Worked example: Roman's Pancakes had 35 g flour total ÷ 8 portions ≈ 4 g flour/serving — well below the carb floor, so `meal_components` should not include `carb` even though pancakes "are" a carb dish in casual usage. Below floor → drop the component; the dish becomes a `[protein]`-only or `[]` recipe even if intuition disagrees.
  - **`alternate_planner_roles`** — when the same recipe could legitimately serve as more than one role (e.g. a hearty soup that works as `main` for a light lunch or `side` for dinner), list the alternates so the planner can pick contextually.
  - **Planner field inclusion is asymmetric.** Always include `role`, `meal_components`, and `is_complete_meal` in the YAML, even when they match the current DB value — these three are the role-decision audit trail. For every other planner field (`equipment_tags`, `cooking_level`, `leftovers_friendly`, `batch_friendly`, `max_household_size_supported`, `alternate_planner_roles`), follow the standard "write only what changes" rule from the rest of the schema; including them when they match the DB just creates no-op writes and clutters the YAML.
- **`cooking_level` calibrates Lupita-difficulty, not Sofía-difficulty.** Reviewers were guessing arbitrarily. Use this rubric:
  - **`beginner`** — the recipe is mostly Thermomix-automated or a single technique (one chop, one mix, one bake), uses common pantry ingredients, ≤8 ingredients, no tempering/folding/proofing/searing-then-deglazing, and a botched batch is still recognizable as the dish. Default for soups, blended sauces, dump-and-cook braises, simple breads.
  - **`intermediate`** — multi-step recipes that require sequencing (e.g. a sofrito built before the protein hits, a sauce reduced separately, two Thermomix cycles back-to-back), heat control beyond preset Thermomix temperatures, or knife work where dice size matters. Examples: most curries, layered casseroles, rice + protein + sauce mains, recipes with a Varoma + bowl coordination.
  - **`experienced`** — failure modes are subtle (curd-on-the-edge, underproofed dough, broken emulsion), require tasting-as-you-go, or use techniques (tempering chocolate, candying, lamination, spherification, multiple resting periods that gate next steps). Rare in the launch catalog; default to intermediate when in doubt.

  When uncertain between beginner and intermediate: pick beginner if the recipe is a standard Thermomix recipe (the appliance handles the cooking; the user mostly weighs and dumps) and pick intermediate if there's coordination across steps or vessels. When uncertain between intermediate and experienced: pick intermediate; experienced is reserved for recipes with failure modes that punish inattention.
- **Authentic seasoning balance.** A Mexican mole missing chocolate or chili is suspect. A Thai green curry without fish sauce or kaffir lime is suspect.
- **Portion size matches ingredient volume.** 4 portions from 200 g of pasta is wrong. 8 portions from 2 kg of beef is wrong.
- **Plausible Thermomix speeds.** Speed 1.5 for sautéing — fine. Speed 4.5 for sautéing — wrong, that's a blender speed. Speed 11 — invalid (max is 10 in numeric, plus `'spoon'`).
- **Equipment choices appropriate.** Varoma cycle for raw shrimp is suspicious if longer than 10 minutes. Oven called for a no-bake dessert is wrong. Thermomix called when the recipe is purely assembly is overkill.
- **Step coherence.** Each step should make culinary sense on its own: the action should be possible with the listed tool/settings, the time/temperature should match the technique, the step should have a clear output state, and it should not silently depend on an ingredient, mixture, or prep action that never appeared earlier. If the step is incoherent but can be corrected without fabricating missing procedure, use `step_overrides`; if fixing it would require inventing steps, ingredients, or intent, flag `requires_authoring.notes`.
- **Diet-tag attestation must match user-visible content.** Exclusion-style diet tags (`vegan`, `vegetarian`, `gluten_free`, `pescatarian`) are promises to the user, not loose categorization. Whenever you add or keep one of these tags, audit the recipe's description, `tips_and_tricks`, ingredient list, and step instructions for items that violate the promise. The hidden-violator pattern is the dangerous one — bouillon/stock tucked 8 ingredients deep, fish sauce as a background note, soy sauce as the wheat sneak in a "gluten-free" stir-fry. Walk the canonical violator vocabularies below explicitly, ingredient by ingredient.

  **Vegan violators:** any meat or poultry, any seafood (including anchovy paste), eggs, dairy (milk, cream, butter, ghee, yogurt, cheese — *every* cheese), honey, gelatin, lard, tallow, fish sauce, oyster sauce, Worcestershire (anchovy), `consomé`/bouillon/stock made from animals, animal-based broth cubes/powders, casein/whey-derived ingredients, lactose-containing flavorings.

  **Vegetarian violators:** any meat or poultry, any seafood (including anchovy and anchovy paste), gelatin, lard, tallow, fish sauce, oyster sauce, Worcestershire (anchovy), `consomé de pollo`/`consomé de res`/`caldo de pescado` and their bouillon/stock/cube/powder variants, rennet-set cheeses *only if the recipe is a vegetarian-strict promise* (most launch content treats microbial-rennet cheeses as fine — flag the contradiction in `requires_authoring.notes` rather than silently dropping the tag).

  **Pescatarian violators:** any meat or poultry, lard, tallow, chicken/beef bouillon or stock, animal-based broth cubes/powders. Seafood, eggs, and dairy are fine.

  **Gluten-free violators:** wheat, wheat flour, all-purpose flour, bread/breadcrumbs/panko, pasta (unless GF variant explicit), couscous, bulgur, semolina, farro, spelt, rye, barley, malt/malt vinegar/malt extract, beer, **soy sauce** (unless `tamari` is named — most soy sauces contain wheat), bouillon cubes/powders (frequently contain wheat fillers — flag if uncertain), seitan, hoisin sauce (often wheat-based), some teriyaki sauces, communion wafers in description copy. Oats are gluten-free *only* when explicitly labelled certified GF; flag uncertain oats.

  **Sweep order, every time:** `recipe_ingredients` (every row, including the small-quantity sneak-ins like a teaspoon of soy sauce) → `recipe_step_translations.instruction` (steps occasionally introduce ingredients not in the formal list) → `recipe_translations.tips_and_tricks` (the most common hiding spot — "serve with crusty bread", "garnish with feta") → `recipe_translations.description` (less common but still seen) → `recipe_translations.scaling_notes`. Do not rely on tag membership to reassure you; every audit is from scratch.

  **Resolution:** rewrite the offending content (preferred — surface a plant-based alt alongside the existing suggestion) or drop the tag. Never ship the contradiction. When uncertain on a single ingredient (e.g. is this brand of soy sauce GF?), drop the tag and flag the question in `requires_authoring.notes` — false positives on diet promises are user-trust issues, false negatives are not.
- **`one_pot` means "complete meal in one vessel" — not "single cooking vessel".** This tag is over-applied to anything cooked in the Thermomix bowl alone, but by that bar nearly every Thermomix recipe qualifies and the tag becomes meaningless. Apply `one_pot` only when **all** of the following hold:
  1. **The recipe yields a complete meal** (`planner.is_complete_meal: true` or, equivalently, `meal_components` covers the full plate — typically `[protein, carb, vegetable]` or `[protein, vegetable]` for low-carb mains). A soup that's only a starter is not one-pot. A protein cooked alone in the bowl is not one-pot.
  2. **All cooking happens in the same vessel.** Thermomix bowl + Varoma steaming attachment counts as one vessel (it's a single appliance running one cycle); Thermomix + a separate stovetop pan or oven tray does not. Pre-cooking pasta in a different pot disqualifies it.
  3. **Plating doesn't require additional cooked components.** Garnishes (cilantro, lime, a drizzle of oil) are fine; "serve with rice" or "serve with bread you toasted separately" disqualifies the tag.

  Default to omitting `one_pot`. A recipe can be quick, easy, low-effort, AND not one-pot — those qualities are captured by other tags. If you have to argue for the tag, drop it.
- **`kid_friendly` is a promise, not a vibe — default OFF.** This tag is over-applied. Reviewers see "looks like family food" and tag it; users then filter on it and get burned by anything a typical 5–8-year-old would refuse. Apply `kid_friendly` **only** when **all** of the following hold:
  1. **Heat is low or absent.** No raw chiles, no measurable cayenne/chile powder beyond a trace, no horseradish, no wasabi, no pickled jalapeños as a primary flavor. Trace heat used as background seasoning is fine; if a child would notice it on the first bite, the tag is wrong.
  2. **Dominant flavors are familiar to a Mexican-launch child audience.** Pasta, rice, chicken, ground beef, mild cheese, simple tomato/cream sauces, breaded proteins, common breakfast items. Not: assertive fish (anchovy, sardine), strong fermented flavors (blue cheese, kimchi, fish sauce as a foreground note), bitter greens as the main vegetable, organ meats, raw onion as a finishing element.
  3. **Texture is approachable.** No mostly-raw vegetables as the main component, no heavy seed/nut chunks in a savory dish, no chewy or rubbery proteins (octopus, certain offal). Smooth, soft, or crunchy-crispy is fine; slimy or tough is not.
  4. **No alcohol-as-flavor.** Cooked-off splash for braising is fine. A pasta sauce whose name is "wine sauce" is not.
  5. **The recipe is plausibly something a parent would serve a child without negotiating.** If you have to argue for the tag ("kids could try it…"), drop it.

  Default to omitting `kid_friendly`. When unsure, leave it off and flag in `requires_authoring.notes` with the specific concern. Removing an over-applied `kid_friendly` is a normal and welcome outcome of review — the rubric does NOT treat it as a regression.
- **`make_ahead` means "prep lands hours/days before serving" — not "leftovers reheat fine".** This tag is over-applied to any recipe that survives storage; the planner uses `make_ahead` to surface recipes that genuinely save time on serving day, so over-tagging dilutes the filter. The bar — apply `make_ahead` only when **all** of the following hold:
  1. **A substantial chunk of the recipe can be prepped in advance** — full cooking, full assembly, full mixing — not just one passive step like overnight marination. "Marinate the chicken overnight" is a step within the recipe, not the recipe being make-ahead.
  2. **The advance portion stays good for at least 4 hours** at refrigerator or freezer temp without quality loss. "Improves with rest" (cookies that mellow, stews that deepen, doughs that ferment) is the strong signal. "Loses crispness within an hour" disqualifies.
  3. **The serving-day step is brief** — reheat, slice, dress, plate, bake-from-cold. If the user still needs 30+ minutes of active work day-of, the make-ahead value is mostly lost and the tag is misleading.
  4. **Distinct from `leftovers_friendly`.** Apply `leftovers_friendly` when "the cooked dish reheats well" — make_ahead is the planning-side promise that "you can intentionally split prep across time." Pancakes are leftovers-friendly (reheat fine) but not make-ahead (no one intentionally pre-makes pancakes 2 days early). Stews and lasagna are typically both. Quick stir-fries are neither.

  Default to omitting `make_ahead`. If the recipe can survive storage but isn't *designed* to be split across time, that's `leftovers_friendly`, not make_ahead. Removing an over-applied `make_ahead` is a normal and welcome outcome of review.
- **Spanish voice/register follows Irmixy: tú, never usted.** The runtime source of truth (`docs/references/IRMIXY-PERSONALITY.md` and `buildPersonalityBlock()` in `system-prompt-builder.ts`) says Spanish should use **tú**. Auto-check #20 catches the imperative-form drift mechanically (Coloque → Coloca, Añada → Añade, etc.); this judgment bullet covers the cases the regex misses: subjunctives, indirect requests, second-person object pronouns ("le" vs "te"), and descriptive text in `description.es`, `tips_and_tricks.es`, `scaling_notes.es`. Use natural Mexican-Spanish tú phrasing throughout. Existing usted text is legacy drift, not the target voice; do not propagate it into new reviewer-authored content.

---

## Schema gotchas

These trip every first-time reviewer. Internalize them.

- **`recipe_steps.order`** — NOT `step_order`. A column-name typo on PostgREST returns null silently, never errors.
- **`recipe_steps.thermomix_temperature`** — NOT `thermomix_temp`. Unit lives in `thermomix_temperature_unit` and is `'C'` or `'F'` (single character), NOT `'celsius'` / `'fahrenheit'`.
- **`recipe_ingredients.measurement_unit_id`** — string FK to `measurement_units.id` (e.g. `'g'`, `'clove'`, `'unit'`), NOT free text. Bogus IDs silently get rejected by the FK; missing FK on an existing row leaves the field null. Validate units against snapshot `taxonomy.measurement_units[]`; only query live `measurement_units` when using live fallback.
- **`recipe_translations.description`, `recipe_translations.tips_and_tricks`, `recipe_translations.scaling_notes`** — these are the canonical text fields. The matching columns on `recipes` itself either don't exist (`scaling_notes` was migrated out in `20260417225253`) or are stale. Always write to `recipe_translations`.
- **No cross-language fallback.** `en` and `es` are independent user groups. A Spanish user must never see English content, and vice versa. Never store base content under a regional code.
- **`recipes.verified_by`** — UUID FK to `auth.users`, reserved for admin-UI verification. Reviewer attestation goes in YAML's `review:` section, NOT this column.
- **PostgREST silently returns null for non-existent columns.** When fetching for review, double-check column names against the live schema if a value looks suspicious.
- **`kitchen_tools.set[].name_en` must match `kitchen_tool_translations.name` exactly — including trademark glyphs.** The DB stores `Thermomix® Varoma` (with the ® registered-trademark symbol) and `Thermomix®` for the appliance. A YAML that writes `Varoma` or `Thermomix Varoma` (no ®) will hard-fail at apply with an "ambiguous name" or "tool not found" error. Copy names from snapshot `taxonomy.kitchen_tool_names_en[]`; only query `SELECT name FROM kitchen_tool_translations WHERE locale = 'en' ORDER BY name` when using live fallback. No auto-create — taxonomy stays human-curated.
- **`recipes.equipment_tags` taxonomy is lowercase free strings, conventionally `[thermomix]`.** The schema accepts `z.array(z.string().min(1))` (no enum) but the project convention is the lowercase appliance family. Do not write `Thermomix`, `TM6`, `varoma`, or other variants — match what existing YAMLs in `data-pipeline/data/recipe-metadata/*.yaml` use. As of 2026-04, `thermomix` is the only accepted value.
- **`recipe_pairings` directionality: `role` describes the *target's* role in the bundle, with the source as the implicit `main`.** Pairings are written from the centerpiece outward — the recipe whose YAML you are editing is `source_recipe_id` (the main), and each entry's `target_name_en` is the partner. The `role` field describes what the target is *to the source*, not what the source is to the target. Worked example, reviewing **Chicken Tinga** (a `main`):
  ```yaml
  pairings:
    set:
      - target_name_en: 'Mexican Rice'
        role: side       # Mexican Rice is the side; Chicken Tinga is the implicit main.
        reason: 'Classic Mexican plate — neutral starch absorbs the tomato-chipotle sauce.'
      - target_name_en: 'Refried Beans'
        role: side       # Beans are the side; same implicit main.
        reason: 'Adds a second protein and a creamy texture contrast.'
  ```
  The bundle-builder (`yyx-server/supabase/functions/meal-planner/bundle-builder.ts`) only fetches pairings where `source_recipe_id IN (primary_candidates)` — pairings always flow main → component, never the other way. **When reviewing a non-`main` recipe (side, condiment, dessert, beverage), default to skipping `pairings` entirely.** The planner inserts that recipe via the *main's* outgoing pairings, not its own. List a non-main's pairings only in the rare case where the recipe is genuinely also viable as a `main` (covered by `alternate_planner_roles`) and the pairings make sense from that role.

---

## Publishing policy

**Publishing is admin-only. The reviewer never sets `is_published` in the YAML — in either direction.** Always omit the field, which preserves the current DB value. Publishing a recipe makes it discoverable to real users; that is an editorial / business decision (timing of release, marketing alignment, content batching) that lives outside the reviewer's role. Quality-gating recipe content is the rubric's job; flipping the publish bit is the admin's.

Auto-check #7 (published without `planner_role`) catches a *symptom* of broken publish state. The reviewer's response to it is to flag in `requires_authoring.notes`, not to fix `is_published`.

When you encounter publish-related concerns, the only correct outcomes are:

- **Recipe meets all quality criteria but is unpublished:** mention it as a positive readiness signal in `requires_authoring.notes` (e.g. "Ready to publish — all rubric checks pass, awaiting admin sign-off") so an admin can act. Do not set `is_published: true`.
- **Recipe is published but fails one or more quality criteria:** flag the failing criteria in `requires_authoring.notes` so an admin can decide whether to unpublish, fix the gaps, or accept the trade-off. Do not set `is_published: false`.
- **Recipe's publish state matches its quality state:** do nothing. Omit `is_published` from the YAML.

Quality criteria worth checking when writing the readiness note:

1. `requires_authoring.reasons` is empty (no fabrication-blocked gaps).
2. `planner.role` is set to a non-null value.
3. The recipe has a `meal_type` tag — unless `planner.role = 'pantry'`, in which case `meal_type` is not required (mirrors `MealPlanningForm.tsx` which enforces `requiresMealType = recipe.plannerRole !== 'pantry'`).
4. EN and ES translations both exist for `name`, `description`, and `tips_and_tricks`.
5. The recipe has at least one ingredient and at least one step (the `no_steps` / `few_ingredients` guards are not tripped).

`is_published` and `recipes.verified_by` are independent bits. Verification (admin-UI button) attests that a human reviewed the recipe; publishing makes it discoverable. The reviewer never touches `is_published` *or* `verified_by`.

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

**Timestamp format.** Postgres returns `updated_at` as `2026-03-17 20:22:55.099866+00` (space separator, microseconds, two-digit offset). Convert to canonical ISO 8601 before writing the YAML: `2026-03-17T20:22:55.099866+00:00` — `T` separator, **preserve the microseconds**, full `+00:00` offset. Truncating to seconds risks a `stale_diff` rejection when the live row's microsecond differs. The schema's `Date.parse()` is permissive enough to accept either form, but canonical ISO is the contract.

---

## Things the Reviewer never does

- **Fabricate steps or ingredients.** Hand back to admin UI via `requires_authoring`.
- **Auto-create tags or kitchen tools.** Taxonomy decisions stay with humans.
- **Touch `recipes.verified_by`.** Reserved for admin-UI verification.
- **Translate UI strings or i18n keys.** Reviewer touches recipe content only.
- **Write to `name_en` to "fix" a stub.** EN is the source of truth for `name`. ES gets the override (`name.es`) when EN/ES collide on a stub translation.

---

## Known limitations

These are gaps the rubric cannot mechanically close. Reviewers should be aware of them, but no rubric tightening will make them go away.

- **Step-text-vs-ingredient name drift when the link is correct.** Auto-check #11 catches step text that names an ingredient missing from `recipe_ingredients`, and auto-check #12 catches `recipe_step_ingredients` link-table mismatches. But a step that says "beef loin" while the recipe lists "beef flank" — *with* a correct `recipe_step_ingredients` link to the flank — looks fine to both checks: the link is consistent with the ingredient list, and the step text references *something* in the recipe (just by the wrong name). This silent drift only surfaces when a reviewer notices the prose / ingredient mismatch by reading both. Treat it as a careful-read item; do not invent a rule that would over-flag legitimate paraphrase ("the meat" referring to flank steak is fine).
