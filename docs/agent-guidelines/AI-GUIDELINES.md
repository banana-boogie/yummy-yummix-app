# AI Guidelines

Domain playbook for the YummyYummix AI system — gateway, tool system, RAG,
orchestrators, and AI-powered features.

---

## Architecture Overview

```
Client Request
  ↓
Edge Function (auth, CORS)
  ↓
Context Builder (user profile + conversation history)
  ↓
AI Orchestrator (chat or voice)
  ├→ AI Gateway (chat/chatStream/embed)
  ├→ Tool Execution (search/generate/retrieve)
  └→ Hybrid Search (RAG: vector + lexical)
  ↓
Response Builder (validation, persistence)
  ↓
SSE Stream to Client
```

**Primary reference:** `docs/architecture/CLAUDE-AI-ARCHITECTURE.md` —
comprehensive 900-line architecture document. Read this for deep context.

---

## Directory Map

```
yyx-server/supabase/functions/
├── _shared/
│   ├── ai-gateway/                   # Provider-agnostic AI interface
│   │   ├── index.ts                  # Public API: chat(), chatStream(), embed()
│   │   ├── router.ts                 # Usage-type → provider/model routing
│   │   ├── types.ts                  # AICompletionRequest, AICompletionResponse, etc.
│   │   └── providers/
│   │       └── openai.ts             # OpenAI: completions, streaming, embeddings
│   ├── tools/                        # AI function calling system
│   │   ├── tool-registry.ts          # Single source of truth for all tools
│   │   ├── execute-tool.ts           # Dispatches tool calls
│   │   ├── tool-validators.ts        # Zod parameter validation per tool
│   │   ├── shape-tool-response.ts    # Normalizes results for frontend
│   │   ├── generate-custom-recipe.ts # Recipe generation pipeline (1000+ lines)
│   │   ├── modify-recipe.ts          # Recipe modification (reuses generation pipeline)
│   │   ├── search-recipes.ts         # Hybrid search tool (420+ lines)
│   │   └── retrieve-custom-recipe.ts # Past recipe retrieval (450+ lines)
│   ├── rag/
│   │   └── hybrid-search.ts          # Semantic + lexical search engine (420+ lines)
│   ├── context-builder.ts            # User profile + conversation history
│   ├── irmixy-schemas.ts             # Zod schemas for all AI responses
│   ├── allergen-filter.ts            # Allergen detection & warnings
│   ├── food-safety.ts                # USDA cooking temperature validation
│   ├── ingredient-normalization.ts   # Fuzzy ingredient matching
│   └── equipment-utils.ts            # Kitchen equipment helpers
├── irmixy-chat-orchestrator/         # Text chat (modular)
│   ├── index.ts                      # SSE entry point, tool loop
│   ├── types.ts, logger.ts, session.ts
│   ├── system-prompt.ts              # Dynamic prompt builder
│   ├── ai-calls.ts                   # Gateway integration
│   ├── response-builder.ts           # Response formatting + persistence
│   ├── recipe-intent.ts              # High recipe intent detection
│   ├── meal-context.ts               # Meal type extraction
│   ├── modification.ts               # Recipe modification detection
│   └── suggestions.ts                # Template suggestion chips
└── irmixy-voice-orchestrator/        # Voice sessions
    └── index.ts                      # Session bootstrap, quota, tool execution
```

---

## AI Gateway

### Core Rule

**ALL non-voice AI calls go through the gateway. Never call
OpenAI/Anthropic/etc. directly.**

### Scope

The gateway handles **chat completions and embeddings** — the two standard
request/response AI patterns:

- `chat()` and `chatStream()` for text generation (all usage types)
- `embed()` for vector embeddings (semantic search)

**Voice is excluded.** The voice orchestrator uses OpenAI's Realtime API via
WebRTC, which is a fundamentally different protocol (persistent bidirectional
connection vs request/response). It bypasses the gateway by design — see
`irmixy-voice-orchestrator/`.

### Public API

