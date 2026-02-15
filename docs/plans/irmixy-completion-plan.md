# Irmixy Completion Plan (Detailed Implementation Spec)

> Updated by Claude after codebase review. Changes from original marked with CLAUDE.

Date: 2026-02-06
Owner: AI Foundation Team
Status: Ready for implementation

## 0. Engineering Conventions (Locked)

1. Follow repository conventions from `CLAUDE.md`:
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
1. Shopping list and meal-plan tool expansion (see Appendix D for extension blueprint only).
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
1. Embeddings are explicitly required for Ability 2, including ingredient-aware recipe embeddings for "what can I make with X" queries.
2. Hybrid retrieval (semantic + lexical + metadata + personalization rerank) is a core deliverable.
3. Retrieval/disambiguation tooling is now first-class implementation scope.
4. Resume flow is specified end-to-end (DB + backend + app write path + UX).

## 3. Current-State Findings (Branch Snapshot)

### 3.1 Working Today
1. Structured response schema exists in server and app.
2. Shared tool execution path exists for text and voice (`execute-tool.ts`, `shape-tool-response.ts`).
3. `search_recipes` and `generate_custom_recipe` are implemented and registered in `tool-registry.ts`.
4. Save custom recipe on "Start Cooking" is implemented in app (`CustomRecipeCard` -> `customRecipeService.save()`).
5. **CLAUDE: Existing infrastructure already built (must be preserved and reused, not reimplemented):**
   - `ingredient_aliases` table with ~100+ EN/ES mappings (`yyx-server/supabase/migrations/20260206030102_create_ingredient_aliases.sql`)
   - `food_safety_rules` table with USDA temps/times (`20260206030128_create_food_safety_rules.sql`)
   - `food_allergies`, `diet_types`, `cuisine_preferences` lookup tables (`20260204062424_normalize_food_preferences.sql`)
   - `batch_find_ingredients()` and `find_closest_ingredient()` RPC functions with `pg_trgm` fuzzy matching
   - `allergen-filter.ts` with word-boundary matching (prevents "egg" matching "eggplant")
   - `cooking_sessions` table with `mark_stale_cooking_sessions()` RPC (marks >24h sessions as abandoned)
   - Regex-based modification detection in orchestrator (enables "make it spicier" without extra AI call)
   - Two-phase SSE streaming with `onPartialRecipe` callback for recipe card display during enrichment
   - Context builder loads user profile, conversation history (last 10 messages), and resumable cooking state

### 3.2 Gaps
1. Search is purely lexical/tag-based (`search-recipes.ts` uses `.ilike()` and keyword scoring); no embeddings retrieval.
2. No `retrieve_custom_recipe` tool for true replay/disambiguation.
3. Resume context is read in backend (orchestrator mentions it in system prompt), but app-side cooking progress persistence is not implemented — step navigation is stateless URL-based routing.
4. Tool-loop follow-up grounding is weak where tool-role context is dropped before second model pass.
5. Voice/text policies can drift due to separate prompt definitions.

## 4. Target Architecture (Final State)

### 4.1 Request Flow
1. User message enters `irmixy-chat-orchestrator`.
2. Context builder loads profile, session history, resumable cooking state.
3. Model call decides tool usage.
4. Tool executes via shared registry.
5. Follow-up model pass generates conversational text + chips/actions (with tool results included in context).
6. Post-processing applies schema validation + safety enforcement.
7. App renders from structured fields only.

### 4.2 Search Core (Ability 2)
1. Query embedding generated using OpenAI `text-embedding-3-large` (3072 dimensions).
2. Recipe embeddings include ingredient names (Section 5.2), enabling "what can I make with X" queries.
3. Hybrid retrieval combines:
   - semantic vector similarity (ingredient-aware)
   - lexical/tag matches (existing scoring logic)
   - metadata constraints (time, difficulty, cuisine, diet)
   - personalization rerank.
4. Allergen and dietary filtering remain hard gates (existing `allergen-filter.ts`).
5. If matches below threshold: deterministic fallback to Ability 1 (see Section 6.9).
6. **CLAUDE: If embedding API fails: graceful fallback to existing lexical-only path** (see Section 6.10).

### 4.3 Memory Core (Replay)
1. Tool extracts retrieval signals from natural language.
2. Candidate recipes pulled from `user_recipes` for authenticated user only.
3. Results scored on ingredient overlap + timeframe + tags + recency.
4. Output returns `single`, `multiple`, or `not_found`.

### 4.4 Resume Core
1. Cooking step transitions upsert `cooking_sessions`.
2. Resume candidates loaded on app entry and in orchestrator context.
3. UX provides Resume / Start over / Cancel.
4. **CLAUDE: New `resume_cooking` action type** in `QuickAction` (see Section 6.11).

## 5. Data Model and Migration Plan

All migrations are additive and reversible with explicit rollback SQL.

### 5.1 Embeddings Support
1. Migration: enable vector extension if not enabled.
2. Migration: create `recipe_embeddings`.

Proposed table:
```sql
create table if not exists public.recipe_embeddings (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  embedding vector(3072) not null,
  embedding_model text not null default 'text-embedding-3-large',
  content_hash text not null,
  updated_at timestamptz not null default now()
);
```

**CLAUDE: Embedding model choice — OpenAI `text-embedding-3-large`.**
Best quality available without adding a new provider (already using OpenAI for chat + voice). Strong multilingual EN/ES support for bilingual recipe content.
```typescript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openaiApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'text-embedding-3-large',
    input: text,
  }),
});
const { data } = await response.json();
const embedding = data[0].embedding; // 3072-dimensional vector
```
This produces 3072-dimensional vectors. Key properties:
- Excellent bilingual EN/ES matching — Spanish queries match English recipe content and vice versa
- Highest quality OpenAI embedding model (MTEB 64.6)
- Cost is negligible at <1,000 recipes (~$0.01/month including queries)
- Uses existing `OPENAI_API_KEY` (no new provider dependency)
- Adds ~50-200ms latency per query (mitigated by query embedding cache — see Section 6.8)
- If API fails, lexical fallback ensures search still works (see Section 6.10)

3. **CLAUDE: Use HNSW index instead of IVFFlat.** pgvector offers two index types for fast vector search:
   - **IVFFlat** divides vectors into clusters. Requires manual tuning of `lists` parameter and running `ANALYZE` after data changes. With <1,000 recipes, most clusters end up empty — poor performance.
   - **HNSW** builds a navigable graph. Self-tuning, better accuracy, works well at any dataset size. Slightly more memory but zero manual tuning.

   With <1,000 published recipes, HNSW is the clear choice.
```sql
create index if not exists idx_recipe_embeddings_embedding
on public.recipe_embeddings
using hnsw (embedding vector_cosine_ops);
```

