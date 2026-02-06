# CODEX-IRMIXY-SPEED-UPGRADE

## Problem and Goal
Irmixy responses and custom recipe generation need to be faster, without reducing recipe quality, safety, bilingual quality, or personalization.

Primary goals:
- Improve real user-perceived speed.
- Keep quality stable or better.
- Ship changes safely with measurable gates.

## Current Baseline (from logs)

| Request Type | Observed Time |
|--------------|---------------|
| Simple chat responses | 250-500ms |
| Recipe generation | 1.4-1.7s |
| Recipe generation p95 | ~2.5s |

Notes:
- Values above are edge function execution times.
- End-to-end user latency is higher due to network and client rendering.

## Targets and Guardrails

### Immediate performance targets (Phase 1)
| Metric | Current | Target |
|--------|---------|--------|
| Chat response (p50, edge) | 300-500ms | < 400ms |
| Recipe generation (p50, edge) | 1.4-1.7s | < 1.2s |
| Recipe generation (p95, edge) | ~2.5s | < 2.0s |

### Product-level latency targets (Phase 2+)
- `TTFT` (time to first token), chat: p50 `< 1.0s`, p95 `< 1.8s`
- `TTR` (time to response complete), chat: p50 `< 2.5s`, p95 `< 4.0s`

### Quality guardrails (must not regress)
- Response schema validity `>= 99.5%`
- Allergen/diet safety conflict rate: no increase
- EN/ES quality score (internal set): no drop > 2%
- User correction rate on generated recipes: no increase > 5%
- Thermomix parameters remain present for Thermomix users

## Root Cause Analysis

### Confirmed bottlenecks
1. Unused intent classification call in hot path
   - Location: `yyx-server/supabase/functions/ai-orchestrator/index.ts:864`
   - Makes an LLM call for every request, but only logs the result
   - Estimated savings: ~300ms per request
2. Sequential post-recipe operations
   - Locations: `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts:138`, `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts:154`, `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts:162`
   - Three independent operations are serialized
   - Estimated savings: 200-400ms per recipe generation

### Not bottlenecks (verified)
- Ingredient image lookups are already parallelized with `Promise.allSettled()`
- Modification detection is required for recipe regeneration behavior
- Fuzzy ingredient fallback logic is important for UX coverage

## Implementation Plan

### Phase 0: Instrumentation and Baseline (30-60 min)
1. Add stage-level timers in orchestrator and recipe tool paths
2. Emit structured logs:
   - `context_build_ms`
   - `intent_classification_ms` (temporary baseline only, then remove)
   - `llm_call_1_ms`
   - `tool_exec_ms`
   - `llm_call_2_ms`
   - `post_process_ms`
   - `total_ms`
   - `tokens_in`
   - `tokens_out`
3. Build dashboard views by endpoint and request type:
   - General chat
   - Custom recipe generation
   - Recipe modification
4. Build fixed EN/ES quality regression prompt set

Exit criteria:
- Top latency contributors are evidence-backed from logs

### Phase 1: Immediate High-Impact Fixes (same day)

#### Fix 1: Remove dead intent classification from hot path
Location:
- `yyx-server/supabase/functions/ai-orchestrator/index.ts:864`

Change:
```typescript
// Remove from request path:
const intent = await classifyUserIntent(message);
console.log("[Intent Classification]", {
  userId,
  intent: intent.intent,
  hasIngredients: intent.hasIngredients,
  confidence: intent.confidence,
});
```

Keep the function for optional offline analytics, but do not execute it in live request flow.

#### Fix 2: Parallelize independent post-recipe tasks
Location:
- `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts:138`

Change:
```typescript
// BEFORE:
recipe.ingredients = await enrichIngredientsWithImages(...);
recipe.usefulItems = await getRelevantUsefulItems(...);
const safetyCheck = await checkRecipeSafety(...);

// AFTER:
const [enrichedIngredients, usefulItems, safetyCheck] = await Promise.all([
  enrichIngredientsWithImages(recipe.ingredients, supabase, userContext.language),
  getRelevantUsefulItems(supabase, recipe, userContext.language, hasThermomix),
  checkRecipeSafety(
    supabase,
    recipe.ingredients,
    recipe.totalTime,
    userContext.measurementSystem,
    userContext.language
  ),
]);
recipe.ingredients = enrichedIngredients;
recipe.usefulItems = usefulItems;
// Safety check handling remains unchanged
```

