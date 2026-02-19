# Backend Guidelines

Domain playbook for the YummyYummix backend — Supabase Edge Functions written in Deno/TypeScript.

---

## Directory Map

```
yyx-server/supabase/functions/
├── _shared/                          # Shared utilities (import from here)
│   ├── ai-gateway/                   # AI provider abstraction (owned by ai-engineer)
│   │   ├── index.ts                  # Public API: chat(), chatStream(), embed()
│   │   ├── router.ts                 # Usage-type → provider/model routing
│   │   ├── types.ts                  # Request/response types
│   │   └── providers/
│   │       ├── openai.ts             # OpenAI implementation
│   │       └── google.ts             # Google (Gemini) implementation
│   ├── tools/                        # AI tool system (owned by ai-engineer)
│   │   ├── tool-registry.ts          # Tool definitions + execute functions
│   │   ├── execute-tool.ts           # Tool dispatch
│   │   ├── tool-validators.ts        # Zod parameter validation
│   │   ├── shape-tool-response.ts    # Normalize results for frontend
│   │   ├── generate-custom-recipe.ts # Recipe generation pipeline
│   │   ├── search-recipes.ts         # Hybrid search tool
│   │   ├── retrieve-cooked-recipes.ts # Past recipe retrieval
│   │   └── app-action.ts             # Pass-through tool for frontend-only actions
│   ├── rag/
│   │   └── hybrid-search.ts          # Semantic + lexical search engine
│   ├── auth.ts                       # Auth helpers
│   ├── cors.ts                       # CORS headers
│   ├── supabase-client.ts            # Client factory: createUserClient(), createServiceClient()
│   ├── logger.ts                     # Structured logging with request IDs
│   ├── context-builder.ts            # User profile + conversation history aggregation
│   ├── irmixy-schemas.ts             # Zod schemas: RecipeCard, GeneratedRecipe, IrmixyResponse
│   ├── locale-utils.ts               # Locale helpers: buildLocaleChain(), pickTranslation(), getBaseLanguage(), getLanguageName()
│   ├── system-prompt-builder.ts      # Irmixy personality + user context blocks (buildPersonalityBlock, buildUserContextBlock, buildVoiceInstructions, resolveVocabulary, buildVocabularyDirective)
│   ├── allergen-filter.ts            # Allergen detection
│   ├── food-safety.ts                # USDA safety validation
│   ├── ingredient-normalization.ts   # Fuzzy matching
│   ├── nutritional-utils.ts          # Nutrition formatting
│   ├── equipment-utils.ts            # Kitchen equipment helpers
│   └── recipe-validator.ts           # Recipe validation
├── irmixy-chat-orchestrator/         # Text chat — modular architecture
│   ├── index.ts                      # Entry point (serve, CORS, auth, SSE)
│   ├── types.ts                      # TypeScript interfaces
│   ├── logger.ts                     # Request-scoped logging
│   ├── session.ts                    # Session management
│   ├── system-prompt.ts              # Dynamic prompt builder
│   ├── ai-calls.ts                   # Gateway integration
│   ├── response-builder.ts           # Response formatting + DB persistence
│   ├── history.ts                    # Conversation history
│   ├── message-normalizer.ts         # Input sanitization
│   ├── recipe-intent.ts              # Intent detection heuristics
│   ├── meal-context.ts               # Meal type extraction
│   ├── modification.ts               # Recipe modification detection
│   ├── suggestions.ts                # Template suggestion chips
│   └── action-builder.ts             # Converts tool results to Action objects
├── irmixy-voice-orchestrator/        # Voice sessions (WebRTC, quota)
├── get-nutritional-facts/            # USDA API integration
├── parse-recipe-markdown/            # Recipe parsing
├── translate-content/                # Admin auto-translate: translates entity fields between locales via AI Gateway
├── backfill-embeddings/              # Vector embedding generation
└── send-delete-account-feedback/     # Account deletion handler
```

---

## Edge Function Template