<!--4. RLS-->
   1. Read and write restricted to service role only. The app never queries `recipe_embeddings` directly — all vector searches go through Edge Functions using the service-role client.
   2. No user-facing read policy needed since embeddings are an internal backend concern.

Policy template:
```sql
alter table public.recipe_embeddings enable row level security;

-- Service role only — both reads (vector search in Edge Functions)
-- and writes (backfill). No user-facing access needed.
create policy recipe_embeddings_service_only
on public.recipe_embeddings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
```

### 5.2 Ingredient-Aware Recipe Embeddings

**Core use case:** Users ask "what can I make with chicken, rice, and peppers?" and get relevant recipe matches.

**Approach:** Include ingredient names in the text content that gets embedded for each recipe. This means the recipe embedding vector captures ingredient semantics naturally — a query mentioning "chicken" will match recipes containing chicken because both share similar vector representations.

**Embedding content formula for each recipe (bilingual):**
```text
# {name_en} / {name_es}

{description_en or first 200 chars of instructions_en}

Ingredients: {ingredient_en1} / {ingredient_es1}, {ingredient_en2} / {ingredient_es2}, ...

Tags: {comma-separated tag names in EN}
```

Each recipe gets **one bilingual embedding** that captures both languages. This means a query in either language ("chicken soup" or "sopa de pollo") will match the same recipe vector.

**Query embedding:** Generated in the user's current language only. Because the recipe vector contains both EN and ES tokens, a single-language query still achieves cross-language matching.

**Why not a separate `ingredient_embeddings` table?**
A per-ingredient vector table would help "chicken ≈ poultry" semantic matching, but the existing `ingredient_aliases` table already handles ingredient normalization (100+ EN/ES mappings + `pg_trgm` fuzzy matching). Including ingredients in recipe embedding content achieves ingredient-based discovery without an extra table, extra backfill, or extra vector queries.

**Combined with hybrid scoring:** The hybrid search (Section 6.5) also includes ingredient set overlap scoring — when a user provides specific ingredients, the system computes exact overlap using `batch_find_ingredients()` for canonical name resolution. This provides precise matching alongside the semantic boost from embeddings.

### 5.3 Cooking Session Normalization

**CLAUDE: The `cooking_sessions` table already exists** with `mark_stale_cooking_sessions()` RPC. This step is a **normalization migration**, not table creation.

1. Run this preflight SQL and store the output in migration notes:
```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'cooking_sessions'
order by column_name;

select policyname
from pg_policies
where schemaname = 'public' and tablename = 'cooking_sessions'
order by policyname;
```
2. Apply this normalization migration exactly (safe to rerun):
```sql
alter table public.cooking_sessions
  add column if not exists recipe_type text check (recipe_type in ('custom', 'database')),
  add column if not exists completed_at timestamptz,
  add column if not exists abandoned_at timestamptz;

alter table public.cooking_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cooking_sessions'
      and policyname = 'cooking_sessions_user_policy'
  ) then
    create policy cooking_sessions_user_policy
    on public.cooking_sessions
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end;
$$;
```
3. Add concurrency control index:
   - partial unique index for one active session per user+recipe.
4. Keep `mark_stale_cooking_sessions()` hardened with `security definer` + `set search_path = public`.

Constraint template:
```sql
create unique index if not exists idx_cooking_sessions_one_active
on public.cooking_sessions (user_id, recipe_id)
where status = 'active';
```

### 5.4 Function Hardening

`mark_stale_cooking_sessions()` already exists with correct security hardening. Verify during migration:
```sql
-- Keep this function definition authoritative and rerunnable
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
2. Embedding content includes ingredient names per Section 5.2 formula.
3. Idempotent rerun support using `content_hash`.
4. **CLAUDE: Content hash definition:**
   - For recipes: `SHA-256(name_en + '|' + name_es + '|' + description_en_first_200 + '|' + sorted_ingredient_canonical_names + '|' + sorted_tag_names)`
   - Must include all fields present in the embedding content formula (Section 5.2) so that any content change triggers re-embedding.
   - Allows skipping unchanged recipes on rerun while catching content updates.
5. Batch size defaults:
   - recipes: 200 rows per batch.
6. Retry policy:
   - exponential backoff (`max_retries = 3`) per batch.
7. **CLAUDE: Execution environment:**
   - Implement as a dedicated Edge Function (`backfill-embeddings`) callable only from trusted operator contexts.
   - Accepts params: `{ batchSize, dryRun, forceRegenerate }`.
   - Uses `OPENAI_API_KEY` for embedding generation via `text-embedding-3-large`.
   - Logs progress per batch (batch number, rows processed, errors) without PII.
   - Enforce admin-only authorization (`auth.jwt() -> app_metadata.role = 'admin'`) and reject all non-admin callers.
   - Never call from the mobile app; trigger from secure terminal/CI job only.

### 5.6 Embedding Freshness (Post-Backfill Sync)

The backfill in Section 5.5 handles initial population. After that, embeddings must stay in sync when recipe content changes:

1. **On recipe publish/update:** When a recipe's name, description, ingredients, or tags change, the `content_hash` in `recipe_embeddings` will no longer match. The backfill Edge Function (Section 5.5) already handles this — rerun it periodically or after content changes to pick up stale hashes.
2. **Recommended sync approach:** Rerun the backfill function after recipe content changes (manual trigger or CI job). The `content_hash` check makes this cheap — unchanged recipes are skipped, only modified recipes get re-embedded.
3. **Why not a database trigger?** Triggers that call external APIs (OpenAI) from within a transaction are fragile and add latency to recipe saves. The async backfill approach is simpler and more reliable.
4. **Acceptable staleness window:** Minutes to hours. Recipe content changes are infrequent (admin-only). A recipe updated at 2pm will surface correctly in search after the next backfill run. This is acceptable for a cooking app.

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
   - `embedQuery()` — calls OpenAI `text-embedding-3-large` API.
   - `searchRecipesHybrid()`
   - `rerankRecipes()`.
2. New `yyx-server/supabase/functions/_shared/tools/retrieve-custom-recipe.ts`
   - parse retrieval hints
   - score candidates using existing `ingredient_aliases` for canonical name resolution
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
   - replace lexical-only path with hybrid ranking via `searchRecipesHybrid()`.
   - **CLAUDE: Keep existing lexical scoring as internal fallback** (used if embedding API call fails — timeout, rate limit, or error).
   - keep hard filter gates for difficulty/time/diet/allergens (existing `allergen-filter.ts`).
   - emit trace metadata for diagnostics (non-user-facing).
2. Preserve response shape (`RecipeCard[]`) for app compatibility.
3. Hybrid search is always on — no feature flag. Lexical-only is an automatic degradation path, not a configuration choice.

### 6.3 Orchestrator Updates
1. Update `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts`:
   - include `retrieve_custom_recipe` in tool policy.
   - fix second-pass grounding to include tool outputs in messages array.
   - add deterministic "no results -> Ability 1" fallback response (see Section 6.9).
   - output `actions` for resume/start where relevant (see Section 6.11).
2. Keep two-phase recipe streaming behavior already in place.
3. Keep session ownership and schema validation checks.
4. **CLAUDE: Preserve existing modification detection** (regex-based, ~<5ms). This powers Ability 1's iterative refinement ("make it spicier", "no garlic") and must not be broken by orchestrator changes.
5. Explicitly enforce:
   - no tool execution without authenticated user.
   - no replay retrieval beyond requesting user's `user_recipes`.

### 6.4 Voice Path Consistency
1. Update `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts`
   - allow the new retrieval tool in the voice tool allowlist and execution path.
2. Keep shared tool execution via registry.
3. Add contract test that compares voice tool definitions with server registry names/params.
4. **CLAUDE: Voice disambiguation handling:**
   - When `retrieve_custom_recipe` returns `multiple`, voice reads a spoken summary: "I found 2 chicken recipes. One from January 14th, and one from January 12th. Which one?"
   - The data channel message includes the same `suggestions` array as text, so the voice transcript UI can render tappable chips alongside the spoken text.
   - When `retrieve_custom_recipe` returns `single`, voice confirms: "Found it! Your Spicy Chicken Stir-Fry from January 14th. Want to make it again?"

### 6.5 Hybrid Scoring Specification (Decision Locked)
Use this fixed formula in the first production version:
1. `semantic_score`:
   - cosine similarity from `recipe_embeddings.embedding <=> query_embedding` (text-embedding-3-large, 3072 dimensions).
   - generated via OpenAI embedding API.
   - normalize to `[0, 1]` where higher is better.
   - **CLAUDE: Because recipe embeddings include ingredient names (Section 5.2), queries like "what can I make with chicken and rice" naturally match recipes containing those ingredients via vector similarity.**
2. `lexical_score`:
   - exact/partial match on recipe name, tag names, and ingredient names.
   - normalized to `[0, 1]`.
   - **CLAUDE: Reuse existing `scoreByQuery()` logic from `search-recipes.ts`**, normalized to [0,1] range.
3. `metadata_score`:
   - binary/graded score for explicit constraints:
   - time fit, difficulty fit, cuisine fit, meal context fit.
4. `personalization_score`:
   - affinity from user cuisine history and typical cooking time.

Final score:
```text
final_score =
  (0.50 * semantic_score) +
  (0.25 * lexical_score) +
  (0.10 * metadata_score) +
  (0.15 * personalization_score)
