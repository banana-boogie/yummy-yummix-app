# Meal-Planner Scoring System

> **Audience:** engineers and product folks who need to understand how
> `generate_plan` decides which recipes go in which slots, why a particular
> recipe was chosen, and how to tune behavior.
>
> **Source of truth (code):** `yyx-server/supabase/functions/meal-planner/`
> **Source of truth (spec):** `product-kitchen/repeat-what-works/design/ranking-algorithm-detail.md`
> **Single config object:** `scoring-config.ts` → `SCORING_CONFIG_V1`

---

## 1. High-level overview

When a user asks for a meal plan, the planner has to decide, for each empty
slot in their week, **which recipe (or recipes) to put there**. It does this in
five passes:

1. **Classify** each requested slot — what kind of slot is it?
   (cook / leftover-target / weekend-flexible)
2. **Retrieve** a small candidate set per slot — recipes that can plausibly
   fill it (right role, right meal type, no allergen conflict).
3. **Score** every candidate against every slot using a 7-factor model that
   sums to 100 points.
4. **Assemble** the week using beam search: try multiple candidate orderings
   in parallel, keep the highest-scoring partial weeks, and grow them slot by
   slot.
5. **Bundle** each chosen primary recipe with explicit pairing partners
   (sides, condiments) so a slot returns a complete meal idea rather than a
   single dish.

The output is one or more **plans** (only the best is persisted), each
containing **slots**, each containing **components** (the primary recipe plus
zero or more paired sides/condiments).

The scoring system has two important properties:

- **Configurable.** Every weight, threshold, bonus, and penalty lives in
  `SCORING_CONFIG_V1`. Nothing is hard-coded outside that file. Tuning the
  ranking is a code change in one place.
- **Mode-aware.** First-week users (no plan history) get a different weight
  profile that boosts time fit + verified content and reduces ingredient
  overlap (which needs cook history to be meaningful). Nutrition stays at
  the full weight because `nutrition_goal` is explicit profile input — it
  doesn't need history to be reliable. The goal is to feel reliable on day
  one, then become more nuanced once we have signal.

---

## 2. The pipeline at a glance

```
generate_plan(weekStart, dayIndexes, mealTypes, options)
    ↓
[1] slot classification           (slot-classifier.ts)
    ↓
[2] candidate retrieval per slot  (candidate-retrieval.ts)
    ↓
[3] scoring (per candidate)       (scoring/index.ts + scoring/*.ts)
    ↓
[4] week assembly (beam search)   (week-assembler.ts)
    ↓
[5] bundle building per slot      (bundle-builder.ts)
    ↓
[6] persistence + response        (plan-generator.ts)
    ↓
{ plan: { slots: [...] }, isPartial, missingSlots, warnings }
```

Each step is a pure module (with the exception of step 6) and is unit tested
in isolation. The `plan-generator.ts` orchestrator is what stitches them
together and is the only module that touches the database.

---

## 3. Slot classification

**File:** `slot-classifier.ts`

A slot is the (day, meal-type) pair the user asked us to fill, plus a derived
`slotType` that drives later scoring decisions.

### Canonical meal types

User input `mealType` can be any string the frontend sends; we normalize to
six canonical types in `meal-types.ts`:

| Canonical | Aliases mapped here |
|---|---|
| `breakfast` | `breakfast`, `desayuno` |
| `lunch` | `lunch`, `comida` (Mexican Spanish for midday meal) |
| `dinner` | `dinner`, `cena` |
| `snack` | `snack` |
| `dessert` | `dessert` |
| `beverage` | `beverage`, `bebida` |

Any other input throws `Unknown meal type: <input>` — validation happens at
the edge function boundary.

This mapping matters because later, `MEAL_TYPE_PRIMARY_ROLES` decides which
`planner_role` recipes can serve as the primary component for each canonical
type (e.g., `dinner` only accepts recipes with `planner_role: 'main'`).

### Slot types

After the meal type is canonicalized, the classifier assigns a `slotType`:

| `slotType` | When |
|---|---|
| `cook_slot` | Default — the user is cooking that meal. |
| `leftover_target_slot` | Triggered in two cases: (a) the day is flagged as busy, or (b) the slot is `lunch` or `dinner` and `autoLeftovers: true` (default). In case (b) the classifier marks the slot as a leftover target if a valid prior `lunch` or `dinner` source exists within the 24h window; sources are claimed at most once. If no valid upstream source exists at assembly time the assembler falls back to treating the slot as a `cook_slot`. |
| `weekend_flexible_slot` | The day index is in `WEEKEND_DAY_INDEXES` (Sat/Sun, indexes 5–6). Weekend slots get a larger time budget and tolerate harder recipes. |

Busy days are NOT a slot type of their own. They influence scoring through:
- a tighter `timeBudget` (`busyDay: 30` minutes),
- the `busyCookSlot` sub-weight profile (heavier difficulty + time-compat
  pressure than a normal cook_slot),