```typescript
import { chat, chatStream, embed } from '../_shared/ai-gateway/index.ts';

// Standard completion (structured output)
const response = await chat({
  usageType: 'text',
  messages: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }],
  reasoningEffort: 'low',
  responseFormat: { type: 'json_schema', schema: { /* JSON Schema */ } },
});

// Streaming
for await (const chunk of chatStream({
  usageType: 'text',
  messages: [...],
})) {
  // chunk is a string token
}

// Embeddings
const embedding = await embed({
  usageType: 'embedding',
  input: 'text to embed',
});
```

### Usage Types

| Type                  | Default Model          | Config           | Use Case                                     | Cost     |
| --------------------- | ---------------------- | ---------------- | -------------------------------------------- | -------- |
| `text`                | gpt-4.1-mini           | N/A              | Chat orchestrator (tool calling + streaming) | Low      |
| `recipe_generation`   | gpt-5-mini             | reasoning: `low` | Recipe generation (structured JSON output)   | Low      |
| `recipe_modification` | gpt-4.1-mini           | N/A              | Recipe modification (transform existing JSON)| Low      |
| `parsing`             | gpt-4.1-nano           | temperature: `1` | Admin parsing, nutritional data extraction   | Very low |
| `embedding`           | text-embedding-3-large | N/A              | Vector search (3072 dimensions)              | Low      |

Override via env vars: `AI_TEXT_MODEL`, `AI_RECIPE_GENERATION_MODEL`,
`AI_PARSING_MODEL`.

### Design Pattern

OpenAI format is the **universal interface** (lingua franca). Each provider
translates from this common format to their native API. This is NOT
OpenAI-specific — it's the industry standard (same as Vercel AI SDK, LangChain).

---

## Adding New Providers

1. Create `ai-gateway/providers/<name>.ts`
2. Implement the same interface as `openai.ts`: `callProvider()`,
   `callProviderStream()`, `callProviderEmbedding()`
3. Update `router.ts` to route appropriate usage types to the new provider
4. The gateway interface (`index.ts`) stays unchanged

---

## Tool System

### Tool Registry Pattern

All tools are defined in `tool-registry.ts` — single source of truth:

```typescript
interface ToolRegistration {
  aiTool: AITool; // OpenAI function calling schema
  allowedInVoice: boolean; // Voice safety flag
  execute: (args, context) => Promise<unknown>;
  shapeResult: (result) => ToolShape;
}
```

Current tools:

- `search_recipes` — Search published recipes (voice-enabled)
- `generate_custom_recipe` — AI-generated personalized recipes (voice-enabled)
- `modify_recipe` — Modify a previously generated recipe (voice-enabled)
- `retrieve_cooked_recipes` — Fetch user cooked-history recipes (voice-enabled)

### Adding New Tools (4-step process)

1. **Register** in `tool-registry.ts` — Define `aiTool` schema,
   `allowedInVoice`, `execute`, `shapeResult`
2. **Validate** in `tool-validators.ts` — Add Zod schema for parameters
3. **Implement** the execute function — Either inline or as a separate file for
   complex tools
4. **Shape** in `shape-tool-response.ts` — Add result normalization for frontend

### Tool Execution Flow

```
AI returns tool_call → execute-tool.ts validates + dispatches
  → Tool executes with context (supabase, userContext, callbacks)
  → Result shaped for frontend
  → AI receives result and generates final response
```

---

## RAG: Hybrid Search

Located in `_shared/rag/hybrid-search.ts`.

### Scoring Weights

| Component                       | Weight | Source                     |
| ------------------------------- | ------ | -------------------------- |
| Semantic (vector similarity)    | 40%    | pgvector cosine distance   |
| Lexical (keyword matching)      | 35%    | Name, tag, keyword matches |
| Metadata (time, difficulty)     | 10%    | Filter constraints         |
| Personalization (cuisine prefs) | 15%    | User preferences           |

### Key Thresholds

- Include threshold: 0.42
- Fallback to lexical when zero results are above threshold