```

**CLAUDE: Weights adjusted** from original (0.55/0.25/0.10/0.10) to give slightly more weight to personalization. `text-embedding-3-large` (3072d) provides highly discriminative similarity scores, so semantic weight at 0.50 is sufficient. Tune after initial evaluation.

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

**CLAUDE: Simple-first implementation.** Custom recipe retrieval uses indexed SQL filters and text search on `user_recipes` (name ILIKE, ingredient overlap, date range) — NOT vector embeddings. Vector reranking is optional and should only be added if a measurable relevance gap is proven with the SQL-based approach. This keeps the retrieval tool fast, simple, and independent of the embedding API.

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
6. Reject unknown fields in tool arguments (strict schema validation — no extra properties allowed).
7. Sanitize and normalize IDs (UUID format validation before any DB query).
8. Enforce auth context per action/tool — reject if authenticated user is missing.
9. Reject/return validation errors with user-safe messages; do not leak internal details.

### 6.8 Caching and Vector Query Tuning
1. **CLAUDE: Query embedding cache recommended.** Since `text-embedding-3-large` requires an external API call (~50-200ms), caching repeated or similar queries saves latency and cost.
   - Cache key: `sha256(normalized_query_text)`.
   - Cache TTL: 10 minutes.
   - Cache bounds: max 1,000 entries (LRU eviction).
   - Implementation: in-memory `Map` within the Edge Function instance.
   - **Important: this is a per-instance, best-effort cache.** Edge Function instances are ephemeral and isolated — each instance maintains its own cache, and cache is lost on instance restart. This means cache hit rate depends on traffic volume and instance reuse. At low traffic, most queries will be cache misses. This is acceptable — the cache is an optimization, not a requirement.
2. Post-backfill maintenance:
   - run `ANALYZE recipe_embeddings`.
3. **CLAUDE: No ANN tuning needed** — HNSW index is self-tuning (no `lists` parameter). Monitor recall/latency post-deploy and adjust `ef_search` only if needed.

### 6.9 CLAUDE: Deterministic Fallback Response (No Results -> Ability 1)

When search returns fewer than 2 results above threshold or top result below 0.42, the orchestrator returns a **deterministic template** (no AI call for the fallback message):

```typescript
// Template response — no LLM call, no runtime i18n dependency on server
const FALLBACK_COPY = {
  en: {
    message: "I couldn't find recipes matching that, but I can create something custom!",
    createLabel: "Create from ingredients",
    createMessage: "Create a recipe from the ingredients I have",
    surpriseLabel: "Surprise me",
    surpriseMessage: "Suggest a quick custom recipe for me",
  },
  es: {
    message: "No encontré recetas para eso, pero puedo crear algo personalizado.",
    createLabel: "Crear con ingredientes",
    createMessage: "Crea una receta con los ingredientes que tengo",
    surpriseLabel: "Sorpréndeme",
    surpriseMessage: "Sugiere una receta personalizada rápida",
  },
} as const;

const copy = FALLBACK_COPY[language] ?? FALLBACK_COPY.en;

const fallbackResponse: IrmixyResponse = {
  version: '1.0',
  message: copy.message,
  language,
  suggestions: [
    {
      label: copy.createLabel,
      message: copy.createMessage,
    },
    {
      label: copy.surpriseLabel,
      message: copy.surpriseMessage,
    },
  ],
};
```

Example EN rendering:
- message: "I couldn't find recipes matching that, but I can create something custom!"
- chips: ["Create from ingredients", "Surprise me"]

This matches the foundation pattern of template suggestions (no AI latency).

### 6.10 CLAUDE: Lexical Fallback on Embedding Failure

If the OpenAI embedding API call fails (timeout, rate limit, or error), hybrid search must degrade gracefully to lexical-only:

```typescript
async function searchRecipesHybrid(query, filters, userContext) {
  let embedding: number[] | null = null;
  try {
    embedding = await embedQuery(query); // calls OpenAI text-embedding-3-large
  } catch (err) {
    // Log warning, continue with lexical-only
    console.warn('[hybrid-search] Embedding failed, falling back to lexical:', err.message);
  }

  if (embedding) {
    // Full hybrid path
    return hybridRank(embedding, query, filters, userContext);
  } else {
    // Graceful degradation to existing lexical search
    return lexicalSearchOnly(query, filters, userContext);
  }
}
```

This ensures search never breaks due to external API issues.

### 6.11 CLAUDE: Resume Action Type

Add `resume_cooking` to the `QuickAction` type union:

```typescript
interface QuickAction {
  type: 'start_cooking' | 'view_recipe' | 'save_recipe' | 'set_timer' | 'resume_cooking';
  label: string;
  payload: Record<string, unknown>;
}

