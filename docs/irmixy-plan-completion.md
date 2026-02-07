# Irmixy Completion Plan (Detailed Implementation Spec)

Date: 2026-02-06
Owner: AI Foundation Team
Status: Ready for implementation

## 0. Engineering Conventions (Locked)

1. Follow repository conventions from `AGENTS.md`:
   - app imports use `@/` alias.
   - app user-facing strings go through i18n only.
   - app text rendering uses app `Text` component.
2. All new backend tool inputs are validated server-side before execution.
3. All user-owned reads/writes enforce ownership in query predicates, not only via RLS.
4. Any security-definer DB function sets explicit `search_path`.

## 1. Goal and Scope

### 1.1 Product Goal
Complete the original Irmixy objective in `docs/irmixy-plan.md`:
1. Ability 1: Build custom recipes from ingredients, refine conversationally, and launch cooking.
2. Ability 2: Discover recipes conversationally using semantically relevant search.

### 1.2 Success Definition
1. A user can ask vague discovery queries and get relevant cards through hybrid semantic retrieval.
2. A user can ask ingredient-based requests and get safe custom recipes with iterative refinement.
3. A user can ask for a past custom recipe ("that chicken one from last week") and get correct replay/disambiguation.
4. A user can leave mid-cook and resume at the saved step.

### 1.3 Non-Goals (for this cycle)
1. Shopping list and meal-plan tool expansion.
2. New voice provider architecture changes.
3. Full analytics dashboard UI.

## 2. Comparison to Original Plan

### 2.1 Preserved
1. Same two north-star abilities and journeys.
2. `IrmixyResponse` remains canonical UI contract.
3. Save-on-start policy remains unchanged.
4. Allergen and food-safety enforcement remains mandatory.
5. Replay and resume remain core, not optional.

### 2.2 Corrected
1. Embeddings are explicitly required now for Ability 2 (not postponed).
2. Hybrid retrieval (semantic + lexical + metadata + personalization rerank) is a core deliverable.
3. Retrieval/disambiguation tooling is now first-class implementation scope.
4. Resume flow is specified end-to-end (DB + backend + app write path + UX).

## 3. Current-State Findings (Branch Snapshot)

### 3.1 Working Today
1. Structured response schema exists in server and app.
2. Shared tool execution path exists for text and voice.
3. `search_recipes` and `generate_custom_recipe` are implemented.
4. Save custom recipe on "Start Cooking" is implemented in app.

### 3.2 Gaps
1. Search is largely lexical/tag-based; no embeddings retrieval implemented yet.
2. No `retrieve_custom_recipe` tool for true replay/disambiguation.
3. Resume context is read in backend, but app-side cooking progress persistence is incomplete.
4. Tool-loop follow-up grounding is weak where tool-role context is dropped before second model pass.
5. Voice/text policies can drift due separate prompt definitions.

## 4. Target Architecture (Final State)

### 4.1 Request Flow
1. User message enters `irmixy-chat-orchestrator`.
2. Context builder loads profile, session history, resumable cooking state.
3. Model call decides tool usage.
4. Tool executes via shared registry.
5. Follow-up model pass generates conversational text + chips/actions.
6. Post-processing applies schema validation + safety enforcement.
7. App renders from structured fields only.

### 4.2 Search Core (Ability 2)
1. Query embedding generated for user search text.
2. Hybrid retrieval combines:
   - semantic vector similarity
   - lexical/tag matches
   - metadata constraints
   - personalization rerank.
3. Allergen and dietary filtering remain hard gates.
4. If matches below threshold: fallback prompt to Ability 1.

### 4.3 Memory Core (Replay)
1. Tool extracts retrieval signals from natural language.
2. Candidate recipes pulled from `user_recipes` for user.
3. Results scored on ingredient overlap + timeframe + tags + recency.
4. Output returns `single`, `multiple`, or `not_found`.

### 4.4 Resume Core
1. Cooking step transitions upsert `cooking_sessions`.
2. Resume candidates loaded on app entry and in orchestrator context.
3. UX provides Resume / Start over / Cancel.

