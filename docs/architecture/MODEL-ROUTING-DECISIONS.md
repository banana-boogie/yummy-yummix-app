# Model Routing Decisions

Records why each AI usage type is routed to a specific provider/model.
Updated when defaults change based on tournament results or production observations.

Source data: `yyx-server/supabase/functions/_eval/output/` tournament reports and `_eval/SCORING-RUBRIC.md`.

---

## Current Defaults (March 2026)

| Usage Type | Model | Provider | Rationale |
|------------|-------|----------|-----------|
| `text` | grok-4-1-fast-non-reasoning | xAI | 100% tool accuracy, 100% success rate, $0.0005/call. See [Round 3](#round-3-orchestrator-swap) |
| `recipe_generation` | gpt-4.1 | OpenAI | Best quality (4.52/5), zero dietary violations, 100% schema validity. See [Round 2](#round-2-recipe-generation--modification-defaults) |
| `recipe_modification` | gpt-4.1-mini | OpenAI | Reliable modification, 100% pass rate. See [Round 3](#round-3-orchestrator-swap) |
| `parsing` | gpt-4.1-nano | OpenAI | Cheapest viable model for structured extraction |
| `embedding` | text-embedding-3-large | OpenAI | 3072-dim vectors, best retrieval quality for hybrid search |

---

## Decision Log

### Round 3: Orchestrator Swap

**Date:** 2026-03-11
**Changes:**
- `text` switched from `gemini-3-flash-preview` to `grok-4-1-fast-non-reasoning`
- `recipe_modification` switched from `gemini-3-flash-preview` to `gpt-4.1-mini`
- `gemini-3-flash-preview` removed from all default roles

**Problem:** In production, gemini-3-flash-preview fabricated tool errors and streamed them directly to users:
- Generated fake Zod validation errors (`Validation failed: [{"code":"invalid_type"...}]`) for optional fields
- Dumped raw recipe JSON as conversational text instead of calling `generate_custom_recipe`
- These errors streamed token-by-token to the user with no way to intercept without adding fragile sanitizer complexity

**Why remove gemini-3-flash-preview entirely:**
Despite scoring well in eval (4.70/5 conversation quality, 100% tool accuracy), the model proved unreliable in production. Eval conditions don't fully replicate the production prompt/constraint path, and the fabricated-error behavior was not caught by the tournament harness. A model that looks good in benchmarks but breaks in production is not trustworthy as a default or fallback.

**Why grok-4-1-fast-non-reasoning for orchestrator:**

| Metric | gemini-3-flash-preview | grok-4-1-fast-non-reasoning |
|--------|----------------------|----------------------------|
| Tool accuracy | 100% (eval), fabricated errors in prod | 100% |
| Success rate | 100% | 100% |
| Avg latency | 2.4s | 2.5s |
| Cost/call | $0.0015 | $0.0005 |
| Conversation quality | 4.70/5 | 4.55/5 |
| Safety/boundaries | Good | 5/5 (perfect) |

The 0.15-point quality gap is outweighed by no fabricated errors, 1/3 the cost, and perfect safety.

**Why gpt-4.1-mini for recipe modification:**
- 100% pass rate, 100% schema validity, 100% TMX compliance
- 11.2s latency, $0.0025/call
- Reliable OpenAI provider — same provider as recipe generation reduces API key surface

---

### Round 2: Recipe Generation Defaults

**Date:** 2026-03-11
**Change:** `recipe_generation` set to `gpt-4.1`

**Why gpt-4.1:**
- Best overall quality score (4.52/5) across culinary sense, dietary compliance, TMX params, portions, language
- Zero dietary violations (never added gluten for gluten-free users, never used cilantro)
- 100% schema validity, 100% pass rate
- 7.0 kitchen tools per recipe (highest of all models)
- 12.1s latency is acceptable for a quality-critical path (user sees progress tracker)
- $0.013/call is higher but justified for the quality difference

**Models considered but not selected:**
- `grok-4-1-fast-non-reasoning`: Good (100% pass, 7.4s, $0.0009) but lower quality scores
- `gemini-2.5-flash`: Fast (6.4s) and cheap ($0.0036) but lower quality
- `gpt-4.1-mini`: 100% pass but slower (13.8s) and lower quality for same provider

---

### Round 1: Initial Tournament

**Date:** 2026-03-09
**Tournament:** 10 models tested across orchestrator, recipe generation, and recipe modification roles.

**Eliminated:**
- `gemini-3.1-flash-lite`: 0% success across all roles — cannot follow tool schemas
- `grok-4-1-fast-reasoning`: Extremely slow (50s+), low pass rates — reasoning overhead hurts
- `gemini-2.5-pro`: Failed on most tasks without `low` reasoning — too expensive when it works
- `gpt-5-mini`: Inconsistent (25-100% depending on reasoning), very slow (25-58s)
- `claude-haiku-4-5`: Poor schema compliance for recipe gen (42% at best), extremely slow with reasoning
