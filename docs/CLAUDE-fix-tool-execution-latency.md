# Irmixy Text Chat Latency Reduction Plan

Consolidated from CODEX-IRMIXY-TEXT-CHAT-LATENCY-PLAN.md.

## Problem

From logs, latency is dominated by `tool_exec_ms` in streaming recipe generation (~14.4s of ~15.8s total).

The heavy span is `executeToolCalls -> generateCustomRecipe`, which includes:
- Custom recipe LLM call
- Post-processing (ingredient images, useful items, safety checks)
- Cold-cache loads on first hit

## Success Criteria

| Metric | Target |
|--------|--------|
| Recipe generation p50 | ≤ 8s |
| Recipe generation p95 | ≤ 12s |
| First recipe card visible | ≤ 6s |
| Schema validity | No regression |
| Safety/allergen behavior | Unchanged |

---

## Implementation Phases

### Phase A: checkRecipeSafety Parallelization (Quick Win)

**File:** `yyx-server/supabase/functions/_shared/food-safety.ts`

Replace sequential normalization with `Promise.all()`:

```typescript
// BEFORE (sequential):
for (const ingredient of ingredients) {
  const normalized = await normalizeIngredient(supabase, ingredient.name, language);
  // rule matching...
}

// AFTER (parallel):
const normalizedNames = await Promise.all(
  ingredients.map((ingredient) =>
    normalizeIngredient(supabase, ingredient.name, language)
  )
);

for (const normalized of normalizedNames) {
  // rule matching (unchanged)...
}
```

**Tests needed:**
- Safety warnings remain identical for representative recipes
- Edge cases: no ingredients, duplicates, mixed language aliases

---

### Phase B: Fine-Grained Instrumentation

**File:** `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts`

Add per-step timers:

```typescript
const timings: Record<string, number> = {};
const mark = (label: string, start: number) => {
  timings[label] = Date.now() - start;
};

const t0 = Date.now();
// ... allergen check
mark('allergen_check_ms', t0);

const t1 = Date.now();
// ... safety reminders
mark('safety_reminders_ms', t1);

// ... etc for each step

console.log('[GenerateRecipe Timings]', timings);
```

Metrics to capture:
- `allergen_check_ms`
- `safety_reminders_ms`
- `recipe_llm_ms`
- `thermomix_validation_ms`
- `enrich_images_ms`
- `useful_items_ms`
- `safety_check_ms`
- `tool_total_ms`

---

### Phase C: Two-Phase SSE (Perceived Latency)

Emit partial recipe immediately after LLM generation, before enrichment.

**Backend changes:**

1. Add SSE event type `recipe_partial`
2. Emit `recipe_partial` after recipe LLM + schema validation
3. Emit `status: "enriching"` during post-processing
4. Emit final `done` with fully enriched payload

**SSE flow:**
```
session -> status(generating) -> recipe_partial -> status(enriching) -> done
```

**Frontend changes:**

1. Render recipe card on `recipe_partial`
2. Patch same assistant message on `done` (no duplicates)
3. Clients that ignore `recipe_partial` still work with `done`

---

### Phase D: Migrate Recipe LLM to AI Gateway

**File:** `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts`

Replace direct OpenAI `fetch()` with shared AI gateway:

```typescript
// BEFORE:
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  // ... manual retry logic with 1s/2s/4s backoff
});

// AFTER:
import { chat } from '../ai-gateway/index.ts';

const response = await chat({
  usageType: 'text',
  messages: [...],
  temperature: 0.7,
  responseFormat: { type: 'json_schema', schema: recipeSchema },
});
```

**Requirements:**
- Keep model default `gpt-4o-mini`
- Keep JSON schema validation
- Retry: max 1 retry on 429/5xx, 300-600ms jittered delay
- On hard failure: return safe error (no malformed output)

---

### Phase E: DB and Post-Processing (Conditional)

Only if instrumentation shows these are still bottlenecks after A-D.

**Ingredient match path:**
- Ensure `batch_find_ingredients` uses consistent lowercase normalization
- Add DB indexes only if profiling points to DB lookups

**Useful-items path:**
- Prefetch cache earlier in recipe flow
- Add timeout budget; fail open to empty list if exceeded

**Safety path:**
- Keep safety checks blocking final `done`
- Never relax allergen/safety gates for speed

---

### Phase F: Prompt Efficiency

Reduce verbosity in Thermomix/system prompt while preserving constraints.

**Keep intact:**
- Allergen constraints
- Ingredient dislikes
- Safety reminders
- Thermomix parameters

**Validate:** Run quality tests before rollout.

---

## Files to Modify

| Phase | File | Change |
|-------|------|--------|
| A | `_shared/food-safety.ts` | Parallelize normalizeIngredient calls |
| B | `_shared/tools/generate-custom-recipe.ts` | Add per-step timing logs |
| C | `ai-orchestrator/index.ts` | Add `recipe_partial` SSE event |
| C | `yyx-app/` (frontend) | Handle partial render + patch |
| D | `_shared/tools/generate-custom-recipe.ts` | Replace fetch with AI gateway |
| E | DB migrations | Add indexes if needed |
| F | `_shared/tools/generate-custom-recipe.ts` | Compact prompts |

---

## Rollout Sequence

1. **Phase A** - checkRecipeSafety parallelization + instrumentation
2. **Phase C** - Two-phase SSE + frontend support
3. **Phase D** - AI gateway migration
4. **Phase F** - Prompt efficiency tuning
5. **Phase E** - DB index migration (only if profiling shows need)

After each step:
- Compare `tool_total_ms` and `total_ms` before/after
- Confirm no safety/schema regressions

---

## Testing Plan

### Backend
- Streaming contract: `session -> status(generating) -> recipe_partial -> status(enriching) -> done`
- Backward compatibility: clients ignoring `recipe_partial` still work
- Safety: parallel normalization returns same warnings as sequential
- Timing fields emitted correctly

### Frontend
- Partial render then patch on final
- No duplicate assistant messages
- Input state and UX unchanged

### Performance
- Run 30+ recipe samples (EN/ES, Thermomix/non-Thermomix)
- Compare before/after timings and time-to-first-recipe-card

---

## Verification Commands

```bash
cd yyx-server

# Deploy after each phase
npm run deploy ai-orchestrator

# Check logs for timing improvements
npm run logs ai-orchestrator

# Run tests
deno task test
```