## 5. Data Model and Migration Plan

All migrations are additive and reversible with explicit rollback SQL.

### 5.1 Embeddings Support
1. Migration: enable vector extension if not enabled.
2. Migration: create `recipe_embeddings`.

Proposed table:
```sql
create table if not exists public.recipe_embeddings (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  embedding vector(1536) not null,
  embedding_model text not null default 'text-embedding-3-small',
  content_hash text not null,
  updated_at timestamptz not null default now()
);
```

3. Index:
```sql
create index if not exists idx_recipe_embeddings_embedding
on public.recipe_embeddings
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

4. RLS:
1. Read policy aligned to published recipe visibility.
2. Write restricted to service role.

Policy template:
```sql
alter table public.recipe_embeddings enable row level security;

create policy recipe_embeddings_read_published
on public.recipe_embeddings
for select
using (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_id and r.is_published = true
  )
);

create policy recipe_embeddings_service_write
on public.recipe_embeddings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
```

### 5.2 Ingredient Embeddings (for ingredient understanding quality)
1. Migration: create `ingredient_embeddings`.

```sql
create table if not exists public.ingredient_embeddings (
  canonical text primary key,
  embedding vector(1536) not null,
  embedding_model text not null default 'text-embedding-3-small',
  updated_at timestamptz not null default now()
);
```

2. Index with ivfflat cosine ops.
3. RLS: read allowed for authenticated users, write restricted to service role.

Policy template:
```sql
alter table public.ingredient_embeddings enable row level security;

create policy ingredient_embeddings_read_authenticated
on public.ingredient_embeddings
for select
using (auth.uid() is not null);

create policy ingredient_embeddings_service_write
on public.ingredient_embeddings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
```

### 5.3 Cooking Session Reliability
1. If missing, migration to create/normalize `cooking_sessions` columns:
   - `id`, `user_id`, `recipe_id`, `recipe_name`
   - `recipe_type` (`custom` | `database`)
   - `current_step`, `total_steps`
   - `status` (`active` | `completed` | `abandoned`)
   - `started_at`, `last_active_at`, `completed_at`, `abandoned_at`.
2. Add `mark_stale_cooking_sessions()` function.
3. Add RLS policy `auth.uid() = user_id`.
4. Concurrency controls:
   - add partial unique index for one active session per user+recipe.
   - add optimistic update condition using `last_active_at` or `updated_at`.

Constraint templates:
```sql
create unique index if not exists idx_cooking_sessions_one_active
on public.cooking_sessions (user_id, recipe_id)
where status = 'active';
```

```sql
alter table public.cooking_sessions enable row level security;

create policy cooking_sessions_user_policy
on public.cooking_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 5.4 Function Hardening
`mark_stale_cooking_sessions()` must be security-hardened:
```sql
create or replace function public.mark_stale_cooking_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.cooking_sessions
  set
    status = 'abandoned',
    abandoned_at = now()
  where
    user_id = auth.uid()
    and status = 'active'
    and last_active_at < now() - interval '24 hours';

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
```

### 5.5 Backfill Jobs
1. Script to backfill `recipe_embeddings` for all published recipes.
2. Script to backfill `ingredient_embeddings` from canonical ingredients.
3. Idempotent rerun support using `content_hash`.
4. Batch size defaults:
   - recipes: 200 rows per batch
   - ingredients: 500 rows per batch.
5. Retry policy:
   - exponential backoff (`max_retries = 3`) per batch.

## 6. Server Implementation Plan

### 6.0 Security and Authorization Invariants
These are required in all server implementations:
1. Ownership checks in query predicates:
   - e.g. `.eq('user_id', auth.uid())` for user-owned data.
2. Tool calls never accept `user_id` from model output as trusted source.
3. Session ownership validated for all session-scoped operations.
4. Structured logs must avoid raw user message content by default.
5. SQL/RPC calls that mutate data must reject if auth context missing.

### 6.1 New/Updated Shared Modules
1. New `yyx-server/supabase/functions/_shared/rag/hybrid-search.ts`
   - `embedQuery()`
   - `searchRecipesHybrid()`
   - `rerankRecipes()`.