Every new edge function follows this structure:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { validateAuth, hasRole, unauthorizedResponse, forbiddenResponse } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Auth — use shared validateAuth (extracts token and passes to getUser explicitly)
    const authHeader = req.headers.get('Authorization');
    const { user, error: authError } = await validateAuth(authHeader);
    if (authError || !user) {
      return unauthorizedResponse(authError ?? 'Authentication required', corsHeaders);
    }

    // 3. Admin check (if needed) — admin flag is in user_profiles.is_admin,
    //    NOT in app_metadata.role, so use hasRole() which reads app_metadata.
    //    For admin-only functions that need the DB-level is_admin() RPC instead,
    //    use createUserClient + supabase.rpc('is_admin') pattern.
    if (!hasRole(user, 'admin')) {
      return forbiddenResponse('Admin access required', corsHeaders);
    }

    // 4. Parse request
    const body = await req.json();

    // 5. Business logic
    // ...

    // 6. Response
    return new Response(
      JSON.stringify({ data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Never leak internal error details
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

> **Auth gotcha:** In Deno edge functions there is no stored session, so `supabase.auth.getUser()` without a token argument always fails. The shared `_shared/auth.ts` module handles this correctly by extracting the JWT from the Bearer header and passing it explicitly: `getUser(token)`. Always use `validateAuth()` instead of hand-rolling auth.
>
> **Admin check:** `hasRole(user, 'admin')` checks `app_metadata.role`. If your admin flag is in `user_profiles.is_admin` (checked via the `is_admin()` RPC), use `createUserClient(authHeader)` + `supabase.rpc('is_admin')` instead — but still validate the JWT with `validateAuth()` first.

---

## Locale & Translations

Edge Functions use `locale` (not `language`) throughout. The user's locale comes from `context-builder.ts`.

### locale-utils.ts — All Exported Functions

```typescript
import {
  buildLocaleChain,
  pickTranslation,
  getBaseLanguage,
  getLanguageName,
} from '../_shared/locale-utils.ts';
```

| Function | Signature | Purpose |
|----------|-----------|---------|
| `buildLocaleChain` | `(locale: string) => string[]` | Computes a within-family-only fallback chain. `"es-MX"` → `["es-MX", "es"]`, `"es"` → `["es"]`, `"en"` → `["en"]`, `"fr"` → `["fr"]`. No cross-language fallback — `es` and `en` are separate user groups. |
| `pickTranslation` | `<T extends { locale: string }>(translations: T[] \| null \| undefined, localeChain: string[]) => T \| undefined` | Picks the best translation from an array by walking the locale chain. Returns `undefined` if no chain match — callers must handle missing translations explicitly. |
| `getBaseLanguage` | `(locale: string) => string` | Strips the region code: `"es-MX"` → `"es"`, `"en"` → `"en"` |
| `getLanguageName` | `(locale: string) => string` | Returns a human-readable name: `"es"` → `"Mexican Spanish"`, `"es-ES"` → `"Spain Spanish"`, `"en"` → `"English"`. Tries the full locale first, then falls back to base language. |

### UserContext Interface

Defined in `_shared/irmixy-schemas.ts`. The locale fields populated by `context-builder.ts`:

```typescript
export interface UserContext {
  locale: string;          // Full locale code, e.g. 'es-MX', 'es-ES', 'en'
  localeChain: string[];   // Computed fallback chain, e.g. ['es-MX', 'es']
  language: 'en' | 'es';  // Derived UI language for i18n (base language only)
  measurementSystem: 'imperial' | 'metric';
  dietaryRestrictions: string[];
  ingredientDislikes: string[];
  skillLevel: string | null;
  householdSize: number | null;
  conversationHistory: Array<{ role: string; content: string; metadata?: any; toolSummary?: string }>;
  dietTypes: string[];          // MEDIUM constraint (vegan, keto, etc.)
  cuisinePreferences: string[]; // SOFT constraint (inspirational only)
  customAllergies: string[];
  kitchenEquipment: string[];
}
```

**Key patterns:**
- Wire contract uses `locale: string` in `IrmixyResponseSchema` and `GeneratedRecipeSchema`
- Recipe/ingredient queries join translation tables and use `pickTranslation()` for locale-aware selection
- System prompts use `getBaseLanguage()` to determine response language and vocabulary

### system-prompt-builder.ts — Shared Prompt Building Blocks

Both the chat and voice orchestrators import from `_shared/system-prompt-builder.ts` to share the same Irmixy personality and user-context formatting. Do not duplicate these blocks inline.

```typescript
import {
  buildPersonalityBlock,
  buildUserContextBlock,
  buildVoiceInstructions,
  resolveVocabulary,
  buildVocabularyDirective,
  REGIONAL_VOCABULARY,
} from '../_shared/system-prompt-builder.ts';
```

| Export | Purpose |
|--------|---------|
| `REGIONAL_VOCABULARY` | Vocabulary map keyed by locale (`"es"`, `"es-ES"`). English labels → region-specific culinary terms (tomato, corn, cream, etc.) |
| `resolveVocabulary(locale)` | Walks the locale chain within the same language family to find a vocabulary map. Returns `undefined` for locales with no mapping (e.g. `"en"`). Never crosses language boundaries. |
| `buildVocabularyDirective(locale)` | Formats a vocabulary instruction string for inclusion in a system prompt. Returns `""` when no vocabulary map exists for the locale. |
| `buildUserContextBlock(userContext)` | Formats the `<user_context>` XML block (locale, measurement system, dietary restrictions, diet types, allergies, equipment). |
| `buildPersonalityBlock(locale)` | Returns the full Irmixy identity and voice section in the correct language (Spanish for `es*`, English otherwise). Includes the vocabulary directive. |
| `buildVoiceInstructions(userContext)` | Assembles the complete voice system prompt: personality + user context + rules + tool usage instructions. Single source of truth for voice sessions. |

### translate-content Edge Function

Admin-only endpoint that translates recipe (or other entity) content fields between locales using the AI Gateway. Called by the admin panel's auto-translate feature.

```
POST /translate-content
Authorization: Bearer <admin-jwt>
Body: { fields, sourceLocale, targetLocales }
```

- Requires `is_admin()` RPC to return true — returns 403 otherwise
- `fields`: a flat `Record<string, string>` of field names to translated text
- `sourceLocale` / `targetLocales`: locale codes (e.g. `"es"`, `"es-ES"`)
- Translates to all `targetLocales` in parallel via `Promise.allSettled`; per-locale failures return `{ targetLocale, fields: {}, error: "Translation failed" }` instead of failing the whole request
- Uses `usageType: "parsing"` in the AI Gateway (cheap model, structured JSON output)
- Applies regional adaptation hints (e.g. Mexican → Spain Spanish vocabulary swaps) via `REGIONAL_ADAPTATION_HINTS` in `translate-content/utils.ts`

**Response shape:**
```typescript
{ translations: Array<{ targetLocale: string; fields: Record<string, string>; error?: string }> }
```

**Key utilities in `translate-content/utils.ts`:**

| Export | Purpose |
|--------|---------|
| `TranslateRequest` | Interface: `{ fields, sourceLocale, targetLocales }` |
| `TranslationResult` | Interface: `{ targetLocale, fields, error? }` |
| `REGIONAL_ADAPTATION_HINTS` | Vocabulary swap instructions keyed by `"sourceLocale>targetLocale"` (e.g. `"es>es-ES"`) |
| `validateRequest(body)` | Validates and types the raw request body; throws a message-only `Error` on invalid input (caught as 400) |
| `buildResponseSchema(fieldKeys)` | Builds a strict JSON schema for the AI response matching the input field names |

---

## SSE Streaming Pattern

For long-running operations (AI chat), use Server-Sent Events:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    const send = (event: string, data: unknown) => {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    };

    try {
      send('status', { status: 'thinking' });
      // ... do work ...
      send('content', { text: 'response text' });
      send('done', { /* final payload */ });
    } catch (error) {
      send('error', { message: 'Something went wrong' });
    } finally {
      controller.close();
    }
  }
});