- the `busyDayCoveredByLeftovers: +8` assembly bonus when a leftover from
  earlier in the week feeds the busy day.

### Planning order

Slots are planned in **leftover-source priority order**: cook slots that will
feed downstream leftover targets are scheduled first, so by the time we plan
the leftover target itself we know which source recipe it should reuse.
Within each priority tier, slots are planned in (dayIndex, mealType) order.

---

## 4. Candidate retrieval

**File:** `candidate-retrieval.ts`

For each slot, we fetch a bounded set of recipes that could plausibly fill it.
The retrieval is a single SQL query (split into two parallel `IN`/`OVERLAPS`
queries that get deduped) followed by an in-memory shortlist.

### Hard SQL filters

All applied at the database layer:

- `is_published = true`
- `planner_role != 'pantry'` (pantry items are never standalone slot fillers)
- `planner_role IN (mealType.primaryRoles)` **OR**
  `alternate_planner_roles && (mealType.primaryRoles)` (recipes can fit a
  meal slot via either their primary role or any alternate role they declare)

### Role-conditional meal-component gate

There is **no per-slot "expected components" gate** at retrieval time — the
expected-components list exists on the slot for persistence and response
shaping, but retrieval doesn't filter against it.

What retrieval does filter on is a simpler, role-conditional gate
(`satisfiesRoleConditionalMealComponents`): if **any** of the candidate's
roles (primary `planner_role` or any entry in `alternate_planner_roles`) is
in `ROLES_REQUIRING_MEAL_COMPONENTS` (main/side), then `meal_components`
must be non-empty. Recipes whose roles are purely snack/dessert/beverage/
condiment bypass the gate entirely.

`is_complete_meal` is **not a bypass** for this gate. A complete meal still
needs non-empty `meal_components` if it's a main or side. Component
coverage for a slot happens later in bundle-building (§7), not at retrieval.

### Allergen and dislike pre-flagging

The retrieval also enriches each candidate row with two booleans:

- `hasAllergenConflict` — set if the recipe's canonical ingredient keys
  intersect the user's profile allergens, using word-boundary matching from
  `_shared/allergen-filter.ts`.
- `hasDislikeConflict` — set if the recipe's ingredients intersect the user's
  explicit profile dislikes.

Locale matters here: ingredient names are passed through
`_shared/ingredient-normalization.ts:normalizeIngredients` before matching, so
the Spanish `pollo` correctly matches the canonical `chicken` allergen.

These booleans become **hard rule violations** later in the scorer (§6).

### Shortlist + bounding

The full retrieval returns up to ~hundreds of candidates per slot. Before
scoring, `shortlistCandidatesForSlot` ranks them by a cheap heuristic
(time-fit estimate, difficulty match, leftover-source eligibility, verified
status) and trims to:

- `RETRIEVAL_LIMITS.cookSlotTopN: 30` candidates per slot,
- of which `RETRIEVAL_LIMITS.cookSlotBeamPerState: 12` are considered per
  beam state during assembly.

### Thin-catalog detection

If the post-shortlist candidate pool is too small to plan a real week, we
surface `LIMITED_CATALOG_COVERAGE` warnings. Triggers from `THIN_CATALOG`:

- `totalPublishedThreshold: 30` — fewer than 30 **unique viable shortlisted
  candidates across all requested slots** (after locale/title filter + role
  gate + allergen/dislike annotation). Emits `LIMITED_CATALOG_COVERAGE:total=<N>`.
- `viableCandidatesPerSlotThreshold: 8` — fewer than 8 viable per individual
  slot. Emits `LIMITED_CATALOG_COVERAGE:slot=<slotId>:n=<N>`.
- `restrictionCoverageRatioThreshold: 0.30` — **currently defined but not
  wired.** The constant exists in `SCORING_CONFIG_V1` as a placeholder but
  no code path consumes it. Future work: emit a warning when user
  restrictions filter out more than 70% of the candidate pool.

Thin-catalog warnings don't block plan generation; they tell the caller "this
plan is best-effort because the catalog is the bottleneck." Empty catalog
(zero unique viable candidates across all slots) is a hard error — see §8.

---

## 5. Scoring — the 100-point model

**File:** `scoring/index.ts` (orchestrator) + 7 factor files.

Each candidate-slot pair gets a single number (0..100) that's the weighted sum
of seven factor scores. The factors and their normal-mode weights:

| Factor | Weight | First-week trust |
|---|---:|---:|
| Taste + Household fit | **25** | 25 |
| Slot fit | **20** | 20 |
| Time fit | **15** | **20** ↑ |
| Ingredient overlap | **15** | **10** ↓ |
| Variety | **10** | 10 |
| Nutrition | **10** | **5** ↓ |
| Verified | **5** | **10** ↑ |
| **Total** | **100** | **100** |