2. New `yyx-server/supabase/functions/_shared/tools/retrieve-custom-recipe.ts`
   - parse retrieval hints
   - score candidates
   - return typed match shape.
3. Update `yyx-server/supabase/functions/_shared/tools/tool-registry.ts`
   - register `retrieve_custom_recipe`.
4. Update `yyx-server/supabase/functions/_shared/tools/shape-tool-response.ts`
   - shape retrieval outcomes for orchestrator and voice.
5. Update `yyx-server/supabase/functions/_shared/tools/tool-validators.ts`
   - add strict validator for retrieval params.
6. Add/extend tests:
   - `yyx-server/supabase/functions/_shared/__tests__/...` for validator bounds and unauthorized access cases.

### 6.2 Search Tool Upgrade
1. Update `yyx-server/supabase/functions/_shared/tools/search-recipes.ts`:
   - replace pure lexical ranking with hybrid ranking source.
   - keep hard filter gates for difficulty/time/diet/allergens.
   - emit trace metadata for diagnostics (non-user-facing).
2. Preserve response shape (`RecipeCard[]`) for app compatibility.

### 6.3 Orchestrator Updates
1. Update `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts`:
   - include `retrieve_custom_recipe` in tool policy.
   - fix second-pass grounding to include tool outputs.
   - add deterministic "no results -> Ability 1" fallback response.
   - output `actions` for resume/start where relevant.
2. Keep two-phase recipe streaming behavior already in place.
3. Keep session ownership and schema validation checks.
4. Explicitly enforce:
   - no tool execution without authenticated user.
   - no replay retrieval beyond requesting user's `user_recipes`.

### 6.4 Voice Path Consistency
1. Update `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts`
   - allow new retrieval tool where needed.
2. Keep shared tool execution via registry.
3. Add contract test that compares voice tool definitions with server registry names/params.

### 6.5 Hybrid Scoring Specification (Decision Locked)
Use this fixed formula in the first production version:
1. `semantic_score`:
   - cosine similarity from `recipe_embeddings.embedding <-> query_embedding`.
   - normalize to `[0, 1]` where higher is better.
2. `lexical_score`:
   - exact/partial match on recipe name, tag names, and ingredient names.
   - normalized to `[0, 1]`.
3. `metadata_score`:
   - binary/graded score for explicit constraints:
   - time fit, difficulty fit, cuisine fit, meal context fit.
4. `personalization_score`:
   - affinity from user cuisine history and typical cooking time.

Final score:
```text
final_score =
  (0.55 * semantic_score) +
  (0.25 * lexical_score) +
  (0.10 * metadata_score) +
  (0.10 * personalization_score)
```

Initial thresholds:
1. candidate include threshold: `final_score >= 0.35`
2. high-confidence threshold: `final_score >= 0.50`
3. fallback trigger:
   - fewer than 2 results above `0.35`, or
   - top result below `0.42`.

Language calibration requirement before 50% rollout:
1. Build EN test set (>=100 representative discovery queries).
2. Build ES test set (>=100 representative discovery queries).
3. Tune thresholds only if one language underperforms by >10% precision@3.

### 6.6 Retrieval Tool Contract (Replay)
Add this server-side union return shape for `retrieve_custom_recipe`:
```ts
type RetrieveCustomRecipeResult =
  | {
      version: '1.0';
      type: 'single';
      recipe: {
        userRecipeId: string;
        name: string;
        createdAt: string;
        source: 'ai_generated' | 'ai_modified' | 'user_created';
      };
      suggestions: Array<{ label: string; message: string }>;
    }
  | {
      version: '1.0';
      type: 'multiple';
      recipes: Array<{
        userRecipeId: string;
        name: string;
        createdAt: string;
        confidence: number;
      }>;
      suggestions: Array<{ label: string; message: string }>;
    }
  | {
      version: '1.0';
      type: 'not_found';
      suggestions: Array<{ label: string; message: string }>;
    };
```

