# Irmixy Speed Upgrade Plan

## Problem
Irmixy responses feel slow. Custom recipe generation takes 1.4-1.7s (edge function time), and users expect faster interactions.

## Objectives
- Reduce response latency by 30-40%
- Improve perceived speed through earlier streaming
- Maintain recipe quality, safety checks, and bilingual support
- Ship changes safely with measurable results

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to first token (p50) | ~800ms | < 500ms |
| Chat response (p50) | 300-500ms | < 400ms |
| Recipe generation (p50) | 1.4-1.7s | < 1.2s |
| Recipe generation (p95) | ~2.5s | < 2.0s |

**Quality gates (must not regress):**
- Recipe schema validity ≥ 99.5%
- Safety checks pass rate unchanged
- Bilingual (EN/ES) quality unchanged
- No increase in user correction rate

---

## Root Cause Analysis

### Confirmed Bottlenecks

**1. Unused Intent Classification** (HIGH IMPACT)
- Location: `ai-orchestrator/index.ts:864-870`
- Makes LLM call on EVERY request
- Result only used for logging - never used downstream
- Cost: ~300ms per request for zero benefit

**2. Sequential Post-Recipe Operations** (MEDIUM IMPACT)
- Location: `generate-custom-recipe.ts:138-168`
- Three independent operations run sequentially:
  - `enrichIngredientsWithImages()` - line 138
  - `getRelevantUsefulItems()` - line 154
  - `checkRecipeSafety()` - line 162
- Cost: 200-400ms that could be parallelized

**3. Delayed Streaming Start** (PERCEIVED SPEED)
- Response streaming doesn't start until context is fully built
- User sees nothing while we prepare

**4. Input Blocked During Suggestion Loading** (PERCEIVED SPEED - FRONTEND)
- Location: `ChatScreen.tsx`
- Input is disabled while waiting for suggestion chips to load
- User cannot start typing their next message until suggestions arrive
- Makes the app feel unresponsive after AI response completes

### Not Bottlenecks (Verified)

| Item | Status | Reason |
|------|--------|--------|
| Ingredient image lookups | ✅ Already parallel | Uses `Promise.allSettled()` |
| Modification detection | ✅ Necessary | Drives recipe regeneration feature |
| Fuzzy search fallbacks | ✅ Needed | Required for ingredient matching UX |

---

## Implementation Plan

### Phase 0: Instrumentation (30 min)

Add timing logs to measure before/after:

```typescript
// Add to ai-orchestrator/index.ts
const timings = {
  context_build_ms: 0,
  llm_call_ms: 0,
  tool_exec_ms: 0,
  post_process_ms: 0,
  total_ms: 0,
  tokens_in: 0,
  tokens_out: 0,
};
```

Log at end of each request. Group by request type (chat, recipe gen, modification).

**Exit criteria:** Can identify time spent in each phase from logs.

---

### Phase 1: Quick Wins (1-2 hours total)

#### Fix 1.1: Remove Dead Intent Classification
**Savings:** ~300ms per request | **Effort:** 5 min

**File:** `ai-orchestrator/index.ts`

```typescript
// DELETE lines 864-870:
const intent = await classifyUserIntent(message);
console.log("[Intent Classification]", {
  userId,
  intent: intent.intent,
  hasIngredients: intent.hasIngredients,
  confidence: intent.confidence,
});
```

Keep the function for potential future analytics, but remove from hot path.

#### Fix 1.2: Parallelize Post-Recipe Operations
**Savings:** 200-400ms per recipe | **Effort:** 15 min

**File:** `generate-custom-recipe.ts`

```typescript
// BEFORE (lines 138-168):
recipe.ingredients = await enrichIngredientsWithImages(...);
recipe.usefulItems = await getRelevantUsefulItems(...);
const safetyCheck = await checkRecipeSafety(...);

// AFTER:
const [enrichedIngredients, usefulItems, safetyCheck] = await Promise.all([
  enrichIngredientsWithImages(recipe.ingredients, supabase, userContext.language),
  getRelevantUsefulItems(supabase, recipe, userContext.language, hasThermomix),
  checkRecipeSafety(supabase, recipe.ingredients, recipe.totalTime, userContext.measurementSystem, userContext.language),
]);
recipe.ingredients = enrichedIngredients;
recipe.usefulItems = usefulItems;
```

#### Fix 1.3: Start Streaming Earlier
**Savings:** Perceived speed improvement | **Effort:** 30 min

Send a "thinking" status event immediately when request is received, before context building completes. User sees activity faster.

```typescript
// At start of handleStreamingRequest:
yield { type: 'status', status: 'thinking' };

// Then proceed with context building...
```