The shape of the score: each factor produces a `raw ∈ [0, 1]` value, then
multiplies by its weight. The orchestrator sums the weighted values and
optionally subtracts the alternate-role penalty (§6).

### 5.1 Taste + Household fit (25 pts)

**File:** `scoring/taste-household-fit.ts`. **Spec:** §4.1

Blends seven sub-signals. Each contributes a sub-weighted term to a normalized
taste score, which is then combined with household-complexity:

```
taste_norm = clamp01(
    0.30 * pos01(recipeAffinity)      // cooked-this-recipe history (−1..1 → 0..1)
  + 0.20 * pos01(cuisineAffinity)     // implicit + explicit cuisine prefs
  + 0.15 * pos01(proteinAffinity)     // implicit protein-type prefs
  + 0.10 * pos01(mealTypeAffinity)    // implicit meal-type prefs
  + 0.15 * explicitIntent             // session intent (currently 0, not wired)
  + 0.10 * familyFavorite             // cooked ≥3 times → 1, ==2 → 0.5
  - 0.20 * recentRepeatPenalty        // cooked ≤7d → 1, ≤14d → 0.6, ≤21d → 0.3
)

taste_household = 0.8 * taste_norm + 0.2 * householdComplexityFit
```

`pos01(x)` maps a bipolar signal in `[−1, 1]` to `[0, 1]` via
`(clamp11(x) + 1) / 2`. The four affinity signals are bipolar (a negative
score means the user dislikes this cuisine/protein/etc.), so they get
squashed to non-negative before weighting. `familyFavorite` and
`recentRepeatPenalty` are already non-negative and are used directly.

`householdComplexityFit` rewards complete-meal, batch-friendly,
leftovers-friendly recipes when household size ≥ `HOUSEHOLD.largeThreshold`
(currently 3). For smaller households it returns a neutral 0.5 — household
size doesn't favor or disfavor anything.

`recipeAffinity` itself is a mini-blend (50/30/20) of cook count proxies for
rating, completion, and repeat — see `recipeHistoryAffinity()`. (Real ratings
are deferred to Plan 10; today we use cook count.)

### 5.2 Slot fit (20 pts)

**File:** `scoring/slot-fit.ts`. **Spec:** §4.3

The shape depends on `slotType`:

| Sub-weight | `cook` | `busyCookSlot` | `weekend` | `leftoverSource` |
|---|---:|---:|---:|---:|
| difficulty | 0.50 | **0.55** | 0.50 | 0.45 |
| timeCompat | 0.30 | **0.40** | 0.30 | 0.20 |
| householdComplexity | 0.20 | **0.05** | 0.20 | — |
| leftoversEligible | — | — | — | 0.15 |
| leftoverYield | — | — | — | 0.20 |

Notes:
- `difficultyFit` matches recipe difficulty against user `skillLevel`. On
  busy days, only `easy`/`beginner` recipes get full marks.
- `timeCompat` uses `resolveTimeBudget(slotType, isBusyDay, userMaxWeeknightMinutes)`
  to derive the budget — see §5.3.
- `weekend_flexible_slot` tolerates harder recipes than `cook_slot`.
- `leftoverSource` is the variant for cook slots that are *also* expected to
  produce leftovers for a downstream leftover-target slot. It rewards
  `leftovers_friendly` recipes with high portion counts.

### 5.3 Time fit (15 pts)

**File:** `scoring/time-fit.ts`. **Spec:** §4.4

```
timeFit = clamp01(1 - max(0, totalTimeMinutes - budget) / max(budget, 1))
```

Where `budget` comes from `resolveTimeBudget`:

- `weekend_flexible_slot` → `TIME_BUDGETS.weekend = 120` min
- busy-day `cook_slot` → `TIME_BUDGETS.busyDay = 30` min
- otherwise → `userMaxWeeknightMinutes` (if user set it) or
  `TIME_BUDGETS.weeknightDefault = 45` min

A recipe with no `total_time` gets a neutral 0.5 (we can't penalize for
missing data without driving every untimed recipe out of the rankings — see
§9 for the philosophical trade-off).

### 5.4 Ingredient overlap (15 pts)

**File:** `scoring/ingredient-overlap.ts`. **Spec:** §4.6

Two sub-signals at 0.55 / 0.45 weights:

- `weeklyOverlap` — how many of this recipe's ingredients are already used
  elsewhere in the week being assembled. Higher overlap → less new shopping
  → higher score. Reads from `state.ingredientIdUsage` which is updated
  every time the assembler commits a recipe to a slot.
- `pantryFriendly` — how well this recipe's ingredient set aligns with
  pantry staples, computed inside `scoreIngredientOverlap()` from
  `candidate.ingredientKeys` combined with the user's implicit ingredient
  preferences. Not pre-computed at retrieval.

