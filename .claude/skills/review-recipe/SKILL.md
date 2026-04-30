---
name: review-recipe
description: Review a YummyYummix recipe against the quality rubric and emit a YAML config for the recipe-metadata apply pipeline
---

# Recipe Review Skill

Review the recipe identified by `$ARGUMENTS` (an EN/ES name fragment, or a UUID) and produce or refresh the YAML config at `yyx-server/data-pipeline/data/recipe-metadata/<slug>.yaml`. The YAML, once committed, is applied transactionally by `deno task pipeline:apply-recipe-metadata` (Plan 12).

Read [docs/agent-guidelines/RECIPE-REVIEW.md](../../docs/agent-guidelines/RECIPE-REVIEW.md) before proceeding — that file is the rubric.

## Preflight — reasoning effort

**Default to medium effort.** Bulk imports of human-authored recipes (the common case) don't benefit from high reasoning — the work is mostly mechanical mapping (auto-checks 1-21), closed-vocabulary tag selection, voice rewrites against a known list, and planner-role decisions that plateau by medium. The model's reasoning depth doesn't change its world-knowledge of whether soy sauce contains wheat, whether a Mexican mole needs chocolate, or whether a dish is well-balanced; those come from training data, not effort tier. High effort costs ~3-5x tokens for marginal gain on most recipes.

**Escalate to high effort only when one of these is genuinely true:**

- The recipe is **AI-generated** (the source itself may be wrong — high helps catch upstream errors).
- The cuisine is **unfamiliar enough** that authentic-seasoning judgment is the bottleneck (e.g. specific regional Mexican variants the reviewer is uncertain about).
- The structural decision is **genuinely hard** — multi-role candidates (`alternate_planner_roles`), close calls on `is_complete_meal`, or pairings that need careful catalog-aware reasoning.
- A previous medium-effort review on a similar recipe **shipped a judgment error** a human caught.

For everything else — refreshes, routine YAML touch-ups, well-known cuisines, uncontroversial roles, voice rewrites, tag adds — medium is the right cost/quality point.

**When uncertain on any judgment call** (translation correctness, tag fit, role assignment, ingredient quality), route to `requires_authoring.notes` instead of guessing. Caution is cheaper than reasoning — and the human admin reviews the worklist anyway.

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

## Recipe state source — snapshot first, live Supabase as fallback

Reviews read recipe state from a local **recipe review snapshot** when one is available. Snapshots are produced by `deno task pipeline:export-review-snapshot` (see `yyx-server/data-pipeline/data/recipe-review-snapshots/`) and capture the same review-critical state the SQL queries below would otherwise fetch one-recipe-at-a-time. Use them — they are dramatically faster for batch review and produce no Supabase load.

Resolution order, in priority:

1. **Explicit snapshot.** If the user passed a snapshot path (e.g. `/review-recipe Mongolian Beef --snapshot /abs/path.json`), load that file and resolve the recipe out of `recipes[]` by `recipe.id` or `translations[].name`.
2. **`latest.json` pointer.** Otherwise, look for `yyx-server/data-pipeline/data/recipe-review-snapshots/latest.json`. If it exists, read the `snapshot_file` field and load that snapshot.
3. **Live Supabase fallback.** If no snapshot is available, or the recipe is not in the snapshot (e.g. a recipe created after the snapshot was exported), fall through to the live `execute_sql` queries in Steps 1-2 below.

When you read a recipe out of a snapshot, copy `recipe.updated_at` verbatim into `recipe_match.expected_recipe_updated_at` (do not reformat). The apply RPC's stale-diff guard compares against this exact value — if the live `recipes.updated_at` has advanced past the snapshot's value, the apply will be rejected with `stale_diff` and you can either (a) refresh the single recipe via live Supabase, or (b) re-export the snapshot. Snapshot freshness alone never blocks review; only an apply-time mismatch on a specific recipe does.