#### Additional Phase 1 improvements
1. Start response streaming earlier with immediate status event
2. Trim oversized prompt context to recent messages plus compact profile summary
3. Keep safety and schema validation mandatory

Phase 1 expected impact:

| Optimization | Estimated Savings | Effort |
|--------------|-------------------|--------|
| Remove unused intent classification | ~300ms | ~5 min |
| Parallelize post-recipe operations | 200-400ms | ~15 min |
| Total (quick wins) | 500-700ms | ~20 min |

For recipe generation, this can move ~1.4-1.7s to about ~1.0-1.2s in edge execution time.

Exit criteria:
- Recipe generation p50 < 1.2s and p95 < 2.0s
- No quality guardrail failures

### Phase 2: Pipeline Improvements (Week 2, only if needed)
Only continue if Phase 1 does not meet targets:
1. Use bounded 2-step inference flow (no unbounded tool-call loops)
2. Parallelize context retrieval (profile, preferences, memory summary, session)
3. Add short-lived caches:
   - Ingredient image metadata
   - Useful item catalogs
   - Prompt/language assets
4. Add stage timeouts and graceful fallback:
   - Non-critical enrichments must not block full response
   - Safety checks must never be skipped

Exit criteria:
- p95 custom recipe latency improves at least 30% from original baseline
- Safety checks and schema validity remain stable

### Phase 3: Quality-Preserving Performance (Week 3)
1. Compact prompts while preserving critical constraints
2. Add routing policy:
   - Faster path for low-complexity turns
   - Higher-quality path for recipe generation and safety-sensitive turns
3. Add deterministic post-processing:
   - Unit normalization
   - Ingredient naming normalization
4. Precompute compact personalization summaries outside request path

Exit criteria:
- TTFT and TTR targets met
- EN/ES quality and safety gates pass

## Verification Plan

### Test cases
Run before and after each change:

| Test | Type | What to Check |
|------|------|---------------|
| "What's the difference between baking and roasting?" | Chat | Response time and answer quality |
| "Make me a pasta with tomatoes and basil" | Recipe generation | Time, schema validity, completeness |
| "Make it spicier" | Recipe modification | Time and recipe update correctness |
| "Hazme una receta con pollo" | Spanish | Bilingual quality preserved |
| Recipe request with user allergens | Safety | Allergen warnings still appear |

### Quality checklist
- [ ] Recipe JSON schema validates
- [ ] Safety warnings appear when expected
- [ ] Bilingual responses work in EN and ES
- [ ] Thermomix parameters appear when user has Thermomix
- [ ] Modification flow still works

## Rollout and Rollback
1. Ship each phase behind feature flags
2. Canary at 10% traffic for 24 hours
3. Compare canary vs control:
   - p50 and p95 latency
   - schema errors
   - safety conflicts
   - user correction and follow-up rate
4. Expand to 50%, then 100% only if all gates pass

Rollback rule:
- Disable flag immediately if safety conflict rises or quality drops beyond threshold

## Files to Modify (Phase 1)

| File | Change |
|------|--------|
| `yyx-server/supabase/functions/ai-orchestrator/index.ts` | Remove intent classification hot-path call; add phase timers |
| `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts` | Parallelize post-recipe operations with `Promise.all()` |

## Expected Results

| Phase | Savings | Effort |
|-------|---------|--------|
| Phase 1.1 Remove intent classification | ~300ms | ~5 min |
| Phase 1.2 Parallelize post-recipe operations | 200-400ms | ~15 min |
| Phase 1 total | 500-700ms (30-40%) | ~20 min |
| Phase 2 (if needed) | Additional 100-200ms | 2-4 hours |

Expected recipe generation runtime:
- 1.4-1.7s -> ~1.0-1.2s (edge execution)

## Execution Sequence
1. Implement Phase 0 instrumentation and baseline capture
2. Ship Phase 1 quick wins behind a feature flag
3. Run EN/ES quality regression suite and manual checklist
4. Canary deploy and evaluate latency plus quality gates
5. Continue to Phase 2 and Phase 3 only if Phase 1 targets are not met