Locked behavior:
1. `single` when top score is at least `1.4x` second score or only one candidate.
2. `multiple` when top candidates are close and above minimum confidence.
3. `not_found` when no candidates cross confidence threshold.

### 6.7 Validation and Sanitization Limits (Decision Locked)
1. `search_recipes.query` max length: 200 chars.
2. `retrieve_custom_recipe.query` max length: 200 chars.
3. Timeframe parsing:
   - max lookback window: 365 days.
   - reject invalid date ranges.
4. Candidate limits:
   - retrieval candidate set max: 50.
   - disambiguation options shown: 3.
5. Message safety:
   - strip control characters before prompt injection.
6. Reject/return validation errors with user-safe messages; do not leak internal details.

### 6.8 Caching and Vector Query Tuning
1. Query embedding cache key:
   - `sha256(normalized_query + language + hard_filters_json)`.
2. Cache TTL:
   - 10 minutes for query embeddings.
3. Cache bounds:
   - max 5,000 keys (LRU eviction).
4. Post-backfill maintenance:
   - run `ANALYZE recipe_embeddings` and `ANALYZE ingredient_embeddings`.
5. ANN tuning:
   - start with `lists = 100`, tune with measured recall/latency.

## 7. App Implementation Plan

### 7.1 Chat and Replay UX
1. Update chat handling so replay disambiguation renders suggestion chips and route actions.
2. Ensure recipe replay selection opens correct cooking flow.
3. Continue save-on-start behavior for custom recipes.

### 7.2 Resume UX
1. Add hook `yyx-app/hooks/useCookingProgress.ts`:
   - `upsertProgress()`
   - `completeSession()`
   - `abandonSession()`
   - `getResumableSession()`.
2. Update custom cooking step screen:
   - on step change, persist progress.
   - on finish, mark completed.
3. Add resume prompt entry point in chat/home load path.

### 7.3 Voice UX Parity
1. Keep rendering of recipe cards/custom recipe cards in `VoiceChatScreen`.
2. Support replay disambiguation chips/actions in transcript path where applicable.
3. Ensure tool-result payload shape remains identical to text path.

### 7.4 i18n Deliverables (Required)
1. Add/verify all new user-facing keys in:
   - `yyx-app/i18n/locales/en/chat.ts`
   - `yyx-app/i18n/locales/es/chat.ts`
2. Required key groups:
   - replay: single/multiple/not-found prompts
   - resume: banner text and actions
   - fallback: no-results-to-custom prompt
   - validation and generic error states.
3. No hardcoded user-facing strings in components/services.

### 7.5 File-Level Touchpoints (App)
1. `yyx-app/components/chat/ChatScreen.tsx`
   - render replay disambiguation chips from retrieval tool response.
   - handle replay selection message payloads.
2. `yyx-app/components/chat/VoiceChatScreen.tsx`
   - mirror replay/disambiguation rendering behavior.
3. `yyx-app/hooks/useVoiceChat.ts`
   - preserve and attach retrieval payloads for assistant turn rendering.
4. `yyx-app/app/(tabs)/recipes/custom/[id]/cooking-guide/[step].tsx`
   - persist `current_step` on navigation actions.
5. New `yyx-app/hooks/useCookingProgress.ts`
   - central progress API and read model for resume checks.
6. `yyx-app/services/chatService.ts`
   - parse/store retrieval and action metadata from `tool_calls` where needed.

## 8. Detailed Work Breakdown and Order

### Phase A: Migrations and Backfill
1. Add vector extension + embedding tables + indexes + RLS.
2. Add/normalize `cooking_sessions` + stale function + RLS.
3. Run backfill scripts for recipe and ingredient embeddings.
4. Verify with SQL smoke checks.

Exit criteria:
1. Embedding tables populated for >= 95% published recipes.
2. `cooking_sessions` table and stale function available in cloud.

### Phase B: Retrieval Engine and Tools
1. Implement hybrid search module.
2. Upgrade `search_recipes` tool to hybrid mode.
3. Add `retrieve_custom_recipe` tool and validators.
4. Register tool and shape outputs.