// Resume action payload (server returns localized text, same pattern as FALLBACK_COPY in Section 6.9):
{
  type: 'resume_cooking',
  label: 'Resume cooking',  // localized by server: EN "Resume cooking" / ES "Reanudar cocina"
  payload: {
    sessionId: string,
    recipeId: string,
    recipeType: 'custom' | 'database',
    currentStep: number,
    totalSteps: number,
    recipeName: string,
  }
}
```

The orchestrator includes this action when context builder detects a resumable session. The app routes to the correct cooking guide step on action press.
Update both schema layers in the same PR:
1. `yyx-server/supabase/functions/_shared/irmixy-schemas.ts` (`QuickActionSchema` enum).
2. `yyx-app/types/irmixy.ts` (`QuickAction.type` union).

### 6.12 (Removed — No Feature Flag)

Hybrid search is always on. No feature flag needed. Lexical search exists only as an automatic degradation path if the OpenAI embedding API fails (Section 6.10).

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
2. Update custom cooking step screen (`yyx-app/app/(tabs)/recipes/custom/[id]/cooking-guide/[step].tsx`):
   - on step change, persist progress via `upsertProgress()`.
   - on finish, mark completed via `completeSession()`.
3. Add resume prompt entry point in chat/home load path.
4. **CLAUDE: Handle `resume_cooking` action type** in chat action handler with explicit route mapping by `recipeType`:
   - For `recipeType = 'custom'`: `/(tabs)/recipes/custom/[recipeId]/cooking-guide/[currentStep]`
   - For `recipeType = 'database'`: `/(tabs)/recipes/[recipeId]/cooking-guide/[currentStep]`

### 7.3 Voice UX Parity
1. Keep rendering of recipe cards/custom recipe cards in `VoiceChatScreen`.
2. Support replay disambiguation chips/actions in transcript path where applicable.
3. Ensure tool-result payload shape remains identical to text path.
4. **CLAUDE: Voice disambiguation** renders chips in transcript UI alongside spoken summary (see Section 6.4).

### 7.4 i18n Deliverables (Required)
1. Add/verify all new user-facing keys in:
   - `yyx-app/i18n/locales/en/chat.ts`
   - `yyx-app/i18n/locales/es/chat.ts`
2. Required key groups:
   - replay: single/multiple/not-found prompts
   - resume: banner text and actions
   - validation and generic error states.
3. No hardcoded user-facing strings in components/services.

### 7.5 File-Level Touchpoints (App)
1. `yyx-app/components/chat/ChatScreen.tsx`
   - render replay disambiguation chips from retrieval tool response.
   - handle replay selection message payloads.
   - **CLAUDE: handle `resume_cooking` action press → route to cooking guide step.**
2. `yyx-app/components/chat/VoiceChatScreen.tsx`
   - mirror replay/disambiguation rendering behavior.
3. `yyx-app/hooks/useVoiceChat.ts`
   - preserve and attach retrieval payloads for assistant turn rendering.
4. `yyx-app/app/(tabs)/recipes/custom/[id]/cooking-guide/[step].tsx`
   - persist `current_step` on navigation actions via `useCookingProgress`.
5. New `yyx-app/hooks/useCookingProgress.ts`
   - central progress API and read model for resume checks.
6. `yyx-app/services/chatService.ts`
   - parse/store retrieval result metadata and `actions` from final structured response and tool outputs.

## 8. Detailed Work Breakdown and Order

### Phase A: Migrations and Backfill
1. **Embedding preflight check:** Verify OpenAI `text-embedding-3-large` works from Edge Function environment. Call the API with a deterministic test string ("test embedding"), confirm a 3072-dimensional vector is returned. If this fails, stop and resolve before proceeding.
2. Run `cooking_sessions` preflight SQL (Section 5.3) and archive output with migration notes.
3. Add vector extension + `recipe_embeddings` table + HNSW index + RLS.
4. Normalize `cooking_sessions` (add missing columns + concurrency index).
5. Verify `mark_stale_cooking_sessions()` hardening.
6. Deploy backfill Edge Function, run for all published recipes.
7. Verify with SQL smoke checks.

Exit criteria:
1. Embedding preflight returns valid 3072-dimensional vector from cloud Edge Function.
2. `recipe_embeddings` populated for >= 95% published recipes.
3. `cooking_sessions` columns and constraints verified in cloud.
4. `ANALYZE recipe_embeddings` run post-backfill.

### Phase B: Retrieval Engine and Tools
1. Implement hybrid search module (`_shared/rag/hybrid-search.ts`).
2. Upgrade `search_recipes` tool to hybrid mode (always on, lexical degradation fallback only).
3. Add `retrieve_custom_recipe` tool and validators.
4. Register tool and shape outputs.

Exit criteria:
1. Query "healthy dinner 30 min" returns semantically relevant cards.
2. Lexical fallback works when embedding API is unavailable.
3. Retrieval tool returns deterministic `single/multiple/not_found`.

### Phase C: Orchestrator Logic
1. Fix tool-loop grounding for follow-up response generation.
2. Add explicit replay intent flow with retrieval tool.
3. Add no-results fallback to Ability 1 (deterministic template).
4. Add resume actions in response where session exists.
5. Verify modification detection still works (regression test).

Exit criteria:
1. Search fallback and replay flows pass e2e scripts.
2. No ungrounded second-pass responses in trace logs for tool flows.
3. "Make it spicier" still triggers direct regeneration (no extra AI call).

### Phase D: App Flows
1. Add cooking progress writes and completion updates (`useCookingProgress`).
2. Add resume prompt and route handling.
3. Confirm replay-disambiguation and start-cooking routing.
4. Handle `resume_cooking` action type.

Exit criteria:
1. Mid-cook abandon/resume works across app restarts.
2. Start cooking preserves save-on-start semantics.

### Phase E: Voice/Text Parity and Hardening
1. Align voice tool policy and payload contracts.
2. Add parity tests for tool names/params/shape.
3. Run targeted performance checks.

Exit criteria:
1. Same tool outputs produce equivalent UI in text and voice.
2. Voice disambiguation renders chips + spoken summary.

## 9. Testing Plan (Concrete)

### 9.1 Unit Tests
1. Hybrid scorer weighting logic.
2. Retrieval disambiguation scoring.
3. Orchestrator fallback decision logic.
4. Progress persistence helpers.
5. **CLAUDE: Lexical fallback when embedding API returns error/null.**
6. **CLAUDE: Content hash computation correctness.**

### 9.2 Integration Tests (Edge Functions)
1. `search_recipes` with semantic-only intent terms.
2. `retrieve_custom_recipe` with date/ingredient ambiguity.
3. Safety filters over hybrid search results.
4. Resume session load path.
5. **CLAUDE: `search_recipes` degradation when embedding API fails.**
6. **CLAUDE: Ingredient-based queries return recipes with matching ingredients.**

### 9.3 App Tests
1. Chat rendering for replay outcomes.
2. Resume prompt and navigation actions.
3. Save-on-start idempotency.
4. **CLAUDE: `resume_cooking` action routing.**

### 9.4 Regression Gates
1. Existing tool execution tests.
2. Existing schema validation tests.
3. Existing chat/voice streaming tests.
4. **CLAUDE: Modification detection still bypasses AI call for refinements.**

### 9.5 Command-Level Verification Matrix
Run these before merge:
1. Server unit/integration:
   - `cd yyx-server && deno task test`
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

## 10. Acceptance Scenarios (Must Pass)

1. Ability 2 discovery:
   - "Something healthy, fast, and Mexican" -> relevant cards with <=30 min options.
2. Ability 2 fallback:
   - no match query -> deterministic "let's create one together" template with chips.
3. Ability 1 generation:
   - ingredients list -> valid custom recipe with safe constraints.
4. Refinement:
   - "more spicy, no garlic" updates custom recipe (via existing modification detection).
5. Replay:
   - "that chicken recipe from last week" yields single/multiple/not_found correctly.
6. Resume:
   - stop at step N, reopen, resume at step N via `resume_cooking` action.
7. Safety:
   - allergen conflicts blocked and surfaced.
8. Voice parity:
   - voice tool call outcomes render same card structures as text.
9. **CLAUDE: Ingredient-based discovery:**
   - "What can I make with chicken, rice, and bell peppers?" -> returns recipes containing those ingredients ranked by relevance.
10. **CLAUDE: Embedding failure degradation:**
    - simulate embedding API failure -> search still returns lexical results.

## 11. Performance and Reliability Targets

1. Hybrid search end-to-end p95 under 450ms (embedding API ~50-200ms + vector query ~10-50ms + scoring ~5ms).
   - On cache hit (embedding lookup ~1ms instead of API call): end-to-end p95 under 200ms.
   - If p95 exceeds 450ms, run `EXPLAIN ANALYZE` on vector query and verify candidate limit (max 50) is enforced.
   - Note: cache is per-instance best-effort (Section 6.8), so cache miss is the baseline expectation at low traffic.
2. Tool execution total p95 under 700ms for search-only requests.
3. Streaming-first token under 900ms p95 on no-tool responses.
4. Retry-safe backfill jobs with idempotency (`content_hash`).

## 12. Rollout Plan

Hybrid search ships as the default path (no feature flag).

1. Stage 1 (internal testing):
   - Deploy migrations + backfill + updated search to staging/cloud.
   - Run acceptance scenarios (Section 10) manually.
   - EN/ES language calibration check (precision@3 delta <= 10%).
2. Stage 2 (production):
   - Deploy to production after internal validation passes.
   - Monitor search latency, safety warnings, fallback rate for 72 hours.
3. Stage 3 (tuning):
   - Adjust hybrid scoring weights if needed based on real usage data.
   - Add more ingredient aliases if common ingredients are missed.

Rollback:
1. If hybrid search degrades quality, revert the `search-recipes.ts` change to use lexical-only path (single file revert + redeploy).
2. Keep `recipe_embeddings` table intact for re-enable.

## 13. Risks and Mitigations

1. Risk: semantic drift returns irrelevant recipes.
   - Mitigation: hard metadata filters + lexical boosts + thresholded fallback.
2. Risk: increased latency from embedding generation.
   - Mitigation: query embedding cache (Section 6.8) avoids repeated API calls. Embedding step: cached ~1ms, uncached ~50-200ms. See Section 11 for end-to-end targets.
3. Risk: replay ambiguity frustrates users.
   - Mitigation: strict disambiguation chips with timestamps.
4. Risk: voice schema drift.
   - Mitigation: parity contract tests against shared registry.
5. **CLAUDE: Risk: OpenAI embedding API downtime or rate limiting.**
   - Mitigation: lexical fallback path (Section 6.10) ensures search always works. Query embedding cache (Section 6.8) reduces API call frequency.
6. **CLAUDE: Risk: Orchestrator changes break existing modification detection.**
   - Mitigation: regression test in Phase C (Section 8) verifies refinement flow.

## 14. Assumptions and Defaults

1. Supabase pgvector is available in cloud project. OpenAI `text-embedding-3-large` API is accessible via existing `OPENAI_API_KEY`.
2. `en` and `es` remain the only supported languages for this cycle.
3. Measurement preference remains explicit user setting, not locale-derived.
4. This cycle prioritizes completion of the two Irmixy abilities over adjacent features.
5. **CLAUDE: `user_recipes` table exists with expected schema** (`recipe_data JSONB`, `source TEXT`, etc.). Verify before building retrieval tool.

## 15. Deliverables Checklist

### DB
1. Vector extension migration.
2. `recipe_embeddings` migration + HNSW index + RLS.
3. `cooking_sessions` normalization migration (add missing columns + concurrency index).
4. Backfill Edge Function for recipe embeddings.

### Server
1. Hybrid retrieval module (`_shared/rag/hybrid-search.ts`) using OpenAI `text-embedding-3-large`.
2. Upgraded `search_recipes` with hybrid path (always on) + lexical degradation fallback.
3. New `retrieve_custom_recipe` tool + validator + registry wiring.
4. Orchestrator: tool-loop grounding fix + fallback template + resume actions.
5. Voice parity contract tests.
6. Security and adversarial test cases.

### App
1. Cooking progress persistence hook (`useCookingProgress`).
2. Resume prompt and resume routing (including `resume_cooking` action).
3. Replay disambiguation UX handling.
4. Regression coverage updates for chat/voice flows.
5. i18n key additions for all new prompts/actions/fallbacks.

## 16. Implementation Sequence (No Open Decisions)

Execute in this exact order:
1. **Verify** `user_recipes` table schema matches expectations.
2. Create DB migrations (vector extension, `recipe_embeddings` with HNSW, cooking session normalization).
3. Deploy migrations to cloud after mandatory backup (`cd yyx-server && npm run backup:all`).
4. Implement and deploy embedding backfill Edge Function (uses OpenAI `text-embedding-3-large`); run backfill.
5. Implement `_shared/rag/hybrid-search.ts` with OpenAI embedding + lexical degradation fallback.
6. Upgrade `search_recipes` to use hybrid retrieval (always on).
7. Implement `retrieve_custom_recipe` tool + validators + registry wiring.
8. Patch orchestrator: tool-loop grounding, fallback template, resume actions.
9. Add replay rendering paths in chat/voice screens.
10. Add `useCookingProgress` + cooking-step write path + resume prompt flow.
11. Add parity tests and command-level verification runs.
12. Deploy to production and monitor for 72 hours.

Done definition:
1. All acceptance scenarios in Section 10 pass.
2. Command matrix in Section 9.5 passes without unresolved failures.
3. Search latency and quality stable for 72 hours post-deploy.
4. Security/adversarial suite in Section 9.6 passes.
5. i18n review confirms EN/ES coverage for all new strings.

---

## Appendix A: Module Responsibility Map

> Adopted from CODEX architecture review methodology. Provides implementers with clear ownership boundaries, inputs/outputs, and coupling risks for each AI module.

| Module | Path | Responsibility | Inputs | Outputs | Coupling Risks |
|--------|------|----------------|--------|---------|----------------|
| **Chat Orchestrator** | `irmixy-chat-orchestrator/index.ts` | Route user messages through context → model → tool loop → response shaping | HTTP request with auth header, user message, session ID | SSE stream of `IrmixyResponse` chunks | Tightly coupled to tool registry, context builder, and AI gateway |
| **Voice Orchestrator** | `irmixy-voice-orchestrator/index.ts` | Two actions: `start_session` (quota check + OpenAI ephemeral token + session record) and `execute_tool` (secure backend execution of whitelisted voice tools) | `action` field (`start_session` or `execute_tool`), auth context, tool name + args (for execute_tool) | `start_session`: ephemeral token + session ID + quota info; `execute_tool`: shaped tool result for data channel relay | Must mirror chat orchestrator's tool policy for execute_tool; drift risk if tools diverge |
| **AI Gateway** | `_shared/ai-gateway/index.ts` | Provider-agnostic model calls (chat + stream) | Usage type, messages, temperature, response format | Model completion or async chunk iterator | Provider config via env vars; adding providers requires new translator |
| **Tool Registry** | `_shared/tools/tool-registry.ts` | Declare available tools with OpenAI function-call schemas | None (static declaration) | Tool definition array for model function calling | Single source of truth — voice and chat must read from same registry |
| **Tool Executor** | `_shared/tools/execute-tool.ts` | Dispatch tool calls to implementation, validate auth | Tool name, args, Supabase client (authed) | Raw tool result | Must validate tool name against registry; must not trust model-supplied user_id |
| **Tool Shaper** | `_shared/tools/shape-tool-response.ts` | Normalize tool results into `IrmixyResponse`-compatible shape | Raw tool result, tool name | Shaped response with cards/suggestions/actions | Must handle all tool return types; new tools require new shaping branch |
| **Tool Validators** | `_shared/tools/tool-validators.ts` | Sanitize and bounds-check tool arguments | Raw args from model | Validated args or validation error | Must be called before execution; missing validation = injection risk |
| **Search Recipes** | `_shared/tools/search-recipes.ts` | Lexical + hybrid recipe discovery with filters | Query, filters, user context | `RecipeCard[]` | Depends on hybrid-search module (new); existing lexical path must remain |
| **Hybrid Search** | `_shared/rag/hybrid-search.ts` *(new)* | Embedding generation (OpenAI text-embedding-3-large), vector retrieval, hybrid scoring | Query text, filters, user context | Scored + ranked recipe candidates | External API dependency on OpenAI; degrade to lexical on API failure |
| **Retrieve Custom Recipe** | `_shared/tools/retrieve-custom-recipe.ts` *(new)* | Replay/disambiguation of user's saved recipes | Query hints, timeframe, ingredients | `RetrieveCustomRecipeResult` (single/multiple/not_found) | Reads only from `user_recipes` scoped to auth.uid(); must not leak cross-user |
| **Allergen Filter** | `_shared/tools/allergen-filter.ts` | Hard-gate allergen conflicts from search/generation results | Recipe ingredients, user allergens | Pass/fail with conflict details | Word-boundary matching logic; "egg" must not match "eggplant" |
| **Context Builder** | `irmixy-chat-orchestrator/` (inline) | Load user profile, history, resumable sessions for system prompt | Supabase client, user ID | Assembled system prompt context | Parallel DB fetches; must not block on any single query failure |
| **Recipe Intent** | `irmixy-chat-orchestrator/recipe-intent.ts` | Classify user message intent (search vs generate vs modify vs replay) | User message text | Intent classification | Regex-based modification detection must be preserved |
| **Chat Service (App)** | `yyx-app/services/chatService.ts` | SSE client, message routing, partial recipe callback | User message, auth token | Parsed assistant messages with cards/actions/suggestions | `routeSSEMessage()` and `onPartialRecipe` are critical pipeline methods |
| **Cooking Progress (App)** | `yyx-app/hooks/useCookingProgress.ts` *(new)* | Persist/read cooking session step progress | Session ID, step number | Upsert confirmation, resumable session data | Writes to `cooking_sessions`; must handle offline/retry |

## Appendix B: Request Lifecycle Traces

> Adopted from CODEX architecture review methodology. Traces include failure branches for each flow.

### B.1 Text Chat Flow

```
User types message in ChatScreen
  │
  ├─► chatService.sendMessage(message, sessionId, authToken)
  │     │
  │     ├─► POST /irmixy-chat-orchestrator (SSE)
  │     │     │
  │     │     ├─► [AUTH] Validate JWT → ✗ 401 Unauthorized → app shows login prompt
  │     │     │
  │     │     ├─► [CONTEXT] Parallel fetch:
  │     │     │     ├─ user profile + preferences
  │     │     │     ├─ conversation history (last 10)
  │     │     │     └─ resumable cooking sessions
  │     │     │     └─► Any fetch fails → continue with partial context (non-blocking)
  │     │     │
  │     │     ├─► [INTENT] Check modification regex
  │     │     │     ├─ Match → regenerate recipe directly (skip model tool-choice call)
  │     │     │     └─ No match → proceed to model call
  │     │     │
  │     │     ├─► [MODEL CALL 1] AI Gateway chat() with tools
  │     │     │     ├─ Tool call → [VALIDATE] → [EXECUTE] → [SHAPE]
  │     │     │     │     ├─► Validation fails → return user-safe error in SSE
  │     │     │     │     ├─► Execution fails → return graceful error message
  │     │     │     │     └─► Success → shaped result ready
  │     │     │     │
  │     │     │     ├─ [MODEL CALL 2] Follow-up pass with tool results in context
  │     │     │     │     └─► Generate conversational text + suggestions
  │     │     │     │
  │     │     │     └─ No tool call → direct text response
  │     │     │
  │     │     ├─► [STREAM] SSE chunks to client
  │     │     │     ├─ onPartialRecipe → stream recipe card early (two-phase)
  │     │     │     └─ final message with suggestions/actions
  │     │     │
  │     │     └─► [PERSIST] Save assistant message to conversation history
  │     │
  │     └─► chatService.routeSSEMessage() dispatches to UI handlers
  │
  └─► ChatScreen renders cards, suggestions, actions