return new Response(stream, {
  headers: {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

---

## Modular Architecture Pattern

For complex functions, follow the `irmixy-chat-orchestrator/` pattern — separate concerns into modules:

| Module | Responsibility |
|--------|---------------|
| `types.ts` | TypeScript interfaces and type definitions |
| `logger.ts` | Request-scoped structured logging |
| `session.ts` | Session management and ownership validation |
| `system-prompt.ts` | Dynamic prompt construction from user context |
| `ai-calls.ts` | AI Gateway integration (wraps `chat()`/`chatStream()`) |
| `response-builder.ts` | Response formatting, validation, and DB persistence |
| `history.ts` | Conversation history loading and saving |

Each module exports pure functions or small classes. The `index.ts` orchestrates them.

---

## Shared Utilities

### When to add to `_shared/`
- Logic used by 2+ edge functions
- Generic utilities (auth, CORS, logging, client factory)
- Schemas and types shared across functions

### When to keep local
- Logic specific to one function
- Function-internal types
- One-off helpers

---

## Error Handling

### Error hierarchy
- `ToolValidationError` — Invalid tool parameters (from `tool-validators.ts`)
- `SessionOwnershipError` — User doesn't own the session
- `ValidationError` — Zod schema validation failure

### Rules
- Never leak internal error details to the client
- Log full error details server-side with `console.error`
- Return generic messages: `"Something went wrong"`, `"Unauthorized"`, `"Invalid request"`
- Use appropriate HTTP status codes: 400 (bad input), 401 (no auth), 403 (forbidden), 500 (internal)

---

## Validation

Use Zod schemas from `irmixy-schemas.ts`:

```typescript
import { validateSchema, IrmixyResponseSchema } from '../_shared/irmixy-schemas.ts';

const validated = validateSchema(IrmixyResponseSchema, rawData);
// Throws ValidationError with detailed Zod issues on failure
```

---

## Deno Patterns

- **Imports:** Use URL imports or import maps defined in `deno.json`/`deno.jsonc`
- **Environment variables:** `Deno.env.get('VARIABLE_NAME')`
- **No `node_modules`:** Dependencies come from URLs or JSR
- **Type imports:** Use `import type { ... }` for type-only imports

---

## Migration Workflow (CRITICAL)

See `yyx-server/CLAUDE.md` for the full migration workflow. Key rules:

1. **ALWAYS** `npm run backup` before any migration
2. **NEVER** use MCP `apply_migration` tool — it causes history divergence
3. Create migrations with `npm run migration:new <name>`
4. Push with `npm run db:push`

---

## Deployment

```bash
npm run deploy <function-name>   # Single function
npm run deploy:all               # All functions
```

---

## Testing

Write Deno tests using `Deno.test`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std/assert/mod.ts";

Deno.test('validates input correctly', () => {
  const result = validateInput({ name: '' });
  assertEquals(result.valid, false);
});

Deno.test('rejects unauthorized requests', async () => {
  await assertRejects(
    () => handleRequest(mockRequest),
    Error,
    'Unauthorized'
  );
});
```

Mock helpers are in `_shared/test-helpers/mocks.ts`: `createMockRequest`, `createAuthenticatedRequest`, `mockEnv`, `cleanupEnv`, `createMockSupabaseClient`, `createMockFetch`.

Run: `deno task test` (unit), `deno task test:integration` (integration).
