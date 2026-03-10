# AI Model Selection — Tournament Results

**Date:** March 9, 2026
**Branch:** feature/ai-model-tournament
**Total tournament cost:** $0.64 across 3 runs

---

## Summary

We ran an eval tournament across 9 models from 4 providers to find the best model per role (orchestrator, recipe generation, recipe modification). The tournament tests real production prompts against our schema validation, tool calling, and Thermomix-specific requirements.

---

## Models Tested

| Model | Provider | Input $/MTok | Output $/MTok | Reasoning | Result |
|-------|----------|-------------|--------------|-----------|--------|
| gemini-2.5-flash-lite | Google | $0.10 | $0.40 | yes | Kept |
| gemini-2.5-flash | Google | $0.30 | $2.50 | yes | Kept |
| gemini-3-flash-preview | Google | $0.50 | $3.00 | yes | Kept |
| gpt-4.1-mini | OpenAI | $0.40 | $1.60 | no | Kept |
| gpt-4.1-nano | OpenAI | $0.10 | $0.40 | no | Kept |
| claude-haiku-4-5 | Anthropic | $1.00 | $5.00 | yes | Kept (non-primary use cases) |
| grok-4-1-fast-non-reasoning | xAI | $0.20 | $0.50 | no | Kept |
| gpt-5-mini | OpenAI | $0.25 | $2.00 | yes | **Removed** |
| grok-4-1-fast-reasoning | xAI | $0.20 | $0.50 | always on | **Removed** |

---

## Models Removed (and why)

### Removed pre-tournament

| Model | Provider | Reason |
|-------|----------|--------|
| gpt-5 | OpenAI | $10/MTok output — too expensive for production at any traffic level |
| gpt-5-nano | OpenAI | Deprecated/unavailable — API returned errors |
| claude-sonnet-4-6 | Anthropic | $15/MTok output — too expensive even as fallback |
| gemini-2.5-pro | Google | $10/MTok output — same tier as gpt-5, not viable |

### Removed after tournament

| Model | Provider | Reason |
|-------|----------|--------|
| gpt-5-mini | OpenAI | **Too slow and unreliable.** 11% orchestrator success (no reasoning), 0% recipe gen without reasoning (30s timeout). Even with reasoning enabled: 16-24s for recipe gen vs 5-6s for Gemini models. Not competitive at $2/MTok output when cheaper models score 100%. |
| grok-4-1-fast-reasoning | xAI | **Too slow for all roles.** 17% recipe gen (29.6s avg, hitting 30s timeout), 50% recipe mod (22.7s avg). Always reasons internally without control, making it unpredictably slow. The non-reasoning variant is fast and viable. |

---

## Tournament Results

### Orchestrator (tool calling, 5s timeout)

Tests whether the model picks the correct tool (or correctly chats without calling a tool) across 9 scenarios including multi-turn conversations and prompt injection.

| Model | Success Rate | Avg Latency | tok/s | Avg Cost/call |
|-------|-------------|-------------|-------|---------------|
| **gemini-3-flash-preview** | **100%** | 3.2s | 34 | $0.0016 |
| **gpt-4.1-mini** | **100%** | 2.6s | 23 | $0.001 |
| grok-4-1-fast-non-reasoning | 89% | 3.8s | 21 | $0.0005 |
| claude-haiku-4-5 | 78% | 3.0s | 69 | $0.004 |
| gemini-2.5-flash-lite (minimal) | 67% | 1.8s | 34 | $0.0003 |
| gemini-2.5-flash | 67% | 2.2s | 33 | $0.0009 |
| gpt-4.1-nano | 67% | 2.4s | 25 | $0.0002 |

### Recipe Generation (structured JSON, 30s timeout)

Tests whether the model produces valid, schema-compliant recipe JSON with Thermomix parameters across 6 recipe types.

| Model | Pass Rate | Avg Latency | tok/s | Avg Cost/call |
|-------|-----------|-------------|-------|---------------|
| **gemini-2.5-flash-lite** | **100%** (all variants) | 5.6s | 234 | $0.0006 |
| **gemini-2.5-flash** | **100%** (all variants) | 6.0s | 170 | $0.0028 |
| **gemini-3-flash-preview** | **100%** (all variants) | 5.8s | 118 | $0.0026 |
| **gpt-4.1-mini** | **100%** | 8.6s | 74 | $0.0015 |
| **gpt-4.1-nano** | **100%** | 6.6s | 74 | $0.0003 |
| **grok-4-1-fast-non-reasoning** | **100%** | 5.9s | 104 | $0.0006 |
| claude-haiku-4-5 (no-reasoning) | 83% | 7.8s | 165 | $0.0086 |

Note: claude-haiku with reasoning enabled (minimal/low) produces very long outputs (3-4K tokens vs ~1.3K without), causing 30s timeouts. Without reasoning it works but missed 1/6 (missing `totalTime` field).

### Recipe Modification (structured JSON, 30s timeout)

Tests modifying an existing recipe (scale portions, remove allergen, dietary adaptation, simplify).

| Model | Pass Rate | Avg Latency | tok/s | Avg Cost/call |
|-------|-----------|-------------|-------|---------------|
| **All Google models** | **100%** | 4-6s | 102-246 | $0.0006-0.003 |
| **gpt-4.1-mini** | **100%** | 7.8s | 67 | $0.0017 |
| **gpt-4.1-nano** | **100%** | 6.9s | 75 | $0.0004 |
| **grok-4-1-fast-non-reasoning** | **100%** | 5.2s | 143 | $0.0008 |
| **claude-haiku-4-5** | **100%** | 13.1s | 173 | $0.014 |

---

## Key Findings

### 1. Reasoning effort doesn't improve recipe quality

