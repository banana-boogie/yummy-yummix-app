# Irmixy Plan Review Findings

## Findings (Ordered by Severity)

### Critical
- **Structured UI vs text parsing conflict:** Part 1 mandates structured UI via `IrmixyResponse`, but Part 2 “Quick Actions in Responses” still parses free‑form text. Actions must come only from `IrmixyResponse.actions` to avoid brittleness and injection risk.
- **Tool loop contradiction:** The plan says “Max 1 round” yet shows two LLM calls and also calls for “single request” routing. Make it explicit: LLM → tools (max 2 parallel) → LLM final, max 1 tool round; no further tool calls.

### High
- **Schema mismatch in fallback:** `validateResponse` returns `safetyFlags: { error: true }` but `error` is not defined in the schema. Add it to `safetyFlags` or change the fallback shape.
- **Intent detection inconsistency:** Part 1 says intent is analytics-only post-response, while Part 5 recommends pre-response classification. This reintroduces latency and routing conflicts; keep it analytics-only or explicitly wire it into routing.
- **Parity risk (text vs voice):** Streaming in text and non-streamed voice can diverge unless parity is defined on the canonical response before TTS/SSML normalization.

### Medium
- **Latency targets conflict:** Text first-token target is inconsistent (500ms vs 500–700ms). Pick one baseline and treat as “targets” until you’ve measured real latency.
- **RAG confidence scoring undefined:** Thresholds exist but no scoring method or calibration is defined; this can over/under‑filter results. Define normalization and tune using eval data.
- **Privacy gating ambiguity:** Cross‑session features in Part 2 should be explicitly gated by `crossSessionMemory` to avoid surprise personalization.

### Low
- **Age-appropriate alcohol filtering:** “No alcohol if user has children” can be over‑restrictive. Prefer a specific “no alcohol” preference or opt‑in setting.
- **Cost tier downgrades:** Silent auto‑downgrades can feel like quality regressions. Consider a user-visible indicator or usage limits with explanation.

## Suggestions
- Replace all UI parsing language with “render from `IrmixyResponse` only.”
- Make the tool loop explicit and consistent across the plan.
- Add schema version union and align fallback fields with validation.
- Define RAG score normalization and calibrate thresholds via eval harness.
- Gate cross‑session and memory indicators behind privacy toggles.
- Align latency targets into a single set; treat as targets until baseline metrics exist.

## Open Questions
- Should tool results be injected as tool‑role messages or assistant context?
- If RAG confidence is low, do you prefer a clarifying question or a “not exact” disclaimer with top 3 results?
- How should cost‑tier downgrades be communicated to avoid surprise regressions?