Exit criteria:
1. Query "healthy dinner 30 min" returns semantically relevant cards.
2. Retrieval tool returns deterministic `single/multiple/not_found`.
3. EN/ES evaluation sets meet precision@3 target parity (delta <= 10%).

### Phase C: Orchestrator Logic
1. Fix tool-loop grounding for follow-up response generation.
2. Add explicit replay intent flow with retrieval tool.
3. Add no-results fallback to Ability 1.
4. Add resume actions in response where session exists.

Exit criteria:
1. Search fallback and replay flows pass e2e scripts.
2. No ungrounded second-pass responses in trace logs for tool flows.

### Phase D: App Flows
1. Add cooking progress writes and completion updates.
2. Add resume prompt and route handling.
3. Confirm replay-disambiguation and start-cooking routing.

Exit criteria:
1. Mid-cook abandon/resume works across app restarts.
2. Start cooking preserves save-on-start semantics.

### Phase E: Voice/Text Parity and Hardening
1. Align voice tool policy and payload contracts.
2. Add parity tests for tool names/params/shape.
3. Run targeted performance checks.

Exit criteria:
1. Same tool outputs produce equivalent UI in text and voice.

## 9. Testing Plan (Concrete)

### 9.1 Unit Tests
1. Hybrid scorer weighting logic.
2. Retrieval disambiguation scoring.
3. Orchestrator fallback decision logic.
4. Progress persistence helpers.

### 9.2 Integration Tests (Edge Functions)
1. `search_recipes` with semantic-only intent terms.
2. `retrieve_custom_recipe` with date/ingredient ambiguity.
3. Safety filters over hybrid search results.
4. Resume session load path.

### 9.3 App Tests
1. Chat rendering for replay outcomes.
2. Resume prompt and navigation actions.
3. Save-on-start idempotency.

### 9.4 Regression Gates
1. Existing tool execution tests.
2. Existing schema validation tests.
3. Existing chat/voice streaming tests.

### 9.5 Command-Level Verification Matrix
Run these before merge:
1. Server unit/integration:
   - `cd yyx-server/supabase/functions/irmixy-chat-orchestrator && deno test`
   - `cd yyx-server/supabase/functions && deno test --allow-env --allow-net`
2. App tests:
   - `cd yyx-app && npm test -- --runInBand services/__tests__/chatService.test.ts`
   - `cd yyx-app && npm test -- --runInBand components/chat/__tests__/ChatScreen.test.tsx`
3. Scripted Irmixy checks (if local stack available):
   - `cd yyx-server && ./tests/scripts/irmixy/test-orchestrator.sh`
   - `cd yyx-server && ./tests/scripts/irmixy/test-database.sh`
   - `cd yyx-server && ./tests/scripts/irmixy/test-context.sh <jwt>`
4. Migration validation:
   - `cd yyx-server && npm run db:push`
   - confirm RLS and function existence checks pass.

### 9.6 Security and Adversarial Tests (Required)
1. Unauthorized replay retrieval attempt returns 401/403.
2. Cross-user session access attempt is rejected.
3. Malformed tool args (oversized query, invalid timeframe) return validation errors.
4. Prompt-injection-like inputs do not alter tool authorization behavior.
5. Verify logs do not include raw message content by default.

### 9.7 Load and Performance Tests (Required)
1. Hybrid search load test at expected concurrency.
2. Ensure p95 targets in Section 11 under representative traffic.
3. Validate no N+1 regressions in retrieval flows.
4. Verify memory usage remains stable during embedding backfill batches.

## 10. Acceptance Scenarios (Must Pass)

1. Ability 2 discovery:
   - "Something healthy, fast, and Mexican" -> relevant cards with <=30 min options.
2. Ability 2 fallback:
   - no match query -> "let's create one together" flow.
3. Ability 1 generation:
   - ingredients list -> valid custom recipe with safe constraints.
4. Refinement:
   - "more spicy, no garlic" updates custom recipe.
5. Replay:
   - "that chicken recipe from last week" yields single/multiple/not_found correctly.
