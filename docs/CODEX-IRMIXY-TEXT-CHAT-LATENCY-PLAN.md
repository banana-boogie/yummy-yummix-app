# CODEX Irmixy Text Chat Latency Reduction Plan

## Summary
From logs and code-path review, latency is dominated by the `tool_exec_ms` window in streaming recipe generation (`~14.4s` of `~15.8s`).

The heavy span is:
- `executeToolCalls -> generateCustomRecipe`

Within that span, the likely main cost is the custom-recipe LLM call (`callRecipeGenerationAI`) plus post-processing work (ingredient image enrichment, useful-item matching, safety checks, and cold-cache loads).

This plan reduces both:
1. Real backend latency.
2. Perceived user wait time.

## Current Findings
- `yyx-server/supabase/functions/ai-orchestrator/index.ts` only reports coarse timings, so `tool_exec_ms` is opaque.
- `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts` performs multiple steps in sequence before response completion.
- `yyx-server/supabase/functions/_shared/food-safety.ts` currently normalizes ingredients sequentially in `checkRecipeSafety()` (`for` loop with inner `await normalizeIngredient(...)`), which is a safe and immediate parallelization opportunity.
- Custom recipe generation still uses direct OpenAI `fetch(...)` with retry backoff (1s/2s/4s), which increases tail latency.
- Ingredient fuzzy lookup uses similarity logic but index coverage needs explicit verification/optimization.
- Cache loaders exist, but cold-cache first-hit still adds startup cost.

## Success Criteria
- `recipe_gen` end-to-end streaming latency:
  - `p50 total_ms <= 8s`
  - `p95 total_ms <= 12s`
- First recipe card visible in `<= 6s` for recipe generation flows.
- No quality regressions:
  - schema-valid recipe output rate unchanged or improved
  - safety/allergen behavior unchanged
  - Thermomix compliance unchanged

## Implementation Plan

### Phase A: Immediate Quick Win (Adopted from Claude)
Parallelize ingredient normalization in `checkRecipeSafety()` to remove unnecessary serialization.

Changes:
1. Update `yyx-server/supabase/functions/_shared/food-safety.ts`:
   - Replace sequential normalization loop with `Promise.all(...)` over ingredients.
   - Keep rule matching logic unchanged (still synchronous after normalization).
2. Add/extend tests to verify:
   - safety warnings remain identical for representative recipes.
   - no regression in edge cases (no ingredients, duplicate ingredients, mixed language aliases).
3. Capture pre/post latency snapshot specifically for this function and for overall `tool_exec_ms`.

Expected impact:
1. Fast reduction in safety-check overhead.
2. Useful but not assumed to fully explain all `tool_exec_ms` latency.

### Phase B: Fine-Grained Timing and Correlation
Add detailed sub-phase metrics inside `generateCustomRecipe`:
- `allergen_check_ms`
- `safety_reminders_ms`
- `recipe_llm_ms`
- `thermomix_validation_ms`
- `enrich_images_ms`
- `useful_items_ms`
- `safety_check_ms`
- `tool_total_ms`

Changes:
1. Add per-step timers and one structured summary log per tool execution.
2. Include orchestrator request correlation ID in tool logs.
3. Add timing around `batch_find_ingredients` and useful-items cache miss path.
4. Keep existing `[Timings]` top-level log format for compatibility.

### Phase C: Two-Phase Recipe Response (Perceived Latency)
Implement partial response for custom recipe generation:
1. Add SSE event type `recipe_partial`.
2. Emit `recipe_partial` immediately after recipe LLM generation and schema validation.
3. Continue enrichment and safety checks.
4. Emit final `done` with fully enriched payload.
5. Emit intermediate status `enriching`.

Frontend behavior:
1. Render recipe card on `recipe_partial`.
2. Patch same assistant message on `done` (no duplicates).
3. Preserve current behavior for non-recipe chat/search responses.

### Phase D: Migrate Custom Recipe LLM Call to AI Gateway
Replace direct OpenAI call in `callRecipeGenerationAI` with shared AI gateway.

Requirements:
1. Keep model default `gpt-4o-mini` initially.
2. Keep JSON output constraints and schema validation.
3. Retry policy for recipe path:
   - max 1 retry on transient errors (429/5xx/network)
   - short jittered delay (300ms-600ms)
4. Fallback policy:
   - if gateway fails hard, return current safe error behavior (no silent malformed output).

### Phase E: DB and Post-Processing Optimizations
#### Ingredient match path
1. Ensure `batch_find_ingredients` compares normalized lowercase consistently in exact and fuzzy paths.
2. Only add DB indexes/migrations if instrumentation shows ingredient matching is still a top bottleneck after Phases A-D.

#### Useful-items path
1. Prefetch useful-items cache non-blocking earlier in recipe flow.
2. Add timeout budget for useful-items lookup; fail open to empty list if exceeded.

#### Safety path
1. Keep safety checks blocking final `done`.
2. Do not relax allergen/safety gates for speed.

### Phase F: Prompt and Generation Efficiency (No Quality Loss)
1. Reduce redundant verbosity in Thermomix/system prompt while preserving constraints.
2. Keep hard constraints intact:
   - allergens
   - ingredient dislikes
   - safety reminders
3. Validate output quality before full rollout (see tests).

## API, Interface, and Type Changes
- SSE contract adds:
  - `recipe_partial` event
  - `status: "enriching"`
- Frontend stream reducer/message state must support partial-upsert then final-patch semantics.

## Testing Plan
### Backend tests
1. Streaming contract tests:
   - `session -> status(generating) -> recipe_partial -> status(enriching) -> done`
2. Backward compatibility tests:
   - clients that ignore `recipe_partial` still function with `done`.
3. Tool tests:
   - detailed timing fields emitted
   - gateway retry and timeout behavior
4. Safety quick-win tests:
   - `checkRecipeSafety()` parallel normalization returns same warnings as baseline logic.
   - representative ingredient sets show reduced safety-check elapsed time.
5. Regression tests:
   - safety/allergen behavior unchanged

### Frontend tests
1. Stream event reducer tests:
   - partial render then patch on final
   - no duplicate assistant messages
2. Integration tests for chat screen:
   - same message updated after `done`
   - input state and UX unchanged

### Performance validation
1. Run 30+ recipe generation samples across EN/ES and Thermomix/non-Thermomix users.
2. Compare before/after:
   - `tool_total_ms` and sub-phase timings
   - `total_ms`
   - time-to-first-recipe-card

## Rollout Plan
1. Implement and ship in development order:
   1. safety quick win (`checkRecipeSafety` parallelization) + instrumentation
   2. two-phase SSE + frontend support
   3. AI gateway migration
   4. prompt/system-message efficiency tuning
   5. optional DB index migration only if profiling still points to DB lookup bottlenecks
2. Validate after each step in development:
   - compare `tool_total_ms` and `total_ms` before/after
   - confirm no safety/schema regressions
3. Monitor:
   - `recipe_gen total_ms p95`
   - gateway error rate
   - schema validation failure rate
   - safety warning anomaly rate

## Assumptions and Defaults
1. Default recipe model remains `gpt-4o-mini` initially.
2. Quality guardrail definition:
   - no drop in schema-valid response rate
   - no safety/allergen regressions
   - no Thermomix compliance regressions
3. Safety checks remain blocking for final completion.
4. Two-phase streaming is preferred UX over waiting for full enrichment.
