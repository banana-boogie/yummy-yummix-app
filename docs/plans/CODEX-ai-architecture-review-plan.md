# CODEX Plan: End-to-End AI Architecture Review Deliverable

## Summary
Produce a decision-complete architecture walkthrough of the AI system (client + server) using the exact 10-section format you specified, with concrete `path:line` citations, explicit assumptions, open questions, and extension guidance for future capabilities (shopping cart, meal planning).
Scope excludes test review and code mutation.

## Goal and Success Criteria
1. Goal: Give you a reliable mental model of how AI features work end-to-end in this repo.
2. Success criteria:
- Every architectural claim has at least one `path:line` citation.
- Text chat, voice chat, and tool execution flows are described step-by-step across app and server boundaries.
- Security, safety, performance, and extensibility are explained with concrete module responsibilities.
- Known risks and refactor opportunities are prioritized and actionable.
- Output ends with a practical mental model + 10-question self-check quiz.

## Constraints and Scope
1. In scope:
- AI-related app code (`yyx-app`) and edge functions/shared modules (`yyx-server/supabase/functions`).
- Data model surfaces used by AI (sessions/messages/custom recipes/normalization/safety/allergens).
- Architecture and design tradeoffs.
2. Out of scope:
- Test file review (per your instruction).
- Any file edits, migrations, deployment changes, or implementation.

## Work Plan (Non-Mutating)
1. Build AI component inventory
- Confirm entrypoints and boundaries:
  - App chat/voice services and screens.
  - Server orchestrator/chat/voice execution functions.
  - Shared gateway, tools, context/auth/safety modules.
- Output artifact: component map with ownership and dependency direction.

2. Trace request lifecycles end-to-end
- Text flow: UI trigger -> SSE stream -> orchestrator -> gateway/tool loop -> persisted outputs -> UI reconciliation.
- Voice flow: realtime provider lifecycle -> tool call bridge -> `irmixy-voice-orchestrator` -> tool response back to realtime session.
- Tool flow: registry declaration -> validator -> execute -> shaping -> stream/finalization.
- Output artifact: 3 explicit sequence flows with failure branches.

3. Extract architecture responsibilities by module
- Orchestrator, gateway/router/provider adapter, registry/executor/shaper, context builder/session/history, validation/safety/auth.
- Output artifact: role table (module, responsibility, inputs, outputs, coupling risks).

4. Build data model map for AI features
- Chat sessions/messages structures and storage touchpoints.
- Custom recipe generation objects and persistence boundaries.
- Ingredient normalization/allergen/food safety lookup paths and decision points.
- Output artifact: entity relationship narrative with where each entity is read/written.

5. Evaluate security/safety/performance architecture
- Security: auth gates, request validation boundaries, tool-input sanitization, model/tool output trust boundaries.
- Safety: allergen + food safety layers and where enforcement is strict vs advisory.
- Performance: streaming behavior, parallel context fetches, potential latency hotspots (tool execution, normalization loops, DB/API fan-out), caching opportunities.
- Output artifact: risks list with severity and specific file anchors.

6. Derive extension blueprint for new capabilities
- Define the exact “add a new tool/capability” sequence:
  - schema/types
  - tool module
  - registry wiring
  - orchestrator/tool-choice behavior
  - client event handling/UI integration
  - safety/auth checks
- Include two worked examples: `add_to_shopping_cart` and `create_meal_plan`.
- Output artifact: ordered implementation checklist with file touch order.

7. Produce final teaching deliverable in your requested format
- Section 1: Executive architecture summary
- Section 2: Component map
- Section 3: Sequence flows (text/voice/tools)
- Section 4: File-by-file AI map
- Section 5: Data model map
- Section 6: Security/safety model
- Section 7: Performance model
- Section 8: How to add new AI features
- Section 9: Risks + recommended refactors
- Section 10: 10-question self-check quiz
- Include explicit assumptions + open questions at the end.

## Important API/Interface/Type Changes
1. None planned.
2. This is an analysis-and-documentation output only; no code/interface mutations.

## Validation Scenarios (Quality Checks for the Deliverable)
1. Citation check:
- Randomly sample claims from each section and verify `path:line` points to supporting code.
2. Flow completeness check:
- Ensure each of text/voice/tool flows includes: trigger, auth, orchestration, model/tool interaction, persistence/return path, UI update.
3. Extensibility check:
- Confirm “new tool” blueprint is decision-complete (no hidden choices left to implementer).
4. Risk usefulness check:
- Each risk must include impact, why now, and a concrete refactor or guardrail.

## Assumptions and Defaults
1. Assume current branch state is authoritative for architecture (including recent PR work).
2. Ignore unrelated unexpected repo change (`docs/DEPLOYMENT_CHECKLIST.md` deletion) for this analysis pass, per your instruction.
3. Prefer clarity and architecture coherence over exhaustive listing of every helper file.
4. Treat current feature as in-development: recommendations emphasize practical developer sequence over rollout/migration sophistication unless directly required by current code paths.