### Graceful Degradation

- Falls back to lexical-only if embedding API fails
- Returns empty with `degradationReason` for caller to handle
- Reasons: `embedding_failure`, `no_semantic_candidates`, `low_confidence`

---

## Two-Phase SSE Pattern

For recipe generation, use two-phase streaming:

1. **Phase 1:** Send `recipe_partial` event with the AI-generated recipe
   immediately
2. **Phase 2:** Enrich with ingredient images, nutrition data, etc.
3. **Final:** Send `done` event with the complete, enriched recipe

This gives the user immediate feedback while background enrichment happens.

---

## Intent Detection

The chat orchestrator uses **LLM-driven tool selection** (`toolChoice: "auto"`).
Do not add pre-LLM intent forcing by regex heuristics unless explicitly
approved.

- **Meal context:** `meal-context.ts` extracts meal type (breakfast, lunch,
  dinner) and injects it into prompt context
- **Fixed tool-result messages:** `fixed-messages.ts` returns deterministic copy
  for search/retrieval/custom recipe outcomes to remove narration and latency

---

## Safety Systems

### Allergen Pre-Check

`allergen-filter.ts` checks generated recipes against user's known allergies
before serving.

### Food Safety

`food-safety.ts` validates cooking parameters against USDA rules (stored in
`food_safety_rules` table). Categories: poultry, ground_meat, red_meat, seafood,
eggs.

### SafetyFlags Schema

```typescript
{
  allergenWarning?: string,   // "Contains dairy (user allergic)"
  dietaryConflict?: string,   // "Contains meat (user is vegetarian)"
  error?: boolean
}
```

---

## Thermomix-Aware Generation

When user has Thermomix equipment:

- System prompt automatically includes Thermomix instructions
- AI generates `thermomixTime`, `thermomixTemp`, `thermomixSpeed` per step
- Validation ensures parameters are within valid ranges
- Frontend displays Thermomix cooking parameters in step-by-step guide

See `generate-custom-recipe.ts` for the Thermomix system prompt section.

---

## Context Builder

`context-builder.ts` loads user context in parallel:

```typescript
interface UserContext {
  language: "en" | "es";
  measurementSystem: "imperial" | "metric";
  dietaryRestrictions: string[]; // HARD constraint
  ingredientDislikes: string[];
  skillLevel: string | null;
  householdSize: number | null;
  conversationHistory: Array<{ role; content; metadata }>;
  dietTypes: string[]; // MEDIUM constraint
  cuisinePreferences: string[]; // SOFT constraint
  customAllergies: string[];
  kitchenEquipment: string[];
}
```

Safety features: input sanitization (control chars, 2000 char limit), list
sanitization (max 20 items), graceful degradation (continues with defaults if
profile fetch fails).

---

## Schemas (Zod Validation)

Located in `irmixy-schemas.ts`. Key schemas:

- **RecipeCardSchema** — Published recipe cards (recipeId, name, imageUrl,
  totalTime, difficulty, portions)
- **GeneratedRecipeSchema** — AI-generated recipes with Thermomix parameters
- **IrmixyResponseSchema** — Unified AI response (message, recipes,
  customRecipe, suggestions, actions, safetyFlags)
- **SafetyFlagsSchema** — Allergen and dietary warnings

Use `validateSchema()` helper for runtime validation.

---

## Testing

Write Deno tests. Mock helpers in `_shared/test-helpers/mocks.ts`.

Reference tests:

- `_shared/tools/tool-registry.test.ts`
- `_shared/__tests__/food-safety.test.ts`
- `_shared/rag/hybrid-search.test.ts`

---

## Key Rules

1. **All AI calls through the gateway** — never direct API calls
2. **All tools through the registry** — never ad-hoc tool implementations
3. **Structured output with JSON schemas** — always validate AI output
4. **Bilingual** — all AI responses in user's preferred language (en or es)
5. **Safety first** — allergen checking and food safety are non-negotiable
6. **Graceful degradation** — always have a fallback when AI services fail