```

### B.2 Voice Chat Flow

```
User taps voice button
  │
  ├─► [SESSION START] POST /irmixy-voice-orchestrator { action: "start_session" }
  │     │
  │     ├─► [AUTH] Validate JWT → ✗ 401 → app shows error
  │     │
  │     ├─► [QUOTA] Check ai_voice_usage for current month
  │     │     └─► Exceeded → 429 with quota details → app shows quota message
  │     │
  │     ├─► [TOKEN] Fetch ephemeral token from OpenAI Realtime API
  │     │     └─► Fail → 502 → app shows connection error
  │     │
  │     ├─► [SESSION] Insert ai_voice_sessions record (status: active)
  │     │
  │     └─► Return { sessionId, ephemeralToken, remainingMinutes, quotaLimit }
  │
  ├─► App connects to OpenAI Realtime via WebRTC using ephemeral token
  │
  ├─► User speaks via OpenAI Realtime WebRTC
  │     │
  │     ├─► OpenAI Realtime transcribes + decides tool call
  │     │     │
  │     │     ├─► Tool call arrives on data channel
  │     │     │     │
  │     │     │     ├─► useVoiceChat extracts tool name + args
  │     │     │     │
  │     │     │     ├─► POST /irmixy-voice-orchestrator { action: "execute_tool", toolName, toolArgs }
  │     │     │     │     │
  │     │     │     │     ├─► [AUTH] Validate JWT → ✗ 401 → data channel error
  │     │     │     │     │
  │     │     │     │     ├─► [ALLOWLIST] Check tool against ALLOWED_VOICE_TOOLS
  │     │     │     │     │     └─► Unknown tool → 400 error
  │     │     │     │     │
  │     │     │     │     ├─► [CONTEXT] Build user context (profile, session, cooking state)
  │     │     │     │     │
  │     │     │     │     ├─► [EXECUTE] Shared execute-tool.ts
  │     │     │     │     │     └─► Fail → return graceful error
  │     │     │     │     │
  │     │     │     │     └─► [SHAPE] shape-tool-response.ts → return to data channel
  │     │     │     │
  │     │     │     └─► useVoiceChat relays result back to Realtime session
  │     │     │
  │     │     ├─► Realtime model generates spoken response using tool result
  │     │     │
  │     │     └─► Audio plays to user + transcript UI updates
  │     │
  │     └─► VoiceChatScreen renders cards/chips from data channel payloads
