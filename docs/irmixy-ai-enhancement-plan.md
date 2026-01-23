# Irmixy AI Enhancement Plan

## Executive Summary

Transform the Irmixy chat from a basic Q&A assistant into a personalized, context-aware cooking companion that feels like magic. Focus on text chat first (cost-efficient), then ensure voice uses identical logic.

---

## Part 1: Unified AI Gateway Architecture

### Current State
- `ai-chat` and `ai-voice` have separate system prompts and logic
- No shared context enrichment
- User profile data is not used in AI prompts

### Critical Design Decisions

#### 1. Canonical Response Schema (Structured Output)
Problem: Parsing free-form LLM text for actions/cards is brittle and unsafe.
Solution: LLM returns structured JSON; UI renders from schema, not parsing.

```typescript
interface IrmixyResponse {
  // Schema version for backwards compatibility
  version: '1.0';

  // Core content
  message: string;
  language: 'en' | 'es';

  // Structured UI elements (not parsed from message)
  recipes?: RecipeCard[];
  suggestions?: SuggestionChip[];
  actions?: QuickAction[];
  substitutions?: Substitution[];

  // Metadata
  citations?: Citation[];
  memoryUsed?: string[];

  // Safety and debugging
  safetyFlags?: {
    allergenMentioned?: boolean;
    dietaryConflict?: boolean;
    error?: boolean; // Set if schema validation failed
  };
  trace?: {
    toolsCalled: string[];
    ragResultCount: number;
    ragConfidence?: number; // 0-1, filter low confidence
    latencyMs: number;
  };
}

// Server-side validation (reject malformed responses)
function validateResponse(response: unknown): IrmixyResponse {
  const parsed = IrmixyResponseSchema.safeParse(response);
  if (!parsed.success) {
    console.error('Schema validation failed:', parsed.error);
    return {
      version: '1.0',
      message: "I'm sorry, I encountered an issue. Could you try again?",
      language: 'en',
      safetyFlags: { error: true },
    };
  }
  return parsed.data;
}

interface RecipeCard {
  recipeId: string;
  name: string;
  imageUrl?: string;
  totalTime: number;
  portions: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface SuggestionChip {
  label: string;   // "Make it healthier"
  message: string; // Full message to send if clicked
}

interface QuickAction {
  type: 'view_recipe' | 'start_cooking' | 'add_to_list' | 'set_timer';
  label: string;
  payload: Record<string, any>; // { recipeId: '...' } or { minutes: 30 }
}
```

#### 2. Tool Execution Loop (Explicit, Max 1 Round)
Problem: Sequential intent -> tools -> RAG -> LLM blows latency budget.
Solution: Single tool-calling round: LLM #1 (decides tools or final response) -> tools (if needed) -> LLM #2 (final), then STOP.

Explicit flow:

Step 1: Context and redaction (parallel)
- Fetch user profile and recent events
- Apply `redactForPrompt()` to mask PII
- Result: safe context string for injection

Step 2: LLM Call #1 (with tools available)
- Input: user message + system prompt + redacted context + tool definitions
- Output must be one of:
  - Final `IrmixyResponse` (no tools needed)
  - Tool calls only (no final response content)

Step 3: Tool execution (only if Step 2 requested tools)
- Execute up to 2 tool calls in parallel
- If RAG: keep only confidence >= 0.5
- If no results: set `note: 'no_results'` in tool output

Step 4: LLM Call #2 (final response)
- Input: original message + system prompt + context + tool results (tool-role)
- Output: final `IrmixyResponse`
- Constraint: no further tool calls allowed

Step 5: Safety guardrails (always runs)
- Schema validation (`IrmixyResponseSchema`)
- Allergen filter on `recipes[]`
- Validate recipe IDs exist
- Validate `actions[]` payloads (bounds, IDs, lengths)
- Redact any leaked PII

Routing to endpoints:
- `ai-chat`
  - If no tools: stream `message` tokens from LLM #1
  - If tools: stream `thinking` events only, then stream `message` from LLM #2
  - After streaming: send full `IrmixyResponse`
- `ai-voice`
  - Use `response.message` for TTS (identical to text)
  - Return audio + full `IrmixyResponse` as JSON

Latency budget (aligned):

| Stage | Target | Acceptable | Fail |
| --- | --- | --- | --- |
| Context fetch | ~50ms | ~100ms | >200ms |
| LLM #1 | ~500ms | ~600ms | >800ms |
| Tool execution | ~200ms | ~300ms | >500ms |
| LLM #2 (if tools) | ~500ms | ~600ms | >800ms |
| Safety guardrails | ~50ms | ~100ms | >200ms |
| Total (no tools) | ~600ms | ~750ms | >1000ms |
| Total (with tools) | ~1300ms | ~1750ms | >2000ms |

#### 3. Memory Strategy (Token Budget + Redaction)
Problem: Full history + profile + activity can balloon tokens and leak sensitive data.
Solution: Tiered memory with strict budgets + pre-prompt redaction.