**Surface the snapshot timestamp at the start of the review.** Before Step 1, print the snapshot's `created_at` and the recipe's `updated_at` so the user can decide whether to re-export. If you are handed an older snapshot with `generated_at` instead, print that value and label it clearly. Example: `Snapshot: 2026-04-29T02:10:00Z (recipe.updated_at: 2026-04-29T01:53:11Z)`. No live-DB roundtrip — the apply-time stale_diff guard is the safety net for the dangerous case.

**When to re-export the snapshot.** The snapshot is review-input infrastructure; re-exporting defensively defeats its purpose (one export should serve a 21-recipe batch, not 21 round-trips dressed up as exports).

Re-export **only** when one of these is true:

1. **Apply just hit `stale_diff`** for a recipe you're working on — the apply-time guard fired, refresh is the documented response.
2. **Starting a new batch** (e.g. opening a fresh review queue) — one export, then trust it through the batch.
3. **The user explicitly asks for fresh state** (e.g. they just bulk-imported recipes outside this session).

Do **not** re-export because:

- The snapshot is N hours/days old. Snapshot age alone is meaningless — what matters is whether the recipes you're touching have changed.
- You think a recipe might have been touched. The `stale_diff` guard is the right place to find out — it fires at apply time, costs nothing at review time, and tells you exactly which recipe drifted.
- You want to "be safe." Defensive re-exports defeat the snapshot's purpose. Trust the snapshot; lean on `stale_diff`.

`apply-recipe-metadata` itself never reads snapshots. Dry-run and apply still go through live Supabase — the snapshot is review-input only.

## Step 1 — Resolve the recipe

If a snapshot is loaded, resolve the recipe from `recipes[]` by UUID or by `translations[].name` and do **not** run SQL. If 0 snapshot matches, tell the user the recipe is missing from the snapshot and either fall through to live Supabase or ask whether to re-export. If 2+ snapshot matches, list them and ask which one. If 1 match, capture `recipe.id`, `recipe.updated_at`, and the `en` / `es` names for use throughout.