```

### B.3 Tool Execution Flow (Shared)

```
Tool call received (from chat orchestrator or voice orchestrator)
  │
  ├─► [REGISTRY] Look up tool by name in tool-registry.ts
  │     └─► Unknown tool → return "unsupported tool" error
  │
  ├─► [VALIDATE] tool-validators.ts checks:
  │     ├─ Required params present
  │     ├─ String lengths within bounds (200 char max for queries)
  │     ├─ Numeric ranges valid
  │     ├─ Timeframes within 365-day window
  │     └─► Fail → return user-safe validation error (no internal details)
  │
  ├─► [AUTH] Verify Supabase client has authenticated user
  │     └─► No auth → reject (never execute tools for anonymous users)
  │
  ├─► [EXECUTE] Dispatch to tool implementation:
  │     ├─ search_recipes → hybrid path (always on)
  │     │     ├─ embedding API fails → lexical fallback (Section 6.10)
  │     │     ├─ < 2 results above threshold → deterministic fallback (Section 6.9)
  │     │     └─ Success → RecipeCard[]
  │     ├─ generate_custom_recipe → AI Gateway + safety checks
  │     ├─ retrieve_custom_recipe → user_recipes query + scoring
  │     │     └─ Returns single/multiple/not_found
  │     └─ (other tools as registered)
  │
  ├─► [SAFETY] Post-execution checks:
  │     ├─ Allergen filter (hard gate)
  │     └─ Food safety validation (for generated recipes)
  │
  └─► [SHAPE] shape-tool-response.ts normalizes to IrmixyResponse fields