```typescript
interface MemoryStrategy {
  // Tier 1: Always included (~200 tokens)
  profile: {
    name: string;
    dietaryRestrictions: string[]; // CRITICAL - never suggest allergens
    dietTypes: string[];
    skillLevel: string;
    householdSize: number;
  };

  // Tier 2: Session context (~300 tokens)
  session: {
    recentMessages: Message[]; // Last 4-6 messages only
    currentRecipeId?: string;  // If viewing/cooking a recipe
  };

  // Tier 3: Long-term patterns (~100 tokens, summarized)
  // ONLY if user opted in to crossSessionMemory
  patterns?: {
    favoriteCuisines: string[]; // Top 3
    typicalCookingTime: string; // "weeknight dinners ~30min"
    recentRecipes: string[];    // Last 3 cooked (names only)
  };
}

// CRITICAL: Redaction before prompt injection
function redactForPrompt(context: MemoryStrategy): MemoryStrategy {
  return {
    ...context,
    profile: {
      ...context.profile,
      // Never include in prompt (use for filtering only):
      // - email, phone, address
      // - weight, height, birth_date (use derived "activity_level" only)
      // - medical conditions beyond dietary restrictions
    },
  };
}

const TOKEN_CAPS = {
  profile: 200,
  session: 300,
  patterns: 100,
  toolResults: 500,
};
```

Session summarization: After 10 messages, summarize older ones into one paragraph.

Minimal personalization mode (if user opts out):
- Still use dietary restrictions (safety)
- Generic greeting, no name
- No pattern references

#### 4. Streaming Envelope (Progressive UI)
Problem: Streaming message but sending cards/suggestions later causes UI pop-in.
Solution: Stream in phases with skeleton placeholders.

```typescript
// SSE event types for progressive rendering
type StreamEvent =
  | { type: 'session', sessionId: string }
  | { type: 'content', content: string } // Stream message tokens
  | { type: 'thinking', status: string } // "Searching recipes..."
  | { type: 'structured', data: Partial<IrmixyResponse> }
  | { type: 'done', fullResponse: IrmixyResponse };
```

Streaming rules:
- If no tools: stream `content` from LLM #1 immediately.
- If tools: send `thinking` events only until LLM #2 returns, then stream `content`.

#### 5. Intent Classification (Analytics Only)
Intent classification runs post-response for analytics only and never gates routing.

```typescript
async function logInteractionAnalytics(
  request: ChatRequest,
  response: IrmixyResponse
) {
  const intent = await cheapClassifyIntent(request.message);

  await supabase.from('chat_analytics').insert({
    sessionId: request.sessionId,
    userMessage: request.message,
    detectedIntent: intent,
    toolsCalled: response.trace?.toolsCalled,
    ragConfidence: response.trace?.ragConfidence,
    responseLatencyMs: response.trace?.latencyMs,
    userLanguage: request.language,
    experimentGroup: getExperimentGroup(request.userId),
  });
}
```

### Key Files to Create/Modify
- New: `yyx-server/supabase/functions/ai-orchestrator/index.ts`
- New: `yyx-server/supabase/functions/_shared/context-builder.ts`
- New: `yyx-server/supabase/functions/_shared/types/response.ts`
- New: `yyx-server/supabase/functions/_shared/tools/`
- Modify: `ai-chat` and `ai-voice` -> thin wrappers calling orchestrator

---

## Part 2: Text Chat Improvements

1. Smart suggestion chips (context-aware)
   - If personalization enabled: time of day + recent activity + profile + conversation
   - If personalization disabled: time of day + conversation only

2. Streaming with typing indicator
   - Typing indicator on start
   - Stream message tokens
   - Subtle haptic or sound on completion

3. Rich message cards
   - Render inline recipe cards from `IrmixyResponse.recipes[]`

4. Quick actions from structured response only
   - UI renders only `IrmixyResponse.actions[]` (no text parsing)

5. Conversation memory indicators (privacy-gated)
   - Only show if `personalizationEnabled` is true
   - Subtle pill badge, dismissible

6. Multi-turn recipe building
   - Guide with selectable options (cuisine, time, diet)

7. Inline ingredient substitutions
   - Structured substitutions panel when `IrmixyResponse.substitutions[]` present

8. Proactive error prevention
   - Flag likely issues and offer alternatives (respect dietary safety)

9. Session continuity (privacy-gated)
   - Only show cross-session cues if `crossSessionMemory` enabled

10. Feedback loop
   - Thumbs up/down per response
   - Optional "Was this helpful?" prompt

---

## Part 3: AI Personalization Features (Magic Feel)

All personalization features are gated by `personalizationEnabled` and specific toggles.

1. Personalized greeting
2. Cooking pattern learning
3. Ingredient awareness
4. Dietary compliance guardian
5. Skill-appropriate suggestions
6. Equipment-aware recommendations
7. Taste profile matching
8. Nutritional goal tracking
9. Family/household awareness
10. Celebration and milestone recognition