Only when no usable snapshot path exists, use the Supabase MCP `execute_sql` tool (read-only — safe per the project's MCP rules) to find candidate matches:

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

If a snapshot recipe was resolved in Step 1, use that recipe object's `recipe`, `translations`, `ingredients`, `steps`, `kitchen_tools`, `pairings`, and `tags` arrays as the full recipe state. Do **not** run SQL for state that is already present in the snapshot.

**Read canonical taxonomy from the snapshot (preferred) or live DB (fallback).** Every YAML you write must use real `recipe_tags.slug` values, verbatim `kitchen_tool_translations.name` strings, and real `measurement_units.id` values — typos silently no-op tags or hard-fail kitchen tools / ingredients at apply. Resolution order:

1. **Snapshot taxonomy.** When the snapshot is loaded (see "Recipe state source" above), read the canonical lists from `taxonomy.recipe_tags[]`, `taxonomy.kitchen_tool_names_en[]`, and `taxonomy.measurement_units[]`. The exporter captures these at snapshot time so reviews require zero live-DB roundtrips. Re-export to refresh.
2. **Live-DB fallback.** If the snapshot is missing the required `taxonomy` block (snapshot version < 3), or you fell through to live Supabase entirely, run these read-only queries once and reuse for every recipe in the session. Older snapshots without `taxonomy.measurement_units` (v2) are expected — they predate the unit-taxonomy bump and the fallback below covers them. If you have shell access and plan to review more than one recipe, prefer re-exporting via `deno task pipeline:export-review-snapshot --local` over running live SQL every session — re-export takes seconds and keeps subsequent recipes snapshot-cheap.

```sql
SELECT slug, categories FROM public.recipe_tags ORDER BY slug;
SELECT name FROM public.kitchen_tool_translations WHERE locale = 'en' ORDER BY name;
SELECT mu.id, mu.type, mu.system, mut.locale, mut.name, mut.symbol
  FROM public.measurement_units mu
  LEFT JOIN public.measurement_unit_translations mut ON mut.measurement_unit_id = mu.id
  ORDER BY mu.id, mut.locale;
```

When live fallback is required, run these in parallel via `execute_sql` (each is read-only). Capture the full result of each — you will reference it in steps 3-5. Skip this SQL block entirely when the snapshot supplied the recipe state.

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

-- step ingredient links (needed for step coherence and orphan-link checks)
SELECT rsi.recipe_step_id,
       rs."order" AS step_order,
       rsi.ingredient_id,
       rsi.display_order,
       it.name AS ingredient_name_en,
       ri.id AS recipe_ingredient_id,
       ri.display_order AS recipe_ingredient_display_order
  FROM public.recipe_step_ingredients rsi
  JOIN public.recipe_steps rs ON rs.id = rsi.recipe_step_id
  LEFT JOIN public.ingredient_translations it
    ON it.ingredient_id = rsi.ingredient_id AND it.locale = 'en'
  LEFT JOIN public.recipe_ingredients ri
    ON ri.recipe_id = rs.recipe_id AND ri.ingredient_id = rsi.ingredient_id
  WHERE rs.recipe_id = '<recipe_id>'
  ORDER BY rs."order", rsi.display_order;

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

For check #11 (`step ingredient link mismatches`): compare the step text, `recipe_step_ingredients`, and recipe-level `recipe_ingredients`.

- If the step text directly adds or handles an ingredient and the link is missing, flag the missing link.
- If `recipe_step_ingredients.recipe_ingredient_id` is null from the Step 2 query, flag it as an orphan link: the step claims to use an ingredient absent from this recipe's ingredient list.
- If a linked step ingredient is not mentioned, handled, or clearly implied by the instruction (for example "all remaining ingredients" can be valid), flag it as suspect.
- For step **instruction / recipe_section / tip text** edits (typos, grammar, voice fixes — usted→tú, gendered noun agreement, etc.), use `step_text_overrides` (per-locale, schema described in Step 5). `step_overrides` is for structured Thermomix fields only (time, speed, temperature, mode); it does not edit text.
- The YAML applier cannot currently mutate `recipe_step_ingredients` (the relationship table linking steps to ingredients). If the relationship row itself is wrong (orphan link, missing link), record it in `requires_authoring.notes` for admin cleanup. Reserve `requires_authoring.notes` for these structural cases — text-fixable issues belong in `step_text_overrides`.

For check #16 (`no_steps`) and #17 (`few_ingredients`): **stop fixing those sections** and add the trigger to `requires_authoring.reasons`. Never fabricate steps or ingredients.

For check #14 (`same_en_es_name`): if the ES translation is unambiguous (e.g. proper noun translates clearly), set `name.es`. If subjective, flag `requires_authoring.reasons: ['same_en_es_name']` and leave the name alone.

## Step 4 — Run judgment-call checks

For each item in the **Judgment-call checks** section of `RECIPE-REVIEW.md`, reason about the recipe and decide what (if anything) the YAML should change. When in doubt, flag the concern in `requires_authoring.notes` instead of silently changing.

**`planner_role` is special — re-decide it from scratch every time.** Do not look at the current DB value first; look at the recipe (ingredients, portions, meal_components, dish identity) and decide what role/meal_components/is_complete_meal *should* be. Only then compare against the DB. Many recipes were imported with mis-coded roles (complete-meal salads as `side`, dips as `snack`), so the "preserve if present" default is unsafe here.

**Planner field inclusion — explicit:**
- **Always include** `role`, `meal_components`, `is_complete_meal` in the YAML, even when they match the current DB value. Re-asserting these in git history is the point — they are the role-decision audit trail.
- **Write only what changes** for every other planner field: `equipment_tags`, `cooking_level`, `leftovers_friendly`, `batch_friendly`, `max_household_size_supported`, `alternate_planner_roles`. These follow the standard "omit if unchanged" rule from the rest of the schema. Including them when they match the DB just creates no-op writes and clutters the YAML; trim them out.

**Exclusion-style diet tags must be audited against user-visible content.** Adding `vegan`, `vegetarian`, `gluten_free`, or `pescatarian` is a promise to the user. Before keeping or adding one of these tags, scan the description, `tips_and_tricks`, ingredient list, and step text for items that violate the promise (cheese mentioned in a vegan tip; bread mentioned in a gluten-free description; anchovies in a vegetarian dressing). If you find a contradiction: rewrite the content to surface a compliant alternative alongside the existing suggestion, or drop the tag. Never ship the contradiction — these tags are reputation-critical.

**Opinion-laden occasion/practical tags get the same audit posture.** `kid_friendly` is not "kids will eat this" — `RECIPE-REVIEW.md` defines a five-point bar (heat, dominant flavors, texture, no alcohol-as-flavor, parent-serves-without-negotiating). `one_pot` is not "cooked in the Thermomix bowl" — it requires a complete meal in a single vessel. Same principle extends to `comfort_food`, `weeknight`, `quick_meal`, and any other slug whose meaning is set by the user's filter expectation rather than a hard data check. Each is a promise. If the reviewer's reason for adding it is "yeah, sort of" or "kids would eat it," skip the tag — diluting the filter for the parents and busy cooks who rely on it is a worse outcome than under-tagging. When in doubt, omit; the rubric never penalizes caution.

## Step 5 — Write the YAML

**Refresh-mode guardrail — required when the YAML already exists.** Before writing, check whether a YAML at `yyx-server/data-pipeline/data/recipe-metadata/<slug>.yaml` is already on disk. If so, you are in *refresh mode*, not first-write mode. In refresh mode, do **not** trust the YAML body. The recipe in the DB may have been re-imported, re-authored, or otherwise diverged from the version the prior YAML described.

Compare the existing YAML's body sections against current DB state field-by-field:

- **Description / tips / scaling notes:** does the YAML's text describe the *same dish* the live recipe is now? If the DB's description says "broccoli + potato cream soup" and the YAML's says "broccoli + cheese baked casserole," the dish identity has diverged — discard the YAML body for those locales and rewrite from live state.
- **Kitchen tools / pairings / tags:** does the YAML's set match what the live recipe should have, or is it a stale fixture? Do not blindly re-apply lists from a stale YAML.
- **Ingredient updates / step overrides:** if these reference `existing_id`s or step UUIDs that no longer exist (recipe re-imported), drop them; switch to slug+display_order or step `order` matching.

Only the minimal `recipe_match` + `review` blocks survive a refresh unconditionally. Everything else is a fresh decision against current state. Bumping `expected_recipe_updated_at` alone is **not** a refresh — it is a timestamp-only edit that risks shipping stale fixture content over corrected live content.

When in doubt, treat refresh as first-write: ignore the prior YAML body, look at live state, decide everything from scratch. Re-asserting the same value is zero-write idempotent; over-writing better content is permanent.

Write the YAML to `yyx-server/data-pipeline/data/recipe-metadata/<slug>.yaml` where `<slug>` is the EN name slugified (lowercase, hyphen-separated, e.g. `Mongolian Beef` → `mongolian-beef.yaml`).

Required sections:

- `recipe_match.id` — the UUID from step 1
- `recipe_match.name_en` — the live EN name (so the apply hard-fails if the YAML drifts to a different recipe)
- `recipe_match.expected_recipe_updated_at` — when using a snapshot, copy `recipe.updated_at` verbatim. When using live SQL fallback, convert the returned `updated_at` to canonical ISO 8601: `T` separator, preserve microseconds, full `+00:00` offset. Postgres returns `2026-03-17 20:22:55.099866+00` — write it as `'2026-03-17T20:22:55.099866+00:00'`. Truncating to seconds risks `stale_diff` rejection.
- `review.reviewed_by_label` — your model label (e.g. `'claude-opus-4-7'`)
- `review.reviewed_at` — current ISO 8601 timestamp

**`planner` is the exception**: always include it with at least `role`, `meal_components`, and `is_complete_meal` (per Step 4's "re-decide planner_role from scratch" rule), even when your decision matches the current DB value. Re-asserting the same value is a zero-write idempotent op and makes the role decision visible in git history.

For every other section, write only what changes. If a section's current state is already correct, omit it (idempotent dry-run will report zero writes for omitted sections).

**YAML comments: mechanical only.** Reserve `#` comments for mechanical facts a future reader needs while looking at the file: what canonical name a `name_en` resolves to, why a match key uses `order` instead of `step_id`, what a `null` override clears, why a one-off slug deviates from the obvious choice. Do **not** write multi-paragraph rationale for tag additions, role re-decisions, description rewrites, or other judgment calls. That belongs in the Step 7 report's "Judgment calls" bucket — the report is what the user reads to ratify before apply; the YAML is what the apply pipeline reads, and `--dry-run` does not surface YAML comments. Duplicating rationale in both places stales fast and clutters the diff.

Match-key rules:
- `ingredient_updates`/`ingredient_removes`: prefer durable `ingredient_slug` + `display_order` because `recipe_ingredients.id` values can rotate on re-import. Compute the slug exactly as the SQL helper does — the JS reproduction is in `data-pipeline/lib/recipe-metadata-fetch.ts:slugifyName()`. Use `existing_id` only when a slug is unavailable or the row cannot be disambiguated by slug + display order. Never use names directly.
- `step_overrides`: prefer `order` because `recipe_steps.id` values can rotate on re-import. Use `step_id` only when order is unavailable or ambiguous. Edits Thermomix structured fields only (time, speed, temperature, mode, blade direction, timer). Speed ramps are written as flat `thermomix_speed_start` / `thermomix_speed_end` (matching the DB columns); these are mutually exclusive with the single `thermomix_speed`. Example for a 5→10 ramp over 60s:
  ```yaml
  step_overrides:
    - match: { order: 3 }
      thermomix_time: 60
      thermomix_speed: null
      thermomix_speed_start: 5
      thermomix_speed_end: 10
  ```
- `step_text_overrides`: same match key rules as `step_overrides` (prefer `order`). Edits per-locale text on `recipe_step_translations` — `instruction`, `recipe_section`, and `tip`. Each entry's `translations` block must contain at least one of `en` / `es`, and each present locale block must set at least one of the three text fields. Omitted fields stay untouched. Use this for fixable text issues — typos, grammar, voice fixes (usted→tú, gendered noun agreement) — instead of routing them to `requires_authoring.notes`. Example:
  ```yaml
  step_text_overrides:
    - match: { order: 5 }
      translations:
        es:
          instruction: 'Coloca los muslos con la piel hacia abajo en el cesto.'
  ```
- `kitchen_tools` and `pairings`: declarative `set:` blocks list the full desired state.

**`tags` is per-category set replacement — write a category only if you mean to redefine it.** Each `tags.<category>` you write replaces the recipe's full set in that category. Writing `tags.diet: [vegetarian]` removes every other diet tag on the recipe (e.g. an existing `gluten_free` is silently dropped). The dry-run shows the removals as `- diet: gluten_free` so a careful reviewer would catch it, but the easier rule is: **omit a category to leave its current contents untouched**; only write a category when you intend to redefine the entire list. If you want to add one diet tag while preserving others, you must list all the diet tags you want — including the ones already there.

**Before writing a `kitchen_tools.set` block — validate canonical names.** The DB stores `Thermomix®` and `Thermomix® Varoma` (with the registered-trademark glyph). A YAML that writes `Thermomix` or `Varoma` (no ®) will hard-fail at apply with an opaque "ambiguous name" error. When using a snapshot, copy strings verbatim from `taxonomy.kitchen_tool_names_en[]`. Only in live fallback mode, run this read-only `execute_sql` once and copy strings verbatim:

```sql
SELECT name FROM public.kitchen_tool_translations WHERE locale = 'en' ORDER BY name;
```

**`equipment_tags` taxonomy.** The schema accepts free strings but the convention is lowercase, currently just `[thermomix]`. Match what existing YAMLs in `data-pipeline/data/recipe-metadata/*.yaml` use — never invent variants like `Thermomix`, `TM6`, or `varoma`.

**`is_published` is admin-only — never set it in the YAML.** Publishing is a business/editorial decision (release timing, marketing alignment, content batching), not a reviewer-side decision. Always omit `is_published` from the YAML. The reviewer's job is quality-gating recipe content; the admin's job is flipping the publish bit when they decide it's the right time.

When publish state and content quality disagree:

- **Quality criteria met but unpublished:** add a readiness signal to `requires_authoring.notes` (e.g. "Ready to publish — all rubric checks pass, awaiting admin sign-off"). Do not set `is_published: true`.
- **Published but failing quality criteria:** flag the failing criteria in `requires_authoring.notes`. Do not set `is_published: false`.
- **State matches quality:** omit `is_published` entirely.

The publish-readiness criteria (for the readiness note, not for setting the field): (a) `requires_authoring.reasons` is empty, (b) `planner.role` is non-null, (c) a `meal_type` tag exists (or `planner.role = 'pantry'`), (d) en+es exist for name/description/tips_and_tricks, (e) at least one ingredient and one step exist.

**`cleanup.delete_locales` is rare.** The pipeline intentionally emits `en + es + es-ES`. `es-ES` is the override slot for future Spain-Spanish content; **never** add `cleanup.delete_locales: ['es-ES']` even when it currently mirrors `es` exactly. Use `cleanup.delete_locales` only to remove a locale that genuinely should not exist for the recipe (e.g. a stray third-party locale).

**`es-ES` drift is out of scope — ignore it.** The launch audience is Mexico-first; Spain-Spanish overrides are a future concern. The schema only exposes `*_en` and `*_es`, the DB has separate `es-ES` rows, and they will routinely drift from `es` because nothing in the pipeline keeps them in sync. **Do not flag es-ES drift in `requires_authoring.notes`, do not document it, do not try to clean it up.** It is expected and intentional. Only revisit when a Spain rollout is on the roadmap. The single rule that still applies: never `cleanup.delete_locales: ['es-ES']` — that destroys the override slot.

Validate the YAML before stopping:

```bash
cd yyx-server && deno task pipeline:apply-recipe-metadata --local --recipe <slug> --dry-run
```

The dry-run prints the diff. If validation fails, fix the YAML and re-run. Immediately after the final dry-run, write the Step 7 report with the actual dry-run change count and stale status; do not leave judgment calls only in YAML comments.

## Step 6 — requires_authoring triage

If you flagged any unfixable issues, write a clear note:

```yaml
requires_authoring:
  reasons: [no_steps, few_ingredients]
  notes: 'Recipe imported from Notion as a stub. Steps section is empty and only 1 ingredient (chocolate) is listed. Needs human authoring before publication.'
```

**Draft notes deliberately — they ship to admin verbatim.** `requires_authoring.notes` is the reviewer's handoff to the human admin via the `--list-authoring` worklist. Stream-of-consciousness fragments ("ebdd811d-… wait, that's cilantro", "hmm, maybe?", "TODO check this") are not edits to be cleaned up later — they are the message. Write each note as a finished sentence the admin can act on without context from you. If you find yourself mid-thought, finish the thought before you commit the YAML.

The applier ignores this section — it is YAML-only, surfaced by `--list-authoring`. Recipes flagged this way are NOT publishable until a human authors the missing pieces in the admin UI.

## Step 7 — Report

The report is a **triage**, not an exhaustive change log. The dry-run is the source of truth for every mechanical change — the report's job is to tell the user what to look at *before* running `--apply`. Lead with the recipe identifier, then the buckets in this order:

```
STATUS: <READY | REVIEW (N risks) | BLOCKED (stale_diff)>
Recipe: <name> (<id>)
Snapshot: <created_at>  recipe.updated_at: <updated_at>
Dry-run: <N> changes  stale_diff: <yes/no>

⚠ Risks — read or push back
  - <every item that's structural, reversible-but-wrong-could-ship, or otherwise high-stakes>
  - <e.g. "step 4 sauté params cleared (thermomix_speed null, was 4) — verify the structured field is right">
  - <e.g. "Added diet:gluten_free promise — confirm no soy sauce / wheat-bouillon in description.es">
  - <e.g. "Role flipped main → side, diverges from DB; ratify before apply">
  - <e.g. "Discarded existing fixture body in refresh mode (3 sections diverged from DB)">

▸ Routine judgment calls
  - <one bullet per dry-run section that changed, summarizing the call — not enumerating every item>
  - <e.g. "Tags: + cuisine, meal_type, occasion, practical (cuisine: mexican, meal_type: lunch+dinner, …)">
  - <e.g. "Tips rewritten in en + es to fix usted-imperative voice (auto-check #20)">
  - <e.g. "Pairings: kept role 'side' for White Rice with Vegetables (one-line reason)">

▸ Skipped on purpose
  - <only items where a reasonable reviewer might have added this AND been wrong to>
  - <e.g. "diet:vegetarian skipped — avocado mayo may contain egg, not in data">
  - <e.g. "kid_friendly skipped — adult flavor (mustard, vinegar bite)">

▸ Admin SQL needed
  - <count + pointer; do not re-state notes>
  - <e.g. "2 items in requires_authoring.notes (orphan recipe_step_ingredients link, step_ingredient quantity drift)">

Next step: review risks, then run `deno task pipeline:apply-recipe-metadata --local --recipe <slug> --apply`.
```

**Status line.** First line of the report, computed from the buckets — lets a user scanning a stack of reports triage at a glance. Three values: **READY** (0 risks, no stale_diff), **REVIEW (N risks)** (≥1 risk, no stale_diff), **BLOCKED (stale_diff)** (regardless of risk count — apply will fail until the YAML is refreshed). Nothing else goes on this line; the buckets carry the detail.

**Bucket rules:**

- **⚠ Risks** — list every item that could ship as a user-visible defect, an irreversible-without-thought structural change, or a divergence from the existing DB state that needs explicit ratification. **No cap on count.** If 7 items genuinely deserve the ⚠ glyph, list 7. The triage gate is *severity*, not *count*: "would a careful reviewer want to know about this before `--apply`, in case it's wrong?" If yes → Risks. If no → Routine. Categories that always belong here when present: structural data changes (`step_overrides` clearing fields, `cleanup.delete_locales`), discarded fixture body in refresh mode, exclusion-style diet-tag adds (`vegan`/`vegetarian`/`gluten_free`/`pescatarian`), role flips that diverge from current DB, planner-field changes that diverge from DB, kitchen-tools `set:` that removes existing tools.
- **▸ Routine judgment calls** — *summarize by section, not by item.* "Tags: + cuisine, meal_type, occasion, practical" is one bullet, not four. "Step text rewritten in en+es for usted→tú voice across steps 2-5" is one bullet, not eight. Reviewer opinion landed in the YAML; the user reads this bucket to ratify the *direction* of changes, not to re-read every line of the dry-run.
- **▸ Skipped on purpose** — symmetric counterpart to Routine: *deliberate omissions* the user could plausibly want to override. Tighter bar than the others — only include items where a reasonable reviewer might have added this AND been wrong to. "Considered weeknight, recipe has no time data" is not a judgment call worth ratifying — drop it. "Considered breakfast, recipe is a mole" is obvious — drop it. Keep contested skips: tags weighed and rejected on close calls, pairings considered and dropped, role flips considered and reverted. **No cap on count, but every bullet must clear the contested-skip bar.**
- **▸ Admin SQL needed** — pointer + count, not duplicate. `requires_authoring.notes` already carries the detail; the report just signals the count and what families of issue (orphan link, quantity drift, missing procedure, etc.) so the user knows what's queued for the admin worklist.

**Drop the "Will apply on --apply" bucket entirely.** The dry-run already prints every mechanical change; restating it in the report burns attention without adding signal. The report exists to tell the user what to look at *that the dry-run alone won't catch*.

If a bucket is empty, omit the header entirely — do not pad with "n/a". If the dry-run hit `stale_diff`, say so in the dry-run line and make the next step refresh/re-export instead of apply.

Do not apply the YAML yourself — that is the human's call after reviewing the diff.

**Exception:** if the user explicitly authorizes apply in the same session (e.g. "go ahead and apply", "run the pipeline", "apply the changes"), proceed with --apply after running a final dry-run. The skill's default is "stop after the YAML is written"; the user's explicit instruction overrides that default.

## Parallelization (advanced)

**Default to sequential.** Parallel reviews via subagents are valuable only when chunking 5+ "easy" recipes (no fixture mismatches, no obvious orphan-link issues), and only with the cheap-prompt pattern below — naïve dispatch costs roughly 2× the tokens of sequential while saving ~50% wall-clock. Each subagent that reads the full snapshot (~600 KB), the full `RECIPE-REVIEW.md`, and the full `SKILL.md` pays ~100 k input tokens before it does any thinking. Five recipes dispatched naïvely costs ~500 k tokens of overhead vs ~50–70 k per recipe sequential — that's the ~50 % premium you should expect to avoid.

**Cheap-prompt pattern (the dispatcher's setup, not the subagent's).** When you (the main session) decide to parallelize, you do all five moves below *before* dispatching. The subagents inherit a small, self-contained prompt and never read the full snapshot or canonical files.

1. **Pre-extract per-recipe data.** For each target recipe, write a single-recipe JSON to `/tmp/recipe-review-<slug>.json` from the snapshot (`snapshot.recipes[]` filtered to one entry, plus the `taxonomy` block). Subagents read ≤20 KB instead of the full ~600 KB snapshot file.
2. **Inline the rubric rules.** Distill `RECIPE-REVIEW.md`'s deterministic auto-checks and judgment-call bars (planner role decision tree, exclusion-style diet-tag audit, `kid_friendly`/`one_pot`/`cooking_level` rubrics) into ~3 KB of explicit rules in the subagent prompt. **The inlined rules ARE the rubric for that subagent's task.** Tell the subagent: "Use only the rules below; SKILL.md and RECIPE-REVIEW.md are already distilled in this prompt — re-reading them is redundant and would re-introduce the ~100 k token overhead this dispatch pattern exists to avoid."
3. **Inline the canonical slug list.** Compress `taxonomy.recipe_tags` into a categorized one-liner per category (~2 KB). Tell the subagent: "Use only the slugs listed; never invent a slug; if no listed slug fits, omit the category."
4. **Inline user preferences as a checklist.** Durable match keys (`ingredient_slug + display_order`, step `order`), no es-ES drift flagging (Mexico-first), `is_published` is admin-only, no judgment rationale in YAML comments. ~1 KB. (The `kid_friendly`/`one_pot`/diet-tag bars are already in step 2 — don't duplicate.)
5. **Cap the response format.** Three-bucket report + Considered-and-skipped bucket, under 400 words, no full diff dump. Tell the subagent: "Output the report only; the YAML write is a side effect, not the response."

With those five moves, each subagent should land at ~30–40 k input tokens — parallel becomes net cheaper than sequential for batches of 5+ recipes.

**One hard exclusion:** if any of the recipes have existing YAML fixtures to refresh, do not parallelize them. Refresh-mode judgment (Step 5 guardrail) benefits from sequential conversation — a subagent that doesn't see the user's prior ratifications can't tell which body sections to discard, and stale-fixture detection is exactly the kind of call that goes wrong silently in parallel. Mix is fine: parallelize the new-YAML recipes, do refreshes sequentially in the same session.

When in doubt, sequential. The token math only flips at scale (5+ easy recipes); below that, the cheap-prompt scaffolding overhead isn't worth it.

## Things this skill never does

- Fabricate ingredients, steps, or names not present in the live data.
- Auto-create tags or kitchen tools (taxonomy is human-curated).
- Touch `recipes.verified_by` (UUID FK reserved for admin-UI verification).
- Write to MCP `apply_migration` or run any DDL.
- Push to git — output is a YAML file change for human review and commit.
- **Pre-fill the `applied:` block.** The apply CLI auto-writes one entry per change-producing `--apply`. If you copy a YAML's structure as a template, omit any `applied:` block — the reviewer never authors it. (Surfaces in `--list-applied` / `--list-unapplied` for batch tracking.)