```

## Appendix C: Data Model Map (AI Feature Surfaces)

> Adopted from CODEX architecture review methodology. Maps which modules read/write each entity.

| Entity | Table | Read By | Written By | Key Fields |
|--------|-------|---------|------------|------------|
| **Recipes** | `recipes` | search-recipes, hybrid-search, orchestrator context | Admin/migration only | `id`, `name_en`, `name_es`, `is_published`, `difficulty`, `total_time_minutes` |
| **Recipe Embeddings** | `recipe_embeddings` *(new)* | hybrid-search via service-role client (vector similarity) | backfill-embeddings Edge Function (service role) | `recipe_id`, `embedding`, `content_hash`, `embedding_model` |
| **Recipe Ingredients** | `recipe_ingredients` | search-recipes (lexical scoring), allergen-filter | Admin/migration only | `recipe_id`, `ingredient_id`, `quantity`, `unit` |
| **Ingredients** | `ingredients` | allergen-filter, search scoring, recipe generation enrichment | Admin/migration only | `id`, `name_en`, `name_es`, `food_allergy_id` |
| **Ingredient Aliases** | `ingredient_aliases` | `find_closest_ingredient()`, `batch_find_ingredients()` | Migration seeded | `canonical_name`, `alias`, `language` |
| **Food Safety Rules** | `food_safety_rules` | Recipe generation safety checks | Migration seeded | `ingredient_category`, `min_temp_f`, `min_time_minutes` |
| **User Recipes** | `user_recipes` | retrieve-custom-recipe, orchestrator context | customRecipeService.save() (app, on Start Cooking) | `user_id`, `recipe_data` (JSONB), `source`, `created_at` |
| **Cooking Sessions** | `cooking_sessions` | orchestrator context builder, useCookingProgress (app) | useCookingProgress (app), mark_stale_cooking_sessions() | `user_id`, `recipe_id`, `current_step`, `status`, `last_active_at` |
| **Chat Sessions** | `chat_sessions` / `chat_messages` | orchestrator context builder (last 10 messages) | orchestrator (persists assistant messages) | `session_id`, `user_id`, `role`, `content` |
| **User Profiles** | `user_profiles` | orchestrator context builder | App profile settings | `user_id`, `food_allergies`, `diet_types`, `cuisine_preferences` |
| **Food Allergies** | `food_allergies` | allergen-filter (lookup) | Migration seeded | `id`, `name_en`, `name_es` |
| **Diet Types** | `diet_types` | search filter, recipe generation | Migration seeded | `id`, `name_en`, `name_es` |
| **Tags** | `tags`, `recipe_tags` | search scoring (lexical), hybrid scoring | Admin/migration only | `id`, `name_en`, `name_es` |

### C.1 Ownership and Trust Boundaries

```
┌─────────────────────────────────────────────────┐
│ TRUSTED (service role only)                      │
│  recipe_embeddings (read + write)                │
│  recipes, ingredients, tags (write)              │
│  food_safety_rules, ingredient_aliases (write)   │
├─────────────────────────────────────────────────┤
│ USER-SCOPED (auth.uid() enforced)               │
│  user_recipes (read/write own only)             │
│  cooking_sessions (read/write own only)         │
│  chat_sessions/messages (read/write own only)   │
│  user_profiles (read/write own only)            │
├─────────────────────────────────────────────────┤
│ PUBLIC READ (published content)                  │
│  recipes (is_published = true)                  │
│  ingredients, tags, food_allergies, diet_types  │
└─────────────────────────────────────────────────┘
```

## Appendix D: Extension Blueprint — How to Add a New AI Tool

> Adopted from CODEX architecture review methodology. Provides a decision-complete sequence for adding new capabilities, with worked examples.

### D.1 Ordered Implementation Checklist

When adding a new tool to the Irmixy AI system, follow this exact file-touch sequence:

1. **Define types** — Add the tool's input/output TypeScript types.
   - File: `_shared/tools/<tool-name>.ts` (new)
   - Include the return type union if tool has multiple outcome shapes.

2. **Add validator** — Add input validation with bounds and sanitization.
   - File: `_shared/tools/tool-validators.ts`
   - Enforce max lengths, valid enums, numeric ranges.

3. **Implement tool** — Write the tool's core logic.
   - File: `_shared/tools/<tool-name>.ts`
   - All DB queries scoped to `auth.uid()` for user-owned data.
   - No direct AI provider calls — use AI Gateway if LLM needed.

4. **Register in registry** — Add OpenAI function-call schema.
   - File: `_shared/tools/tool-registry.ts`
   - Schema must match validator expectations exactly.

5. **Add shaping** — Normalize tool result to `IrmixyResponse` fields.
   - File: `_shared/tools/shape-tool-response.ts`
   - Handle all return type variants (success, error, empty).

6. **Wire into executor** — Add dispatch case.
   - File: `_shared/tools/execute-tool.ts`
   - Call validator before execution.

7. **Update orchestrator** — Include tool in model's available tools.
   - File: `irmixy-chat-orchestrator/index.ts`
   - Add any special fallback/routing logic.
   - Update system prompt if tool requires specific instructions.

8. **Update voice path** — Mirror tool availability.
   - File: `irmixy-voice-orchestrator/index.ts`
   - Add voice-specific response shaping if needed.

9. **Add app handling** — Parse and render tool results.
   - File: `chatService.ts` (SSE message routing)
   - File: `ChatScreen.tsx` (UI rendering)
   - File: `VoiceChatScreen.tsx` (voice UI parity)

10. **Add i18n keys** — All user-facing strings in EN + ES.
    - File: `yyx-app/i18n/locales/en/chat.ts`
    - File: `yyx-app/i18n/locales/es/chat.ts`

11. **Write tests** — Unit + integration.
    - Validator bounds tests.
    - Tool execution with mock Supabase.
    - Unauthorized access rejection.
    - Shaping for all return variants.
    - Contract parity test (voice vs text).

12. **DB migration** (if needed) — New table, RLS, indexes.
    - File: `yyx-server/supabase/migrations/TIMESTAMP_<name>.sql`
    - Always backup first: `npm run backup:all`.

### D.2 Worked Example: `add_to_shopping_cart`

> Non-goal for this cycle, but illustrates the extension pattern for future reference.

**Step 1 — Types:**
```typescript
// _shared/tools/add-to-shopping-cart.ts
interface AddToShoppingCartArgs {
  recipeId: string;
  servings?: number;  // default: recipe's default servings
}