This is the factor that rewards "if you're already buying garlic for
Tuesday, choose Wednesday's recipe that also uses garlic."

### 5.5 Variety (10 pts)

**File:** `scoring/variety.ts`. **Spec:** §4.5

Penalties + a small bonus, all relative to the assembled week state:

```
variety_norm = clamp01(
    0.40 * (1 - adjacentProteinPenalty)   // same protein day-1 or day+1?
  + 0.25 * (1 - cuisineRepeatPenalty * cuisineAffinityScale)
  + 0.20 * (1 - recentRecipePenalty)      // cooked recently? linear over 21d
  + 0.15 * noveltyBalanceBonus            // novel = not recent + not in week
)
```

Key thresholds from `VARIETY_LIMITS`:

- `adjacentProteinWindow: 1` — same protein on the immediately adjacent day
  triggers full 1.0 penalty (the 0.40 sub-weight then drops a full 0.40
  out of variety_norm).
- `weeklyCuisineRepeatThreshold: 3` — the candidate's primary cuisine is
  compared against the count of that cuisine **already assigned** in the
  week state. When that existing count is ≥ 3 (meaning the current
  candidate would be the 4th+ occurrence), the cuisine penalty goes full.
  Below that, penalty scales linearly as `count / threshold`.
- `recentRecipeWindowDays: 30` — a recipe cooked within the last 30 days
  incurs a linearly-decaying recent-recipe penalty (full penalty in the
  same week, fading to zero at 30 days). This window matches
  `loadCookHistory`'s default `sinceDaysAgo = 30`, so the cook-history
  data and the variety penalty agree on what "recent" means.
- `firstWeekNoveltyCap: 1` — in first-week-trust mode, only the first novel
  recipe per week gets the full 0.6 novelty bonus; subsequent novels get
  just 0.1.

`cuisineAffinityScale` exists so users who genuinely love Mexican food
aren't forced into European cuisine for variety: their preferred cuisine
gets a reduced repeat penalty.

### 5.6 Nutrition (10 pts)

**File:** `scoring/nutrition-fit.ts`. **Spec:** §4.7

**Stubbed today.** The factor returns a constant:

- `nutritionGoal === "no_preference"` → `NUTRITION_DEFAULT_NORM_WHEN_NO_GOAL = 1.0` (full 10-pt contribution)
- Any other goal (`eat_healthier`, `lose_weight`, `more_protein`, `less_sugar`) → `NUTRITION_DEFAULT_NORM_WHEN_MISSING_DATA = 0.5` (5-pt contribution)

The `NUTRITION_HEALTHIER_SUBWEIGHTS` config object (0.35 fiberHealth /
0.30 proteinDensity / 0.20 lowSugar / 0.15 lowSodium) is defined in
`scoring-config.ts` but **no code path consumes it yet**. Fleshing this
factor out depends on the nutrition data pipeline producing reliable
per-recipe macros — see §13.

### 5.7 Verified (5 pts)

**File:** `scoring/verified-boost.ts`. Trivial: returns 1.0 if the recipe has
a non-null `verified_at`, else 0. Acts as a small tiebreaker that nudges
human-curated content up.

### 5.8 The orchestrator

`scoring/index.ts:scoreCandidate` does:

1. Pick weight profile (`pickWeights(state.mode)`).
2. Run all 7 factor functions in parallel.
3. Sum weighted contributions.
4. Apply `SCORE_MODIFIERS.primaryRolePreferencePenalty: 5` if the candidate
   matches the slot only via `alternate_planner_roles` (per
   `recipe-role-model.md §6.3`). Small enough that a great alternate match
   still beats a mediocre primary match, but big enough to express "use
   recipes in their default role when the catalog allows."
5. Evaluate hard rules (next section).

### 5.9 Hard rules

Hard rules are evaluated alongside scoring but exclude the candidate from
selection regardless of score. Returned as `hardRuleViolations: string[]`:

| Code | Trigger |
|---|---|
| `already_assigned_this_week` | The recipe is already used in another slot of the same week. |
| `allergen_conflict` | Recipe ingredients intersect user profile allergens. |
| `ingredient_dislike_conflict` | Recipe ingredients intersect user explicit dislikes. |
| `not_published` | `is_published: false`. |

`violatesHardRules(detail)` is the gatekeeper used by the assembler to drop
candidates from beam states.

Note that **implicit dislikes** (negative `implicit_preferences` rows) are NOT
hard rules — they only contribute to the soft taste-affinity score. Only
explicit profile entries are hard.

---

## 6. Week assembly — beam search

**File:** `week-assembler.ts`. **Spec:** §5

The scoring model gives us per-(slot, candidate) numbers. Assembly turns
those into a coherent week. We use **beam search with width 5**.

### Why beam search

