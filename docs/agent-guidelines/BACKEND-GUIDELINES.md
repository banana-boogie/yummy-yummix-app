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
│   │   └── providers/openai.ts       # OpenAI implementation
│   ├── tools/                        # AI tool system (owned by ai-engineer)
│   │   ├── tool-registry.ts          # Tool definitions + execute functions
│   │   ├── execute-tool.ts           # Tool dispatch
│   │   ├── tool-validators.ts        # Zod parameter validation
│   │   ├── shape-tool-response.ts    # Normalize results for frontend
│   │   ├── generate-custom-recipe.ts # Recipe generation pipeline
│   │   ├── search-recipes.ts         # Hybrid search tool
│   │   └── retrieve-custom-recipe.ts # Past recipe retrieval
│   ├── rag/
│   │   └── hybrid-search.ts          # Semantic + lexical search engine
│   ├── auth.ts                       # Auth helpers
│   ├── cors.ts                       # CORS headers
│   ├── supabase-client.ts            # Client factory: createUserClient(), createServiceClient()
│   ├── logger.ts                     # Structured logging with request IDs
│   ├── context-builder.ts            # User profile + conversation history aggregation
│   ├── irmixy-schemas.ts             # Zod schemas: RecipeCard, GeneratedRecipe, IrmixyResponse
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
│   └── suggestions.ts                # Template suggestion chips
├── irmixy-voice-orchestrator/        # Voice sessions (WebRTC, quota)
├── get-nutritional-facts/            # USDA API integration
├── parse-recipe-markdown/            # Recipe parsing
├── backfill-embeddings/              # Vector embedding generation
└── send-delete-account-feedback/     # Account deletion handler
```

---

## Edge Function Template

Every new edge function follows this structure:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req: Request) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createUserClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request
    const body = await req.json();

    // 4. Business logic
    // ...

    // 5. Response
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
