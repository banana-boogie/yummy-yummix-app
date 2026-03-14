## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native + Expo |
| Styling | NativeWind (Tailwind for RN) |
| Backend | Supabase (Auth, DB, Storage, Edge Functions) |
| Routing | Expo Router (file-based in `app/`) |
| Edge Functions | Deno + TypeScript |

## AI Architecture

### AI Gateway (`yyx-server/supabase/functions/_shared/ai-gateway/`)

**All AI interactions must go through the AI Gateway.** Never call OpenAI, Anthropic, or other providers directly.

#### Why Use the Gateway?
- **Provider Independence** - Switch models/providers via env vars without code changes
- **Usage-Based Routing** - Different models for different tasks (`text`, `recipe_generation`, `parsing`)
- **Cost Optimization** - Use cheaper models and lower reasoning effort for simple tasks
- **Consistent Interface** - Same API for all providers
- **Structured Output** - JSON schema validation built-in
- **Streaming Support** - SSE streaming with `chatStream()`

#### How to Use:

```typescript
import { chat, chatStream } from '../_shared/ai-gateway/index.ts';

// For structured output (always use JSON schema):
const response = await chat({
  usageType: 'text',  // or 'recipe_generation', 'recipe_modification', 'parsing', 'embedding'
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello!' },
  ],
  reasoningEffort: 'low',
  responseFormat: {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['label', 'message'],
          },
        },
      },
      required: ['message', 'suggestions'],
    },
  },
});

// For streaming (chatStream returns AIStreamResult — access .stream):
const result = await chatStream({
  usageType: 'text',
  messages: [...],
  reasoningEffort: 'low',
});
for await (const chunk of result.stream) {
  console.log(chunk);
}
// Optionally await usage/cost after the stream completes:
const { inputTokens, outputTokens, costUsd } = await result.usage();
```

#### Usage Types:

| Type | Default Model | Provider | Use Case | Cost |
|------|--------------|----------|----------|------|
| `text` | grok-4-1-fast-non-reasoning | xai | Chat orchestrator (tool calling + streaming) | Low |
| `recipe_generation` | gpt-4.1 | openai | Recipe generation (structured JSON output) — quality critical | Medium |
| `recipe_modification` | gpt-4.1 | openai | Recipe modification (transform existing recipe JSON) | Medium |
| `parsing` | gpt-4.1-nano | openai | Admin parsing, nutritional data extraction | Very low |
| `embedding` | text-embedding-3-large | openai | Vector search (3072 dimensions) | Low |

#### Configuration:

```bash
# Required API Keys (in .env or Supabase secrets)
XAI_API_KEY=xai-...               # For text (orchestrator)
OPENAI_API_KEY=sk-proj-xxx        # For recipe_generation, recipe_modification, parsing, embedding
# GEMINI_API_KEY and ANTHROPIC_API_KEY needed only if overriding defaults to those providers

# Optional: Override default models (supports provider:model or model-only format)
AI_TEXT_MODEL=openai:gpt-4.1-mini             # Switch provider + model
AI_RECIPE_GENERATION_MODEL=google:gemini-2.5-flash  # Switch to Google
AI_RECIPE_MODIFICATION_MODEL=xai:grok-4-1-fast-non-reasoning  # Switch provider
AI_PARSING_MODEL=gpt-4.1-mini                 # Same provider, different model
AI_EMBEDDING_MODEL=text-embedding-3-small     # Same provider, different model
```

#### Design Pattern:

The gateway uses **OpenAI's format as the universal interface** (same pattern as Vercel AI SDK and LangChain). Each provider translates from this common format to their specific API:

```
Developer Code -> Gateway (OpenAI format) -> Provider (translates to native format) -> AI Service
```

This design:
- Uses OpenAI format because it's the industry standard
- Each provider handles translation (implemented for OpenAI, xAI, Google Gemini, and Anthropic)
- Adding new providers just requires a new translator in `providers/<name>.ts`
- NOT OpenAI-specific - it's using OpenAI format as the **lingua franca**

**When adding new providers:** Implement translation logic in `ai-gateway/providers/<provider>.ts`. The gateway interface stays the same.

#### Thermomix-First Design

When generating recipes for users with Thermomix equipment:
- The system prompt automatically includes Thermomix instructions
- AI generates `thermomixTime`, `thermomixTemp`, and `thermomixSpeed` parameters
- Validation ensures parameters are within valid ranges
- Frontend displays Thermomix cooking parameters in step-by-step guide

See `generate-custom-recipe.ts` for Thermomix system prompt section.

## Architecture

### Mobile App (`yyx-app/`)
- **`app/`** - Expo Router screens (file-based routing). DO NOT put components or types here.
- **`components/`** - Reusable UI components. Use subdirectories with `index.ts` exports.
- **`components/common/`** - Core shared components (Text, Button, etc.)
- **`components/layouts/`** - PageLayout, ResponsiveLayout
- **`contexts/`** - React contexts (Auth, Language, Measurement, UserProfile, Onboarding)
- **`services/`** - API/data services for Supabase interactions
- **`hooks/`** - Custom React hooks
- **`types/`** - TypeScript definitions (recipe.types.ts, recipe.api.types.ts, user.ts)
- **`constants/design-tokens.js`** - All colors, spacing, typography, border radius
- **`i18n/index.ts`** - Translations for `en` and `es`

### Edge Functions (`yyx-server/supabase/functions/`)
- **`_shared/`** - Shared utilities (CORS, auth, AI gateway)
- **`irmixy-chat-orchestrator/`**, **`irmixy-voice-orchestrator/`** - AI endpoints
- **`get-nutritional-facts/`**, **`parse-recipe-markdown/`** - Recipe utilities

### Platform-Specific Providers

For features that are only available on certain platforms (e.g., native features), use Metro's `.web.ts` file extension pattern:

**Pattern:**
- `services/feature/FeatureFactory.ts` - Native implementation (iOS/Android)
- `services/feature/FeatureFactory.web.ts` - Web implementation (stub or alternative)

**How it works:**
- Metro automatically selects the `.web.ts` file when building for web
- Native platforms continue using the standard `.ts` file
- No runtime overhead - resolution happens at build time
- Zero dynamic imports or conditional logic needed

**Example: Voice Chat**
```
services/voice/
├── VoiceProviderFactory.ts      <- Native (iOS/Android) returns OpenAIRealtimeProvider
├── VoiceProviderFactory.web.ts  <- Web returns WebVoiceProvider stub
├── providers/
│   ├── OpenAIRealtimeProvider.ts  <- Uses react-native-webrtc
│   └── WebVoiceProvider.ts        <- Stub with clear error messaging
└── types.ts                       <- Shared interface (used by both)
```

**Why this approach:**
- No native package imports on web (prevents build crashes)
- Type-safe - both implementations must match the interface
- Clear file structure - obvious which platform uses what
- Industry standard - same pattern used by Expo and React Native core
- Future-proof - easy to upgrade web stub to real implementation later

**When to use:**
- Native-only features (WebRTC, native APIs, native packages)
- Platform-specific performance optimizations
- Different implementations per platform

**UI considerations:**
- UI layer stays platform-agnostic (uses the interface)
- Platform-specific UI (show/hide features) uses `Platform.OS !== 'web'`
- See `app/(tabs)/chat/index.tsx` for example