Greedy "pick the best per slot independently" produces locally-optimal but
globally-bad weeks: 5 chicken dinners, no variety, identical pantry. Full
search across all slot orderings is exponential. Beam search keeps the top-K
partial weeks, so we explore alternatives without exploding compute.

### State shape

`WeekState`:
- `assignments: Map<slotId, SlotAssignment>`
- `assignedRecipeIds: Set<recipeId>`
- `assignedProteinByDayIndex: Map<dayIndex, proteinKey>`
- `assignedCuisineCounts: Map<cuisine, count>`
- `ingredientIdUsage: Map<canonicalIngredientId, count>`
- `leftoverSources: Map<slotId, { sourceSlotId, primaryRecipeId, primaryTitle, portionsAvailable, transformRecipeIds }>` — keyed by the **source** slotId (the slot that will produce the leftovers), not by day index.
- `noveltyCount: number`
- `mode: "normal" | "first_week_trust"`
- `slotIndex: number` (which slot we're filling next)
- `objectiveScore: number` (running sum)
- `assemblyBonus / assemblyPenalty`
- `warnings: string[]`

`cloneState` copies the maps and sets shallowly so each beam branch is
isolated.

### Loop

```
beam = [emptyState()]
for each slot in slot-order:
    next_beam = []
    for state in beam:
        candidates = top_K(score_all_candidates(state, slot))
        for cand in candidates:
            if violatesHardRules(cand): continue
            new_state = recordAssignment(state, slot, cand)
            new_state.objectiveScore += cand.score + assemblyAdjustments(...)
            next_beam.push(new_state)
    beam = top_BEAM_WIDTH(next_beam)
return best(beam)
```

### Assembly bonuses + penalties

Applied at the state level, not per-candidate:

| Adjustment | Value | When |
|---|---:|---|
| `busyDayCoveredByLeftovers` | **+8** | A leftover from earlier in the week is feeding a busy day. |
| `strongLeftoverTransform` | **+5** | The leftover target uses an explicit transform recipe (not just "reheat yesterday"). |
| `adjacentSameProteinRepeat` | **−6** | Same protein on adjacent days (additional to the variety factor penalty). |
| `cuisineRepeatedTooOften` | **−4** | Same cuisine ≥3 times in the week. |
| `extraNoveltyFirstWeek` | **−6** | More than one novel recipe in first-week-trust mode. |
| `unfilledNonBusySlot` | **−10** | Applied unconditionally whenever a successor cannot be generated for a slot (no candidate passes hard rules, or leftover-target fallback finds no candidate either). Despite the name, it fires on busy slots and leftover fallback cases too. |

These are blunt instruments compared to the per-candidate factors but they
matter at the assembly level — beam search uses `objectiveScore` to compare
states, so adjustments cumulatively decide which partial weeks survive.

### Effective slot-kind override

When a `leftover_target_slot` can't actually be filled (no viable source
recipe earlier in the week), the assembler can downgrade it back to a
`cook_slot` mid-search. The `recordAssignment` call accepts an
`effectiveSlotKind` parameter so the resulting state correctly reflects what
actually got assigned.

---

## 7. Bundle building

**File:** `bundle-builder.ts`. **Spec:** §6

A "slot" in the response is more than a single recipe — it's a small bundle:

- 1 **primary** component (the main recipe chosen by assembly)
- 0..2 **paired** components (sides) attached via `recipe_pairings` rows
- 0..1 **condiment** component (dip / salsa / sauce) attached separately

### Coverage logic

`buildBundle` uses the slot's `structureTemplate` to set the normal pairing
budget via `templateComponentCount`. It also reads `expectedMealComponents`
when deciding whether condiment attachment may run before the structure budget
is fully filled:

| Template | Budget |
|---|---:|
| `single_component` | 1 |
| `main_plus_one_component` | 2 |
| `main_plus_two_components` | 3 |

Algorithm:

1. Place the primary recipe. Initialize `coveredComponents` with its
   `meal_components` array and `filledRoles` with `["main"]`.
2. Walk explicit pairings in a fixed role priority:
   `side → base → veg → beverage → dessert`. For each role, pick the first
   pairing whose target recipe:
   - Passes allergen + dislike hard filters,
   - For `side` / `base` / `veg`: adds at least one not-yet-covered
     component from its `meal_components`. For `beverage` and `dessert`:
     the coverage check is skipped (they're permitted even if everything
     is already covered, because the template has budget left).
   - Hasn't already been added at that role (except condiments, which
     bypass the role-uniqueness check).
3. Stop when `components.length >= budget`.
4. **Condiment attachment** runs after the role-priority walk. It only attaches
   once the structure budget is filled, or the slot's expected meal components
   are already covered, and there is room under the separate absolute cap
   (`components.length < CONDIMENT_RULES.totalComponentsPerSlot`). If both
   hold and an explicit condiment pairing exists, one condiment attaches; hard
   allergen + dislike filters apply.