interface AddToShoppingCartResult {
  version: '1.0';
  type: 'added';
  itemCount: number;
  recipeName: string;
  suggestions: Array<{ label: string; message: string }>;
}
```

**Step 2 — Validator:** max servings 50, recipeId must be UUID format.

**Step 3 — Implementation:** query `recipe_ingredients` for recipeId, scale by servings, upsert into `shopping_cart_items` table scoped to `auth.uid()`.

**Step 4 — Registry:**
```typescript
{
  name: 'add_to_shopping_cart',
  description: 'Add all ingredients from a recipe to the user\'s shopping cart',
  parameters: {
    type: 'object',
    properties: {
      recipeId: { type: 'string', description: 'The recipe ID' },
      servings: { type: 'number', description: 'Number of servings to scale ingredients for' },
    },
    required: ['recipeId'],
  },
}
```

**Step 5-12:** Follow checklist. DB migration creates `shopping_cart_items` with RLS `auth.uid() = user_id`.

### D.3 Worked Example: `create_meal_plan`

> Non-goal for this cycle, but illustrates multi-step tool pattern.

**Key difference from simple tools:** This tool requires a multi-turn conversation (select days → suggest recipes → confirm). Implementation options:
1. **Single tool, structured output** — Tool returns a proposed plan; user confirms via suggestion chip → orchestrator saves.
2. **Multi-tool sequence** — `draft_meal_plan` → user feedback → `finalize_meal_plan`.

Recommended: Option 1 (simpler, matches existing patterns). The tool returns a draft plan with `IrmixyResponse.suggestions` containing "Looks good, save it" and "Change Wednesday's dinner" chips. Confirmation triggers a second tool call to `save_meal_plan`.

**DB migration:** `meal_plans` table + `meal_plan_entries` (day, meal_type, recipe_id), both with `user_id` RLS.

## Appendix E: Plan Validation Scenarios

> Adopted from CODEX architecture review methodology. Self-checks to verify this plan's completeness.

1. **Flow completeness check:**
   - Each of text/voice/tool flows in Appendix B includes: trigger, auth, orchestration, model/tool interaction, persistence/return path, UI update, and failure branches.

2. **Module boundary check:**
   - Every module in Appendix A has defined inputs and outputs. No module writes to a table without appearing in the "Written By" column of Appendix C.

3. **Extensibility check:**
   - Appendix D's "new tool" blueprint is decision-complete — an implementer can follow it without making undocumented architectural choices.

4. **Risk coverage check:**
   - Each risk in Section 13 maps to at least one mitigation, test case (Section 9), and/or acceptance scenario (Section 10).

5. **Security invariant check:**
   - Every user-scoped table in Appendix C enforces `auth.uid()` in both RLS and query predicates (Section 6.0).
   - No tool accepts `user_id` from model output.

6. **Ingredient embedding check:**
   - Recipe embedding content formula (Section 5.2) includes ingredient names. Verify backfill produces embeddings that capture ingredient semantics (test: "chicken rice" query returns chicken+rice recipes).

7. **Citation requirement:**
   - During implementation, every architectural change should reference its spec section (e.g., "per Section 6.10, adding lexical fallback").