---

## Part 4: RAG Implementation Strategy

RAG is valuable for recipe discovery, technique answers, and nutrition details.

### Hybrid Retrieval Architecture
- Parallel vector search + keyword search
- Apply metadata filters (time, diet, allergens)
- Merge and re-rank results

### Chunking Strategy
- `recipe_overview`, `recipe_ingredients`, `recipe_step`, `technique`

### Multilingual Handling
- Separate EN/ES embeddings
- Query with user language

### Confidence Scoring
```
confidence = 0.5 * vectorScore + 0.3 * keywordScore + 0.2 * metadataBoost
```
- High >= 0.70, Medium >= 0.45, Low < 0.45 (tune via eval harness)
- Low confidence -> LLM asks clarifying question

---

## Part 5: Intent Detection (Analytics Only)

Intent is post-response telemetry only, never used for routing.

---

## Part 6: Magical Cooking Experience Features

1. "What's in your fridge" mode
2. Smart cooking notifications (consent-gated)
3. Meal prep assistant
4. Live cooking companion
5. Recipe adaptation engine
6. Seasonal and local awareness
7. Social cooking features
8. Gamification
9. Smart shopping integration
10. Predictive suggestions

---

## Part 7: Privacy Controls and Consent

### Defaults
- Personalization ON (basic), advanced features OFF
- Chat history retention: 30 days
- Session summaries: 90 days
- Patterns: 12 months

### Required Implementations
- Onboarding opt-in screen
- Settings screen with granular toggles
- "Forget me" button
- Data usage transparency via `memoryUsed`
- Proactive features gated by toggles

### Safety Guardrails (Always On)
- Allergen blocking (rule-based)
- No medical advice
- PII redaction
- Action payload validation
- Safety guardrails never disabled by cost tier

---

## Part 8: Evaluation Harness

### Test Categories
- Intent classification accuracy
- RAG retrieval relevance
- Safety compliance
- Latency regression
- Cost tracking

### Cost Tiers
- Premium, standard, economy
- Safety guardrails always on
- Tier change banner shown once per session if downgraded

---

## Plan Integrity Checklist

- No text parsing for UI elements
- Explicit tool loop with max 1 tool round
- Schema validation with safe fallback
- Intent analytics-only
- Pre-prompt redaction
- RAG scoring defined and tuned via eval
- Privacy gating for cross-session features and memory indicators
- Streaming rules: no `content` until final response when tools are called
- Action payload validation in safety guardrails
- Cost tiers never disable safety filters

---

## Implementation Order (Revised)

Phase 1: Foundation - Response schema and gateway
1. Define `IrmixyResponse` types
2. Create `ai-orchestrator` (minimal)
3. Update `ai-chat` to use orchestrator
4. Update `ai-voice` to use orchestrator

Phase 2: Context and memory
5. Implement context-builder with tiers
6. Add session summarization
7. Add context caching
8. Create privacy settings table

Phase 3: Tools and function calling
9. Tool schemas
10. Tool handlers
11. Orchestrator tool loop
12. Safety guardrails (including action validation)

Phase 4: Client UI
13. RecipeCard component
14. QuickActionButton component
15. ChatScreen rendering from schema
16. Smart suggestions rendering

Phase 5: RAG
17. Enable pgvector and chunks table
18. Embedding generator
19. Hybrid search function
20. Hook `search_recipes` tool to RAG

Phase 6: Evaluation and monitoring
21. Eval test suite
22. Response tracing
23. Cost tracking

Phase 7: Personalization features
24. Consent flow
25. Personalized greetings
26. Pattern analysis
27. Privacy-gated memory indicators

Phase 8: Magic features (consent-gated)
28. Proactive suggestions
29. Recipe adaptation
30. Cross-session memory

---

## Key Files Summary

New files:
- `yyx-server/supabase/functions/_shared/types/response.ts`
- `yyx-server/supabase/functions/ai-orchestrator/index.ts`
- `yyx-server/supabase/functions/_shared/context-builder.ts`
- `yyx-server/supabase/functions/_shared/tools/definitions.ts`
- `yyx-server/supabase/functions/_shared/tools/handlers.ts`
- `yyx-server/supabase/functions/_shared/safety.ts`
- `yyx-server/supabase/functions/_shared/rag/search.ts`
- `yyx-server/scripts/run-eval.ts`
- `yyx-server/scripts/generate-embeddings.ts`
- `yyx-app/components/chat/RecipeCard.tsx`
- `yyx-app/components/chat/QuickActionButton.tsx`
- `yyx-app/app/(auth)/settings/privacy.tsx`

Modified files:
- `yyx-server/supabase/functions/ai-chat/index.ts`
- `yyx-server/supabase/functions/ai-voice/index.ts`
- `yyx-app/components/chat/ChatScreen.tsx`
- `yyx-app/services/chatService.ts`

New migrations:
- `XXXXXX_add_privacy_settings.sql`
- `XXXXXX_add_recipe_embeddings.sql`