### Hard limits

From `CONDIMENT_RULES`:

- `maxPerSlot: 1` — at most one condiment per slot.
- `totalComponentsPerSlot: 4` — at most 4 components total (primary + sides
  + condiment).
- `explicitPairingOnly: true` — only attach via `recipe_pairings` rows;
  never auto-pair by similarity.
- `attachAfterCoverage: true` — condiments only attach after main/side
  coverage is satisfied.

### Allergen safety in pairings

Every paired or condiment candidate is re-checked against user allergens
before being attached. Even if a main recipe is safe, a paired side might
contain an allergen — the bundle-builder filters those out.

### `pairingBasis`

Each component in the response carries a `pairingBasis` indicating how it
got into the bundle:

- `"standalone"` — the primary (main) component.
- `"explicit_pairing"` — any secondary component (side, base, veg, beverage,
  dessert, or condiment) attached via a `recipe_pairings` row.
- `"leftover_carry"` — a leftover component in a `leftover_target_slot`,
  carrying forward from an upstream source.

This is what frontend uses to decide whether to render "+ side" affordance
vs "swap entire slot" affordance vs "reheat yesterday" affordance.

---

## 8. Persistence + response

**File:** `plan-generator.ts`

### Two-phase component insert

`meal_plan_components.source_component_id` has a CHECK constraint that
points to another component in the same plan. Inserting a leftover
component in the same batch as its source violates the constraint because
`source_component_id` references a row that doesn't exist yet.

Solution: partition components by `sourceKind` and insert in two phases.

1. **Phase 1** — every component whose `sourceKind !== "leftover"`. This
   includes **both the primary and any secondary pairing components** (sides,
   base, veg, beverage, dessert, condiment). `source_component_id` is null
   for all of these.
2. **Phase 2** — only leftover components (`sourceKind === "leftover"`).
   The orchestrator resolves each leftover's `sourceSlotIdRef` back to the
   DB UUID of the corresponding primary component from phase 1, and fills
   in `source_component_id` before insert.

If phase 2 fails, the orchestrator deletes the phase-1 rows so the plan
doesn't end up half-inserted.

### Replace + rollback

`generate_plan` accepts `replaceExisting`:
- If `false` and a plan already exists for the (user, weekStart): returns
  HTTP 409 with `error.code: "PLAN_ALREADY_EXISTS"`.
- If `true`: archives the existing plan first by setting
  `meal_plans.status = "archived"` (records the previous status in memory),
  then inserts the new plan. If the new insert fails, the orchestrator
  deletes the orphan new plan and restores the previous `status` on the
  original plan so the user's prior week is intact.

There's also a 23505 race-handler: two concurrent `generate_plan` calls for
the same week can both pass the preflight check and only one will win the
unique-constraint insert. The loser converts the constraint error to a clean
409 `PLAN_ALREADY_EXISTS`.

### Insufficient catalog

`INSUFFICIENT_RECIPES` (HTTP 422) is thrown only when the **set of unique
viable candidates collected across all requested slots** is empty. If even
one slot has at least one viable candidate, we proceed.

So a single slot with zero candidates does NOT trigger 422 — that slot
becomes an `UNFILLED_COOK_SLOT` warning in the response, the rest of the
week fills as best it can, and the response is HTTP 200 with
`isPartial: true`. Only a completely empty pool across the whole request
produces the hard error.

### Response shape

```json
{
  "plan": {
    "planId": "uuid",
    "weekStart": "2026-04-26",
    "locale": "en",
    "requestedDayIndexes": [0, 1, 2, 3, 4],
    "requestedMealTypes": ["dinner"],
    "shoppingListId": null,
    "shoppingSyncState": "not_created",
    "slots": [
      {
        "id": "uuid",
        "plannedDate": "2026-04-26",
        "dayIndex": 0,
        "mealType": "dinner",
        "displayMealLabel": "dinner",
        "displayOrder": 0,
        "slotType": "cook_slot",
        "structureTemplate": "main_plus_one_component",
        "expectedMealComponents": ["protein", "carb"],
        "selectionReason": "Reliable family-friendly pick for your first week.",
        "components": [
          {
            "componentRole": "main",
            "isPrimary": true,
            "recipeId": "uuid",
            "title": "Mongolian Beef",
            "totalTimeMinutes": 30,
            "mealComponentsSnapshot": ["protein"],
            "pairingBasis": "standalone"
          },
          {
            "componentRole": "side",
            "isPrimary": false,
            "recipeId": "uuid",
            "title": "White Rice with Vegetables",
            "totalTimeMinutes": 40,
            "mealComponentsSnapshot": ["carb"],
            "pairingBasis": "explicit_pairing"
          }
        ],
        "status": "planned",
        "swapCount": 0
      }
    ]
  },
  "isPartial": false,
  "missingSlots": [],
  "warnings": []
}
```