6. Resume:
   - stop at step N, reopen, resume at step N.
7. Safety:
   - allergen conflicts blocked and surfaced.
8. Voice parity:
   - voice tool call outcomes render same card structures as text.

## 11. Performance and Reliability Targets

1. Hybrid search p95 under 450ms (excluding model generation).
2. Tool execution total p95 under 700ms for search-only requests.
3. Streaming-first token under 900ms p95 on no-tool responses.
4. Retry-safe backfill jobs with idempotency (`content_hash`).

## 12. Rollout Plan

1. Stage 1 (internal):
   - enable hybrid retrieval behind feature flag.
2. Stage 2 (10% users):
   - compare search success and fallback rate vs baseline.
3. Stage 3 (50%):
   - monitor latency, safety warnings, replay success.
4. Stage 4 (100%):
   - remove lexical-only fallback path unless incident requires rollback.

Stage promotion gates:
1. Stage 1 -> 2:
   - functional acceptance scenarios pass.
2. Stage 2 -> 3:
   - no security regressions, p95 search < target, EN/ES parity holds.
3. Stage 3 -> 4:
   - stable error rate and safety metrics for 72 hours.

Rollback:
1. Disable hybrid flag to revert to lexical search path.
2. Keep embeddings tables intact for re-enable.

## 13. Risks and Mitigations

1. Risk: semantic drift returns irrelevant recipes.
   - Mitigation: hard metadata filters + lexical boosts + thresholded fallback.
2. Risk: increased latency from embedding generation.
   - Mitigation: cache query embeddings for repeated prompts in short window.
3. Risk: replay ambiguity frustrates users.
   - Mitigation: strict disambiguation chips with timestamps.
4. Risk: voice schema drift.
   - Mitigation: parity contract tests against shared registry.

## 14. Assumptions and Defaults

1. Supabase pgvector is available in cloud project.
2. `en` and `es` remain the only supported languages for this cycle.
3. Measurement preference remains explicit user setting, not locale-derived.
4. This cycle prioritizes completion of the two Irmixy abilities over adjacent features.

## 15. Deliverables Checklist

### DB
1. Vector extension migration.
2. `recipe_embeddings` migration + index + RLS.
3. `ingredient_embeddings` migration + index + RLS.
4. `cooking_sessions` migration/normalization + stale function + RLS.
5. Backfill scripts for recipe and ingredient embeddings.

### Server
1. Hybrid retrieval module.
2. Upgraded `search_recipes`.
3. New `retrieve_custom_recipe` tool + validator + registry wiring.
4. Orchestrator fallback and replay flow updates.
5. Voice parity contract tests.
6. Security and adversarial test cases.

### App
1. Cooking progress persistence hook.
2. Resume prompt and resume routing.
3. Replay disambiguation UX handling.
4. Regression coverage updates for chat/voice flows.
5. i18n key additions for all new prompts/actions.

## 16. Implementation Sequence (No Open Decisions)

Execute in this exact order:
1. Create DB migrations (vector tables, indexes, RLS, cooking session normalization).
2. Deploy migrations to cloud after mandatory backup (`cd yyx-server && npm run backup:all`).
3. Implement and deploy embedding backfill script.
4. Implement `_shared/rag/hybrid-search.ts`.
5. Upgrade `search_recipes` to consume hybrid retrieval.
6. Implement `retrieve_custom_recipe` tool + validators + registry wiring.
7. Patch orchestrator tool-loop grounding and fallback logic.
8. Add replay rendering paths in chat/voice screens.
9. Add `useCookingProgress` + cooking-step write path + resume prompt flow.
10. Add parity tests and command-level verification runs.
11. Stage rollout with feature flag and monitor thresholds before full release.

Done definition:
1. All acceptance scenarios in Section 10 pass.
2. Command matrix in Section 9.5 passes without unresolved failures.
3. Hybrid retrieval feature flag is enabled to 100% with stable metrics for 72 hours.
4. Security/adversarial suite in Section 9.6 passes.
5. i18n review confirms EN/ES coverage for all new strings.