For recipe generation, all three reasoning levels (none, minimal, low) produced 100% pass rates on models that work. The extra thinking tokens add latency and cost without measurable quality improvement for structured JSON output. For claude-haiku, reasoning actually hurts — output tokens balloon from ~1.3K to 3-4K, causing timeouts.

### 2. Schema enforcement is essential

Previous runs (pre-tournament) showed 0-33% pass rate without JSON schema enforcement vs 100% with it. No meaningful latency impact. Always use `responseFormat` with schema.

### 3. Orchestrator tool calling is the hardest test

The multi-turn test case `conv-8-clarify-then-generate` (user gives vague input, model should clarify, then user provides specifics, model should call generate tool) failed across many models. Models tend to keep chatting instead of calling the tool after clarification.

### 4. Budget models are surprisingly capable for recipe gen

gpt-4.1-nano ($0.40/MTok) and gemini-2.5-flash-lite ($0.40/MTok) both achieve 100% recipe gen pass rate — same as models costing 5-10x more. For structured output with schema enforcement, the cheapest models work fine.

### 5. Orchestrator requires smarter models

Unlike recipe gen, tool calling quality varies dramatically. Only gemini-3-flash-preview and gpt-4.1-mini achieved 100%. Budget models (nano, flash-lite) dropped to 56-67%. This role benefits from model intelligence.

### 6. Anthropic is expensive and rate-limited but high quality

claude-haiku-4-5 produces excellent recipe quality (natural Spanish, good Thermomix params) but at 10-12x the cost of budget models and with a restrictive 50K TPM rate limit on the starter tier. Not viable as a primary model for user-facing features, but could serve well for lower-volume internal tasks (recipe parsing, admin translations, content generation).

---

## Provider Bugs Found and Fixed

| Bug | Impact | Fix |
|-----|--------|-----|
| Anthropic: `tool_choice: { type: "tool" }` incompatible with extended thinking | All Anthropic recipe gen/mod with reasoning failed (400 error) | Use `tool_choice: auto` when thinking is enabled |
| OpenAI: sending `temperature` to reasoning models | gpt-5-mini no-reasoning variant rejected temperature param (400 error) | Skip temperature for reasoning-capable models |
| xAI: wrong model ID `grok-4-1-fast` | All grok non-reasoning calls silently hung (timeout) | Correct ID is `grok-4-1-fast-non-reasoning` |
| Anthropic: API version `2025-04-15` invalid | All Anthropic calls failed | Correct version is `2023-06-01` |
| Anthropic: rate limiting at 50K TPM | Running 44 parallel calls exceeded rate limit | Added concurrency limiter (max 2 concurrent Anthropic calls) |

---

## Final Model Selection (7 models)

| Model | Provider | Output $/MTok | Best Role |
|-------|----------|--------------|-----------|
| gemini-2.5-flash-lite | Google | $0.40 | Recipe gen/mod (cheapest 100% option) |
| gemini-2.5-flash | Google | $2.50 | Current production default |
| gemini-3-flash-preview | Google | $3.00 | Orchestrator (100%, upgrade candidate when stable) |
| gpt-4.1-mini | OpenAI | $1.60 | Orchestrator (100%, fast, stable) |
| gpt-4.1-nano | OpenAI | $0.40 | Recipe gen fallback (100%, different provider) |
| claude-haiku-4-5 | Anthropic | $5.00 | Internal tasks (parsing, translations, admin tools) |
| grok-4-1-fast-non-reasoning | xAI | $0.50 | Fallback (89% orch, 100% recipe, cheap) |

---

## Recommended Model Selection Per Role

### Orchestrator (tool calling + chat)
- **Primary:** gemini-2.5-flash (current default, 67% in eval but proven in production with streaming)
- **Upgrade candidate:** gpt-4.1-mini (100%, 2.6s, stable) or gemini-3-flash-preview (100%, when out of preview)
- **Fallback:** grok-4-1-fast-non-reasoning (89%, different provider, cheapest)

### Recipe Generation (structured JSON)
- **Primary:** gemini-2.5-flash-lite (100%, cheapest at $0.40/MTok, fastest at 234 tok/s)
- **Fallback:** gpt-4.1-nano (100%, different provider, $0.40/MTok)

### Recipe Modification (structured JSON)
- **Primary:** gemini-2.5-flash-lite (100%, 4.1s, cheapest)
- **Fallback:** grok-4-1-fast-non-reasoning (100%, 5.2s, different provider)

### Internal/Admin Tasks (parsing, translations)
- **Primary:** gpt-4.1-nano (current parsing default, cheapest)
- **Alternative:** claude-haiku-4-5 (higher quality text, good for admin content tasks where rate limits aren't an issue)

---

## Next Steps

1. Implement fallback provider logic in AI Gateway (hardcoded per feature, not env vars)
2. Manual recipe quality review using criteria (culinary sense, dietary constraints, Thermomix params, portions, Spanish quality)
3. Consider upgrading orchestrator from gemini-2.5-flash to gpt-4.1-mini (stable, 100% tool accuracy)
4. Consider switching recipe gen/mod primary to gemini-2.5-flash-lite (6x cheaper than current gemini-2.5-flash, same 100% pass rate)

---

## Cost Analysis

**Tournament cost:** $0.64 total across 3 runs

**Estimated per-request production cost:**

| Role | Primary Model | Cost/request |
|------|--------------|-------------|
| Orchestrator | gemini-2.5-flash | ~$0.001 |
| Recipe Generation | gemini-2.5-flash-lite | ~$0.0006 |
| Recipe Modification | gemini-2.5-flash-lite | ~$0.0006 |

At 1,000 requests/day: ~$2.20/day, ~$66/month.

**Potential savings by switching orchestrator to gpt-4.1-mini:**
Same ~$0.001/request but with 100% tool accuracy vs 67%.