### Selection reasons

Each slot includes a `selectionReason` — a short locale-keyed phrase
explaining *why* this recipe was picked. Templates live in
`selection-reason-templates.ts` with `en`/`es` keys.

The reason is **NOT** computed from "which factor contributed most." It's
chosen by a fixed priority ladder in `week-assembler.ts:resolveReasonCode`:

1. `busy_day_leftovers` — primary `sourceKind === "leftover"`
2. `first_week_trust` — `state.mode === "first_week_trust"`
3. `leftovers_source` — slot `feedsFutureLeftoverTarget` AND primary is
   `leftoversFriendly`
4. `busy_day_easy_pick` — slot `isBusyDay` AND `slotKind === "cook_slot"`
5. `verified_fit` — primary's `verifiedAt` is set
6. `time_fit` — primary's `totalTimeMinutes` is in `(0, 30]`
7. `default` — fallback

First match wins. The first-week-trust branch in particular short-circuits
many other potential reasons — that's why every slot in a first-week plan
shows the same "reliable family-friendly pick" copy regardless of which
factor actually drove the score.

---

## 9. First-week trust mode

**Trigger:** the user has zero prior generated weeks (`evidence_weeks === 0`).

**Spec:** §3.2

In this mode the planner shifts toward "feel reliable, don't surprise":

- **Time fit** weight goes 15 → 20: cook times matter more.
- **Verified** weight goes 5 → 10: human-curated content gets a bigger boost.
- **Nutrition** weight drops 10 → 5: we don't yet know your goals well.
- **Ingredient overlap** drops 15 → 10: efficient shopping matters less than
  obvious wins.
- Variety has a `firstWeekNoveltyCap: 1` — more than one novel recipe takes a
  reduced bonus, and the assembly applies `extraNoveltyFirstWeek: -6` if the
  state crosses the cap.

The `state.mode` field flows through the whole scoring stack so every factor
that cares can adjust its behavior.

---

## 10. Configuration walk-through

**File:** `scoring-config.ts`

The key idea: `SCORING_CONFIG_V1` consolidates the **primary** weights,
thresholds, and policy decisions in one place. All scoring modules import
the named constants directly; the consolidated object exists mainly for
introspection (debug traces, admin views).

A small number of ranking-related curves still live outside the config —
notably the `shortlistCandidatesForSlot` heuristic in
`candidate-retrieval.ts` and the `difficultyFit` / `timeCompat` curves
inside `slot-fit.ts`. These are expressed as small switch tables for
clarity rather than constants, but they ARE behavior-affecting. If you're
auditing a behavior change and don't see it in `SCORING_CONFIG_V1`, check
those files too.

### Top-level groups

- **`weights`** — `normal` and `firstWeekTrust` weight profiles.
- **`taste`** — sub-weights inside the 25-point taste/household factor.
- **`slotFit`** — per-slot-kind sub-weight blends.
- **`variety`** — sub-weights inside the 10-point variety factor.
- **`ingredientOverlap`** — 0.55 weeklyOverlap / 0.45 pantryFriendly.
- **`nutritionHealthier`** — sub-weights for the eat_healthier nutrition goal.
- **`timeBudgets`** — 45/120/30 minutes weeknight / weekend / busy day.
- **`retrieval`** — top-N + per-state beam limits.
- **`beam`** — beam search width (5).
- **`thinCatalog`** — empty-catalog warning thresholds.
- **`assembly`** — week-state bonuses/penalties.
- **`scoreModifiers`** — currently just `primaryRolePreferencePenalty: 5`.
- **`leftoverResolution` / `leftoverPlanQuality`** — inputs to leftover
  source/target scoring.
- **`varietyLimits`** — adjacency window, novelty cap, recent recipe window.
- **`household`** — large-household threshold + default size.
- **`history`** — what cook count counts as "family favorite"; what rating
  counts as a hard rejection.
- **`condimentRules`** — per-slot bundle-builder limits.
- **`structureDefaults`** — what `structureTemplate` each canonical meal
  type defaults to.
- **`mealTypePrimaryRoles`** — which `planner_role` values each meal type
  accepts as primary.
- **`weekendDayIndexes`** — `[5, 6]` (Sat, Sun).
- **`debug`** — debug trace controls.

### Tuning workflow

1. Edit `SCORING_CONFIG_V1` (or the named constants).
2. Run scoring tests: `deno task test --filter "scoring"`.
3. Run the smoke test if you've made anything that affects assembly:
   `bash yyx-server/supabase/functions/__tests__/test-meal-planner-generate-plan.sh`.
4. The change ships with the next edge-function deploy — no migration
   required since these are code-level constants.

If a tuning change *needs* to be A/B-tested or rolled out gradually, that's
not built today. The config is intentionally not user-overridable; it's a
product decision that ships uniformly to all users.