#### Fix 1.4: Trim Prompt Context (Optional)
**Savings:** 50-100ms + reduced token costs | **Effort:** 30 min

Compact the context sent to the LLM:
- Keep only recent conversation messages (last 10)
- Compress user profile to essential fields
- Remove redundant context fields

#### Fix 1.5: Unblock Input During Suggestion Loading (Frontend)
**Savings:** Perceived responsiveness | **Effort:** 15 min

**File:** `ChatScreen.tsx`

Currently, the text input is disabled while waiting for suggestion chips to arrive. Users should be able to start typing immediately after the AI response text completes.

```typescript
// Change input disabled logic:
// BEFORE: disabled={isLoading || waitingForSuggestions}
// AFTER: disabled={isLoading}  // Don't wait for suggestions
```

Suggestions can load in the background and appear when ready without blocking user input.

**Phase 1 Exit Criteria:**
- p50 recipe generation < 1.2s
- Time to first token < 500ms
- No quality gate failures

---

### Phase 2: Pipeline Improvements (Week 2, if Phase 1 insufficient)

1. **Parallelize context loading**
   - Load user profile, conversation history, and resumable session in parallel
   - Savings: 50-100ms

2. **Add ingredient image cache**
   - In-memory cache with 5-10 min TTL
   - Helps repeated ingredients across requests

3. **Timeout budgets with fallbacks**
   - If non-critical enrichment (images, useful items) times out, return response anyway
   - Safety checks remain mandatory

4. **Bounded inference loop**
   - Limit to 2 LLM calls max: decision + synthesis
   - Prevent unbounded tool-call loops

---

## Verification Plan

### Test Cases
Run before and after each change:

| Test | Type | What to Check |
|------|------|---------------|
| "What's the difference between baking and roasting?" | Chat | Response time, quality |
| "Make me a pasta with tomatoes and basil" | Recipe gen | Time, schema validity, completeness |
| "Make it spicier" | Modification | Time, recipe updated correctly |
| "Hazme una receta con pollo" | Spanish | Bilingual quality preserved |
| Recipe with user allergens set | Safety | Allergen warnings still appear |

### Quality Checklist
- [ ] Recipe JSON schema validates
- [ ] Safety warnings appear when expected
- [ ] Bilingual responses work (EN/ES)
- [ ] Thermomix parameters present when user has Thermomix
- [ ] Modification flow still works
- [ ] Streaming displays correctly in app
- [ ] Can type immediately after AI response (before suggestions load)

### Rollout Strategy
1. Deploy to staging, run full test checklist
2. Deploy to production at 10% traffic (if feature flags available)
3. Monitor logs for 24h, compare latency + error rates
4. Expand to 100% if gates pass

**Rollback trigger:**
- Any quality gate failure
- p95 latency regression > 10%
- Safety check failures increase

---

## Files to Modify

| File | Change |
|------|--------|
| `ai-orchestrator/index.ts` | Remove lines 864-870, add timing logs, earlier streaming |
| `generate-custom-recipe.ts` | Parallelize lines 138-168 |
| `ChatScreen.tsx` | Unblock input while suggestions load |

---

## Completion Status

| Fix | Status | Notes |
|-----|--------|-------|
| Phase 0: Instrumentation | ✅ Done | Timing logs added to ai-orchestrator |
| Fix 1.1: Remove intent classification | ✅ Done | Removed call and dead function |
| Fix 1.2: Parallelize post-recipe | ✅ Done | Promise.all() for 3 operations |
| Fix 1.3: Start streaming earlier | ✅ Already done | "thinking" status sent at line 1063 |
| Fix 1.4: Trim prompt context | ⏭️ Skipped | Optional, marginal gains |
| Fix 1.5: Unblock input | ✅ Done | setIsLoading(false) in onComplete |

## Expected Results

| Fix | Savings | Effort |
|-----|---------|--------|
| Remove intent classification | ~300ms | 5 min |
| Parallelize post-recipe | 200-400ms | 15 min |
| Start streaming earlier | Perceived speed | 30 min |
| Trim prompt context | 50-100ms | 30 min |
| Unblock input during suggestions | Perceived responsiveness | 15 min |
| **Phase 1 Total** | **500-800ms (30-40%)** | **~1.5 hours** |

**Recipe generation: 1.4-1.7s → ~1.0-1.2s**
**Time to first token: ~800ms → ~300-500ms**

---

## Client-Side Improvements (Future)

Additional improvements to consider after Phase 1:
- Progressive rendering for streaming responses
- Graceful handling when metadata (images, useful items) arrives after text
- Skeleton loaders for recipe cards during generation