---

## 11. Edge cases and known limitations

- **Implicit preferences are not hard.** Even a strongly-negative implicit
  preference for chicken won't exclude chicken recipes — only profile-level
  explicit dislikes do that. By design (so we don't silently filter out
  whole categories from incomplete signals).
- **No `total_time` → neutral 0.5.** Recipes with missing time data don't
  get penalized below average. Trade-off: better than driving them out of
  rankings, but means stale data hides from time-fit.
- **`alternate_planner_roles` recipes take a 5-point penalty.** A recipe
  set up as a snack with `alternate_planner_roles: ['side']` can fill a
  side slot, but loses 5 points to a "real" side. Penalty is small enough
  that good alternates still win against weak primaries.
- **No locale fallback in scoring.** Selection reasons are looked up by
  user locale (`en`/`es`). If the locale isn't supported, the response
  uses an English template — there's no Spanish→French fallback chain in
  the scoring path. (DB-side `resolve_locale()` exists for content but
  isn't reused here.)
- **Weighted sums can exceed 100 with bonuses.** Per-candidate weighted
  sum is bounded ≤100, but assembly bonuses (`+8` busy-day-leftovers,
  `+5` strong-transform) push the per-state objective above 100. Likewise,
  penalties can drop below 0. The objective is for ranking, not display.
- **Pairings are not bidirectional.** If `recipe_pairings` has
  `(A → B, role: side)` it only attaches B to A. Adding the reverse
  pair is a separate row (intentional — many sides aren't standalone
  meals).
- **Beam width 5 is small.** Trade-off between latency and global
  optimality. For a 5-slot week with ~12 candidates per slot per state,
  beam=5 keeps us under ~60 score evaluations per slot transition. Wider
  beam = better plans but slower generation.

---

## 12. Testing

- **Unit tests per scoring factor:** `scoring/scoring.test.ts` exercises
  taste, variety, slot-fit, and the orchestrator with hand-built input
  fixtures. Each factor function is pure and easy to test in isolation.
- **Slot classifier:** `slot-classifier.test.ts` covers canonical meal-type
  mapping and busy-day / weekend / leftover-target derivation.
- **Bundle builder:** `bundle-builder.test.ts` covers coverage logic,
  condiment rules, allergen safety, and the various structure templates.
- **Week assembler:** `week-assembler.test.ts` covers cloning, beam-state
  bookkeeping, and assembly bonus/penalty application.
- **Plan generator:** `plan-generator.test.ts` covers the orchestration
  including two-phase component insert + rollback paths via mocked Supabase.
- **End-to-end smoke:**
  `supabase/functions/__tests__/test-meal-planner-generate-plan.sh` hits
  the deployed cloud function with a real user JWT, asserts happy-path +
  409 conflict + 400 validation. Manual-only (not in CI) because we share
  one Supabase environment with development. See the script header for env
  vars and cleanup behavior.

---

## 13. Future extensions

These are explicitly **not** built yet but the architecture accommodates them:

- **Real ratings table.** Today `recipeAffinity` proxies via cook count.
  When a `recipe_ratings` table lands, swap `recipeHistoryAffinity()`
  internals — no other change needed.
- **Session intent.** `explicitIntent` sub-weight is wired but always 0.
  When the chat orchestrator can pass "I want something Mexican tonight"
  context to plan generation, plug it in here.
- **Per-user weight overrides.** The whole scoring stack reads weights from
  `pickWeights(state.mode)`. Adding a third mode (or per-user weights from
  a profile setting) is a config-only change.
- **Multi-week visibility.** Variety currently looks at the current week
  + recent-cooked history. Planning multiple weeks at once would need the
  beam to extend across weeks, but the score model wouldn't change.
- **Cost / pantry inventory factor.** A future `pantryActual` factor could
  read from a real pantry table and replace `pantryFriendly`'s heuristic.
- **Nutrition factor is entirely stubbed.** All non-`no_preference` goals
  (including `eat_healthier`) return the constant 0.5 today. The
  `NUTRITION_HEALTHIER_SUBWEIGHTS` config object is wired into the debug
  trace but no scoring path consumes it. Flesh this out when the
  nutrition pipeline produces reliable per-recipe macros — the scoring
  surface (factor signature + weight) won't change, only the internals of
  `scoreNutritionFit`.

---

## 14. References

- **Spec (canonical):** `product-kitchen/repeat-what-works/design/ranking-algorithm-detail.md`
- **Recipe role model:** `product-kitchen/repeat-what-works/design/recipe-role-model.md`
- **Code:** `yyx-server/supabase/functions/meal-planner/`
- **Single config:** `scoring-config.ts → SCORING_CONFIG_V1`
- **Smoke test:** `yyx-server/supabase/functions/__tests__/test-meal-planner-generate-plan.sh`
