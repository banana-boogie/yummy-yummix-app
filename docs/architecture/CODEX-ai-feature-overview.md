# CODEX YummyYummix AI Feature Overview

## Executive Summary
YummyYummix has two production AI user experiences: text chat and voice chat. Both are designed so the app UI stays simple while the backend handles orchestration, tool execution, safety checks, and persistence. Text uses Server-Sent Events (SSE) through `irmixy-chat-orchestrator`; voice uses OpenAI Realtime (WebRTC) plus backend-gated tool execution through `irmixy-voice-orchestrator`.  
Evidence: `yyx-app/app/(tabs)/chat/index.tsx:23`, `yyx-app/services/chatService.ts:52`, `yyx-app/hooks/useVoiceChat.ts:368`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:4`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:4`.

The core design intent is consistent structured output (`IrmixyResponse`) rather than ad-hoc text parsing, with shared tool infrastructure (`tool-registry`, `execute-tool`, `shape-tool-response`) used by both text and voice paths.  
Evidence: `yyx-server/supabase/functions/_shared/irmixy-schemas.ts:78`, `yyx-server/supabase/functions/_shared/tools/tool-registry.ts:1`, `yyx-server/supabase/functions/_shared/tools/execute-tool.ts:1`, `yyx-server/supabase/functions/_shared/tools/shape-tool-response.ts:1`.

## Scope and Non-Scope
### In Scope
- Text chat flow from UI action to streamed render and persisted chat history.
- Voice flow from session start to tool-call round trips and transcript/recipe rendering.
- Shared orchestration, tooling, schema validation, safety filters, and AI provider routing.

### Non-Scope
- Legacy `ai-chat` function (removed — superseded by `irmixy-chat-orchestrator`).
- Non-AI product modules not involved in AI request/response flow.
- Infrastructure setup docs (deployment/backup procedures), except where they explain runtime behavior.

## High-Level Architecture
```text
User
  |
  v
yyx-app (Expo React Native)
  |
  +-- ChatPage (text/voice toggle)
  |    |
  |    +-- Text path:
  |    |     ChatScreen -> chatService (SSE POST)
  |    |     -> yyx-server/irmixy-chat-orchestrator
  |    |        -> context-builder
  |    |        -> tool-registry -> execute-tool -> shape-tool-response
  |    |             -> search-recipes + hybrid-search
  |    |             -> generate-custom-recipe
  |    |             -> retrieve-custom-recipe
  |    |             -> allergen-filter + food-safety
  |    |        -> ai-gateway (router/providers) -> OpenAI Chat Completions
  |    |        -> Supabase DB:
  |    |             user_chat_sessions, user_chat_messages, cooking_sessions
  |    |
  |    +-- Voice path:
  |          VoiceChatScreen -> useVoiceChat -> OpenAIRealtimeProvider
  |             -> POST /irmixy-voice-orchestrator (start_session, execute_tool)
  |             |    -> context-builder
  |             |    -> execute-tool + shape-tool-response
  |             |    -> Supabase DB: ai_voice_sessions, ai_voice_usage
  |             |
  |             +-> WebRTC -> OpenAI Realtime API
  |                    (ephemeral token minted by voice orchestrator)
  |
  +-- Shared client schema/types: types/irmixy.ts

Shared data/services:
  - user_profiles + allergen_groups (personalization/safety context)
  - recipes + user_recipes* (search/custom recipe storage)
  - recipe_embeddings + match_recipe_embeddings RPC (hybrid semantic search)
```

### Architectural Intent
- The client talks to edge functions, not directly to normal chat-completions APIs.
- Text and voice reuse the same tool executor path, reducing logic drift.
- The system uses structured response contracts and schema validation before final responses are persisted/sent.
- The context layer centralizes personalization (language, measurement system, restrictions, history, resumable cooking session).

Evidence: `yyx-app/services/chatService.ts:196`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:537`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:577`, `yyx-server/supabase/functions/_shared/context-builder.ts:67`.

## End-to-End Lifecycle (step-by-step)
### A) Text Chat Lifecycle
1. User enters a message in `ChatScreen`; the UI creates a user message and placeholder assistant message.  
Evidence: `yyx-app/components/chat/ChatScreen.tsx:504`, `yyx-app/components/chat/ChatScreen.tsx:522`.
2. `ChatScreen` calls `streamChatMessageWithHandle(...)` from `chatService`.  
Evidence: `yyx-app/components/chat/ChatScreen.tsx:582`, `yyx-app/services/chatService.ts:255`.
3. `chatService` opens SSE via `react-native-sse` using POST to `.../irmixy-chat-orchestrator` with auth bearer token and body `{ message, sessionId, mode: "text", stream: true }`.  
Evidence: `yyx-app/services/chatService.ts:334`, `yyx-app/services/chatService.ts:338`, `yyx-app/services/chatService.ts:340`.
4. Backend validates JSON/input/auth/env, sanitizes content, and ensures/creates a chat session.  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:198`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:219`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:256`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:270`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:412`.
5. Orchestrator builds context (profile/preferences/history/resumable cooking session), then composes system prompt + messages.  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:349`, `yyx-server/supabase/functions/_shared/context-builder.ts:81`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:365`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:372`.
6. Orchestrator calls AI through `ai-gateway`, optionally forcing tool usage for high recipe intent.  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:949`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1535`, `yyx-server/supabase/functions/_shared/ai-gateway/index.ts:30`.
7. If AI emits tool calls, orchestrator executes tools through shared `executeTool` and shapes results (`recipes`, `customRecipe`, `safetyFlags`, retrieval payload).  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:462`, `yyx-server/supabase/functions/_shared/tools/execute-tool.ts:25`, `yyx-server/supabase/functions/_shared/tools/shape-tool-response.ts:13`.
8. Streaming path emits SSE events (`status`, `content`, `recipe_partial`, `stream_complete`, `done`).  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1145`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1304`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1400`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1452`.
9. Client routes SSE events in `routeSSEMessage` and updates UI state (`thinking/searching/generating/enriching`, text chunks, partial recipes, final response).  
Evidence: `yyx-app/services/chatService.ts:99`, `yyx-app/services/chatService.ts:132`, `yyx-app/components/chat/ChatScreen.tsx:611`, `yyx-app/components/chat/ChatScreen.tsx:625`, `yyx-app/components/chat/ChatScreen.tsx:658`.
10. Final response is schema-validated (`IrmixyResponseSchema`) and persisted to chat history, including structured data in `tool_calls`.  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:557`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:577`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1869`.
11. Chat UI reconciles final text + cards atomically and renders optional quick actions (e.g., resume cooking).  
Evidence: `yyx-app/components/chat/ChatScreen.tsx:688`, `yyx-app/components/chat/ChatScreen.tsx:728`, `yyx-app/components/chat/ChatScreen.tsx:1023`.
12. User can load past sessions/history; assistant metadata is reconstructed from `tool_calls` for cards/suggestions/actions.  
Evidence: `yyx-app/services/chatService.ts:461`, `yyx-app/services/chatService.ts:505`, `yyx-app/components/chat/ChatSessionsMenu.tsx:82`.

### B) Voice Lifecycle
1. User switches to voice mode in `ChatPage`; `VoiceChatScreen` drives `useVoiceChat`.  
Evidence: `yyx-app/app/(tabs)/chat/index.tsx:75`, `yyx-app/components/chat/VoiceChatScreen.tsx:58`.
2. `useVoiceChat` creates `OpenAIRealtimeProvider`, attaches status/transcript/tool listeners, then initializes provider.  
Evidence: `yyx-app/hooks/useVoiceChat.ts:171`, `yyx-app/hooks/useVoiceChat.ts:181`, `yyx-app/hooks/useVoiceChat.ts:257`, `yyx-app/hooks/useVoiceChat.ts:295`.
3. Provider requests `start_session` from backend voice orchestrator to get quota info + ephemeral token + session record.  
Evidence: `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:117`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:5`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:82`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:171`.
4. Provider establishes WebRTC session directly with OpenAI Realtime API using ephemeral token (not long-lived API key).  
Evidence: `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:143`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:148`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:129`.
5. Provider sends `session.update` with instructions + tool schemas; OpenAI can issue function calls over data channel events.  
Evidence: `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:205`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:220`, `yyx-app/services/voice/shared/VoiceToolDefinitions.ts:8`.
6. Function-call argument deltas are accumulated client-side; when done, `toolCall` is emitted to `useVoiceChat`.  
Evidence: `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:463`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:473`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:485`.
7. `useVoiceChat` executes the tool on backend (`action: "execute_tool"`), then sends tool result back to OpenAI (`function_call_output`) so assistant continues speaking.  
Evidence: `yyx-app/hooks/useVoiceChat.ts:368`, `yyx-app/hooks/useVoiceChat.ts:383`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:299`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:310`.
8. Voice orchestrator validates action/tool whitelist/payload/auth, builds context, executes shared tool stack, returns shaped result.  
Evidence: `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:18`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:20`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:228`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:252`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:272`.
9. Transcript deltas and completion events update transcript UI and recipe cards in `VoiceChatScreen`.  
Evidence: `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:494`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:507`, `yyx-app/hooks/useVoiceChat.ts:200`, `yyx-app/components/chat/VoiceChatScreen.tsx:171`.
10. On stop, provider updates `ai_voice_sessions` with duration/token breakdown/cost for usage tracking.  
Evidence: `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:236`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:567`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:605`.

### Sequence Diagram (Text Streaming + Tool Path)
```text
Actors:
  U  = User
  CS = ChatScreen
  C  = chatService
  O  = irmixy-chat-orchestrator
  G  = ai-gateway/OpenAI
  T  = Shared Tools
  DB = Supabase DB

1) U  -> CS : Send message
2) CS -> C  : streamChatMessageWithHandle(message, sessionId)
3) C  -> O  : POST SSE (auth, stream=true)
4) O  -> O  : Validate + auth + sanitize + ensureSessionId
5) O  -> DB : Load user context + history
6) O  -> C  : SSE status=thinking
7) O  -> G  : callAI(messages, tools, toolChoice)
8) If AI returns tool call:
     8.1) O -> C  : SSE status=searching/generating
     8.2) O -> T  : executeTool(...)
     8.3) T -> DB : Query/compute (recipes/custom recipe/safety)
     8.4) T -> O  : shaped result
     8.5) If custom recipe:
           O -> C : SSE recipe_partial
           O -> C : SSE status=enriching
     8.6) O -> G  : callAIStream(grounded messages)
   Else:
     8.x) O -> G  : callAIStream(messages)
9)  O  -> C  : SSE content chunks
10) O  -> C  : SSE stream_complete
11) O  -> O  : finalizeResponse + schema validation
12) O  -> DB : save user+assistant messages (tool_calls metadata)
13) O  -> C  : SSE done(response)
14) C  -> CS : onComplete(response)
15) CS -> U  : Render text + cards + suggestions/actions
```

## Client Implementation (`yyx-app`)
### 1) Chat Entry and Mode Management
- `ChatPage` owns mode (`text`/`voice`), shared `sessionId`, text messages, and voice transcript messages. This preserves context while switching modes.  
Evidence: `yyx-app/app/(tabs)/chat/index.tsx:23`, `yyx-app/app/(tabs)/chat/index.tsx:24`, `yyx-app/app/(tabs)/chat/index.tsx:26`, `yyx-app/app/(tabs)/chat/index.tsx:28`.

### 2) Text Network Layer (`chatService`)
- Sends authenticated requests to edge function endpoint from env-configured functions URL.
- Uses SSE POST streaming with retries (`MAX_RETRIES = 3`), exponential backoff, and 60s timeout.
- Routes typed SSE events to callbacks through `routeSSEMessage`.

Evidence: `yyx-app/services/chatService.ts:47`, `yyx-app/services/chatService.ts:52`, `yyx-app/services/chatService.ts:42`, `yyx-app/services/chatService.ts:44`, `yyx-app/services/chatService.ts:282`, `yyx-app/services/chatService.ts:306`, `yyx-app/services/chatService.ts:357`, `yyx-app/services/chatService.ts:99`.

### 3) Text UI State and Rendering (`ChatScreen`)
- Optimizes streaming render with chunk batching (`CHUNK_BATCH_MS = 50`) and scroll throttling.
- Shows status-driven skeleton and enables input as soon as `stream_complete` arrives.
- Performs atomic final assistant update in `onComplete` so recipe card + final text stay consistent.
- Supports quick actions, including `resume_cooking` payload routing.

Evidence: `yyx-app/components/chat/ChatScreen.tsx:49`, `yyx-app/components/chat/ChatScreen.tsx:596`, `yyx-app/components/chat/ChatScreen.tsx:616`, `yyx-app/components/chat/ChatScreen.tsx:688`, `yyx-app/components/chat/ChatScreen.tsx:1023`.

### 4) Voice Client Stack (`useVoiceChat` + Provider)
- `useVoiceChat` translates provider events into chat-like transcript messages and handles backend tool execution.
- `OpenAIRealtimeProvider` handles WebRTC setup, OpenAI Realtime session negotiation, function-call event parsing, and tool-result handoff.
- Voice tool schemas are declared in app (`voiceTools`) and mirrored to server-side registry constraints.

Evidence: `yyx-app/hooks/useVoiceChat.ts:39`, `yyx-app/hooks/useVoiceChat.ts:257`, `yyx-app/hooks/useVoiceChat.ts:368`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:46`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:143`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:383`, `yyx-app/services/voice/shared/VoiceToolDefinitions.ts:8`.

### 5) Session/History and Save-to-Cook Integration
- Session menu loads recent sessions + history from Supabase.
- History loader reconstructs assistant structured data from `tool_calls`.
- Generated recipes can be persisted to normalized user recipe tables before navigating to cooking flow.

Evidence: `yyx-app/components/chat/ChatSessionsMenu.tsx:11`, `yyx-app/services/chatService.ts:531`, `yyx-app/services/chatService.ts:505`, `yyx-app/services/customRecipeService.ts:72`, `yyx-app/services/customRecipeService.ts:87`, `yyx-app/services/customRecipeService.ts:123`, `yyx-app/services/customRecipeService.ts:149`.

## Server/Edge Function Implementation (`yyx-server`)
### 1) `irmixy-chat-orchestrator` (Text + shared voice mode logic)
- Single entrypoint handles request parsing, auth, session ownership/creation, and stream vs non-stream path selection.
- Context and prompt are built per request; prompt embeds language, measurement system, restrictions, equipment, and security/tool rules.
- AI call flow supports tool loops, high-intent forced tool use, modification heuristics, no-result deterministic fallback, and response finalization.
- SSE path emits status/content/partial/done events for progressive rendering.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:176`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:245`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:412`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:349`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1616`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:949`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:776`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:715`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1126`.

### 2) `irmixy-voice-orchestrator` (Voice control plane)
- Supports only two actions: `start_session` and `execute_tool`.
- Enforces auth, payload size cap (10KB), action validation, and tool allowlist.
- `start_session` performs monthly quota check (30 min), fetches OpenAI ephemeral realtime token, and inserts an `ai_voice_sessions` row.
- `execute_tool` reuses shared context + tool execution + shaped response.

Evidence: `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:19`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:20`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:313`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:21`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:96`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:129`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:171`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:250`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:259`.

### 3) Shared Server Building Blocks
- `context-builder`: profile/preferences/history sanitation + resumable session lookup.
- `ai-gateway`: provider/model routing by usage type (`text`, `parsing`, `embedding`, etc.) with environment overrides.
- `tool-registry` and `execute-tool`: authoritative set of AI tools used across text and voice.

Evidence: `yyx-server/supabase/functions/_shared/context-builder.ts:81`, `yyx-server/supabase/functions/_shared/context-builder.ts:172`, `yyx-server/supabase/functions/_shared/ai-gateway/router.ts:14`, `yyx-server/supabase/functions/_shared/ai-gateway/router.ts:57`, `yyx-server/supabase/functions/_shared/tools/tool-registry.ts:44`, `yyx-server/supabase/functions/_shared/tools/execute-tool.ts:25`.

## AI Orchestration and Prompting Strategy
### System Prompting
- System prompt is assembled dynamically with user context and explicit rules:
  - language/measurement consistency
  - dietary/allergy constraints
  - mandatory tool usage for recipe creation/search
  - prompt-injection resistance guidance
- Voice mode adds additional short-response instructions.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1616`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1673`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1687`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1755`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1821`.

### Tool Selection and Forcing
- The orchestrator can force tool usage (`toolChoice: "required"`) when high recipe intent is detected.
- Tool definitions come from centralized registry; same tool names are allowlisted in voice orchestrator.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:950`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1280`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1545`, `yyx-server/supabase/functions/_shared/tools/tool-registry.ts:44`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:18`.

### Recipe Modification Strategy
- Instead of always invoking an extra model pass, recipe modification intent is first detected with regex heuristics for speed.
- If a prior custom recipe exists and modification intent is detected, recipe regeneration is directly triggered with preserved equipment context.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:765`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:830`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:866`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:875`.

### Response Strategy
- Custom recipe completions use a fixed short confirmation message.
- No-result search uses deterministic fallback message/suggestions.
- Normal suggestion chips are template-generated to avoid extra AI latency in streaming.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:548`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:715`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:672`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1403`.

## Data Contracts and Payload Shapes
### 1) Canonical AI Response (`IrmixyResponse`)
Server validates final payload with Zod schema; client mirrors these types.

```ts
type IrmixyResponse = {
  version: "1.0";
  message: string;
  language: "en" | "es";
  status?: "thinking" | "searching" | "generating" | null;
  recipes?: RecipeCard[];
  customRecipe?: GeneratedRecipe;
  suggestions?: SuggestionChip[];
  actions?: QuickAction[];
  safetyFlags?: SafetyFlags;
};
```

Evidence: `yyx-server/supabase/functions/_shared/irmixy-schemas.ts:78`, `yyx-server/supabase/functions/_shared/irmixy-schemas.ts:156`, `yyx-app/types/irmixy.ts:68`.

### 2) Text Streaming Event Contract (SSE)
```json
{ "type": "session", "sessionId": "..." }
{ "type": "status", "status": "thinking|searching|generating|enriching" }
{ "type": "content", "content": "token-or-chunk" }
{ "type": "recipe_partial", "recipe": { "...": "partial GeneratedRecipe" } }
{ "type": "stream_complete" }
{ "type": "done", "response": { "...": "IrmixyResponse" } }
{ "type": "error", "error": "..." }
```

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1152`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1305`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1400`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1452`, `yyx-app/services/chatService.ts:109`.

### 3) Voice Orchestrator Request Contract
```json
// Start session
{ "action": "start_session" }

// Execute tool
{
  "action": "execute_tool",
  "toolName": "search_recipes|generate_custom_recipe|retrieve_custom_recipe",
  "toolArgs": { "...": "tool-specific args" },
  "sessionId": "optional-chat-session-id"
}
```

Evidence: `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:19`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:207`, `yyx-app/hooks/useVoiceChat.ts:383`.

### 4) Tool Surface
- Registered tools: `search_recipes`, `generate_custom_recipe`, `retrieve_custom_recipe`.
- All three are marked `allowedInVoice: true`.

Evidence: `yyx-server/supabase/functions/_shared/tools/tool-registry.ts:45`, `yyx-server/supabase/functions/_shared/tools/tool-registry.ts:65`, `yyx-server/supabase/functions/_shared/tools/tool-registry.ts:94`, `yyx-server/supabase/functions/_shared/tools/tool-registry.ts:131`.

### 5) Persistence Shape for Chat History
- Assistant structured payloads (recipes/customRecipe/suggestions/safetyFlags) are persisted in `user_chat_messages.tool_calls`.
- History loader rehydrates those into client `ChatMessage` fields.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1869`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1888`, `yyx-app/services/chatService.ts:482`, `yyx-app/services/chatService.ts:505`.

## Error Handling and Recovery
### Client-Side
- Max message length enforced at 2000 chars.
- SSE timeout (60s), connection retry with exponential backoff, and cancel handle for cleanup.
- UI shows user-friendly error text while preserving partial assistant content if available.

Evidence: `yyx-app/services/chatService.ts:42`, `yyx-app/services/chatService.ts:183`, `yyx-app/services/chatService.ts:357`, `yyx-app/services/chatService.ts:425`, `yyx-app/components/chat/ChatScreen.tsx:833`.

### Server-Side
- Request validation errors return structured HTTP errors (`400/401/403/500`) without leaking internal details.
- Tool argument validation uses `ToolValidationError`.
- Voice orchestrator returns `429` on quota exceeded.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:219`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:329`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:337`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:99`, `yyx-server/supabase/functions/_shared/tools/tool-validators.ts`.

### Tool/AI Fallback Behavior
- Recipe search hybrid path degrades gracefully to lexical search on embedding failure.
- No-result/low-confidence branches return deterministic fallback instead of hallucinating.

Evidence: `yyx-server/supabase/functions/_shared/tools/search-recipes.ts:121`, `yyx-server/supabase/functions/_shared/rag/hybrid-search.ts:271`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1338`.

## Security/Privacy Considerations
1. **Auth and ownership checks**
- Chat/voice endpoints require bearer auth and verify user ownership of session resources.
- RLS policies restrict access to user-specific chat/voice tables.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:239`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:419`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:295`, `yyx-server/supabase/migrations/20260202180538_fix_rls_performance.sql:122`, `yyx-server/supabase/migrations/20260202180538_fix_rls_performance.sql:133`, `yyx-server/supabase/migrations/20260202180538_fix_rls_performance.sql:162`.

2. **Prompt injection resistance**
- Incoming content is sanitized before model use.
- System prompt explicitly states user text is data, not instructions.

Evidence: `yyx-server/supabase/functions/_shared/context-builder.ts:19`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:270`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1755`.

3. **Tool execution hardening**
- Voice path uses allowlisted tool names.
- Shared executor validates/JSON-parses args and rejects unknown tools.

Evidence: `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:18`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:228`, `yyx-server/supabase/functions/_shared/tools/execute-tool.ts:35`, `yyx-server/supabase/functions/_shared/tools/execute-tool.ts:41`.

4. **Least-exposure API key strategy**
- Voice clients receive ephemeral token from backend; backend holds long-lived OpenAI key.
- Text and tool calls run server-side via gateway/provider modules.

Evidence: `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:119`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:158`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:148`, `yyx-server/supabase/functions/_shared/ai-gateway/index.ts:35`.

5. **Allergen fail-safe behavior**
- If allergen map fails to load, restricted users get no recipes / ingredient checks fail closed.

Evidence: `yyx-server/supabase/functions/_shared/allergen-filter.ts:122`, `yyx-server/supabase/functions/_shared/allergen-filter.ts:193`.

## Performance and Cost Considerations
1. **Streaming UX and perceived latency**
- Text path streams tokens and emits `recipe_partial` before enrichment to render cards early.
- Chat UI batches chunks (`CHUNK_BATCH_MS = 50`) to reduce re-render pressure.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1303`, `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts:175`, `yyx-app/components/chat/ChatScreen.tsx:49`, `yyx-app/components/chat/ChatScreen.tsx:596`.

2. **Avoiding unnecessary model calls**
- Template suggestions avoid a separate post-response LLM request in many streaming paths.
- No-result fallback is deterministic.

Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:670`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1403`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:715`.

3. **Hybrid search efficiency**
- Embeddings are cached in-memory with TTL; semantic search uses vector RPC and falls back when needed.

Evidence: `yyx-server/supabase/functions/_shared/rag/hybrid-search.ts:18`, `yyx-server/supabase/functions/_shared/rag/hybrid-search.ts:22`, `yyx-server/supabase/functions/_shared/rag/hybrid-search.ts:136`, `yyx-server/supabase/functions/_shared/rag/hybrid-search.ts:271`.

4. **Context window control**
- Conversation history is bounded (`MAX_HISTORY_MESSAGES = 10`).

Evidence: `yyx-server/supabase/functions/_shared/context-builder.ts:11`, `yyx-server/supabase/functions/_shared/context-builder.ts:181`.

5. **Voice quota and cost accounting**
- Monthly voice quota enforced server-side (30 minutes).
- Session token usage and per-token pricing are tracked and stored.

Evidence: `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:21`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:99`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:521`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:592`, `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:605`.

## Design Tradeoffs and Rationale
| Decision | Why this design | Tradeoff | Evidence |
|---|---|---|---|
| Use one main text orchestrator | Centralizes auth/context/tool loop/stream behavior in one place | File is large and cognitively heavy | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1` |
| Use structured response schema (`IrmixyResponse`) | Reliable UI rendering without parsing freeform text | Requires schema maintenance on both client/server | `yyx-server/supabase/functions/_shared/irmixy-schemas.ts:78`, `yyx-app/types/irmixy.ts:68` |
| Force tool usage on high recipe intent | Reduces non-actionable chat when user clearly wants search/generation | Risk of over-triggering tool calls on ambiguous requests | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:949`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:961` |
| Two-phase recipe streaming | Better perceived speed (card appears before full enrichment) | More client merge logic (`partial` + final) | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1304`, `yyx-app/components/chat/ChatScreen.tsx:625` |
| Deterministic fallback/template suggestions | Lowers latency and cost | Less adaptive than model-generated chips | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:670`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:715` |
| Voice tool execution via backend | Keeps tool authorization and data access server-side | Adds one network hop from client to edge function | `yyx-app/hooks/useVoiceChat.ts:368`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:207` |
| Hybrid semantic + lexical search | Improves retrieval relevance while preserving graceful degradation | More moving pieces (embeddings table, RPC, fallback paths) | `yyx-server/supabase/functions/_shared/tools/search-recipes.ts:121`, `yyx-server/supabase/functions/_shared/rag/hybrid-search.ts:252`, `yyx-server/supabase/migrations/20260207010001_create_recipe_embeddings.sql:35` |
| Fail-safe allergen behavior | Prioritizes safety when allergen system is unavailable | May over-block results during outages | `yyx-server/supabase/functions/_shared/allergen-filter.ts:122`, `yyx-server/supabase/functions/_shared/allergen-filter.ts:193` |

## Glossary
- **SSE (Server-Sent Events)**: HTTP stream where server pushes incremental events to client (`status`, `content`, `done`).
- **Tool call**: Model requests a named backend function (e.g., `search_recipes`) with structured arguments.
- **Orchestrator**: Edge function that coordinates auth, context, model calls, tool execution, and response shaping.
- **RLS (Row Level Security)**: Database policy layer restricting row access by authenticated user.
- **Hybrid search**: Combined vector semantic similarity + lexical matching + metadata/personalization scoring.
- **Ephemeral token**: Short-lived token minted server-side for client connection to OpenAI Realtime.
- **Fail closed / fail safe**: On safety-system uncertainty, return fewer/no results rather than unsafe results.
- **Perceived latency**: How fast the app feels to user (often improved by partial/progressive rendering).

## FAQ for New Engineers
### 1) Where does text chat actually start?
At `ChatScreen.handleSendMessage`, which calls `streamChatMessageWithHandle` in `chatService`, then opens SSE to `irmixy-chat-orchestrator`.  
Evidence: `yyx-app/components/chat/ChatScreen.tsx:504`, `yyx-app/components/chat/ChatScreen.tsx:582`, `yyx-app/services/chatService.ts:334`.

### 2) Where is the canonical response schema?
Server: `_shared/irmixy-schemas.ts`; client mirror: `types/irmixy.ts`.  
Evidence: `yyx-server/supabase/functions/_shared/irmixy-schemas.ts:78`, `yyx-app/types/irmixy.ts:68`.

### 3) How are tools shared between text and voice?
Both paths go through shared registry/executor/shaping modules.  
Evidence: `yyx-server/supabase/functions/_shared/tools/tool-registry.ts:1`, `yyx-server/supabase/functions/_shared/tools/execute-tool.ts:1`, `yyx-server/supabase/functions/_shared/tools/shape-tool-response.ts:1`.

### 4) How do we prevent users from seeing each other's sessions?
Session ownership checks in function code + RLS policies on chat/voice tables.  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:419`, `yyx-server/supabase/migrations/20260202180538_fix_rls_performance.sql:122`, `yyx-server/supabase/migrations/20260202180538_fix_rls_performance.sql:133`.

### 5) Where is prompt injection handled?
Input sanitation in `context-builder` and explicit security instructions in orchestrator system prompt.  
Evidence: `yyx-server/supabase/functions/_shared/context-builder.ts:19`, `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1755`.

### 6) Why does recipe generation sometimes show card before final text?
Because backend emits `recipe_partial` during two-phase generation, and client renders that immediately.  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:1304`, `yyx-app/components/chat/ChatScreen.tsx:625`.

### 7) Where does voice quota enforcement happen?
Server-side in `irmixy-voice-orchestrator` `handleStartSession`.  
Evidence: `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:82`, `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts:99`.

### 8) How do we resume cooking from AI responses?
Backend can emit `resume_cooking` action; client validates payload and routes to proper cooking guide path.  
Evidence: `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:746`, `yyx-app/components/chat/ChatScreen.tsx:1023`.

## Evidence Appendix
| Claim | File Path | Function/Symbol | Line Ref (if available) | Confidence |
|---|---|---|---|---|
| Chat defaults to voice mode | `yyx-app/app/(tabs)/chat/index.tsx` | `ChatPage` state init | 23 | High |
| Text chat hits orchestrator URL | `yyx-app/services/chatService.ts` | `IRMIXY_CHAT_ORCHESTRATOR_URL`, `fetch` | 52, 196 | High |
| SSE event routing contract | `yyx-app/services/chatService.ts` | `routeSSEMessage` | 99 | High |
| Text stream retries with backoff | `yyx-app/services/chatService.ts` | `streamChatMessageWithHandle` retry loop | 282, 306, 425 | High |
| Chat UI does atomic final merge | `yyx-app/components/chat/ChatScreen.tsx` | `onComplete` update block | 688 | High |
| Chat UI supports `resume_cooking` action payload | `yyx-app/components/chat/ChatScreen.tsx` | `handleActionPress` | 1023 | High |
| History loader rehydrates `tool_calls` | `yyx-app/services/chatService.ts` | `loadChatHistory` | 482, 505 | High |
| Voice hook executes tools on backend | `yyx-app/hooks/useVoiceChat.ts` | `executeToolOnBackend` | 368 | High |
| Voice provider requests ephemeral token via edge function | `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts` | `initialize` backend call | 117 | High |
| Voice provider connects to OpenAI Realtime using ephemeral token | `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts` | realtime fetch | 143, 148 | High |
| Voice provider sends tool output back to Realtime session | `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts` | `sendToolResult` | 299 | High |
| Voice session cost persisted to `ai_voice_sessions` | `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts` | `updateSessionDuration` | 605 | High |
| Orchestrator validates auth from bearer token | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | main handler auth | 239, 256 | High |
| Orchestrator sanitizes inbound message | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `sanitizeContent` usage | 270 | High |
| Orchestrator creates session title from first message | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `generateSessionTitle`, `ensureSessionId` | 388, 412 | High |
| Context includes profile/history/resumable session | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `buildRequestContext` | 349 | High |
| Tool execution uses shared executor + shaper | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `executeToolCalls` | 462 | High |
| Final response schema validated before return/persist | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `finalizeResponse` | 577 | High |
| Assistant structured metadata saved in `tool_calls` | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `saveMessageToHistory` | 1869, 1888 | High |
| High recipe intent can force tool usage | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `hasHighRecipeIntent` branch | 949, 961 | High |
| Streaming path supports partial recipe event | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `onPartialRecipe` send | 1304 | High |
| Template suggestions used to avoid extra AI call | `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts` | `getTemplateSuggestions` usage | 1403 | High |
| Voice endpoint enforces action allowlist | `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts` | `ALLOWED_ACTIONS` validation | 19, 350 | High |
| Voice endpoint enforces payload size limit | `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts` | `MAX_PAYLOAD_BYTES` check | 20, 313 | High |
| Voice quota = 30 minutes/month | `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts` | `QUOTA_LIMIT_MINUTES` | 21 | High |
| Shared registry lists text+voice tools | `yyx-server/supabase/functions/_shared/tools/tool-registry.ts` | `TOOL_REGISTRY`, `allowedInVoice` | 44, 54, 74, 103 | High |
| Context builder sanitizes text + caps history to 10 | `yyx-server/supabase/functions/_shared/context-builder.ts` | `sanitizeContent`, `MAX_HISTORY_MESSAGES` | 11, 19 | High |
| Allergen filter fails safe on empty map | `yyx-server/supabase/functions/_shared/allergen-filter.ts` | `filterByAllergens`, `checkIngredientForAllergens` | 122, 193 | High |
| AI gateway routes usage types to models/providers | `yyx-server/supabase/functions/_shared/ai-gateway/router.ts` | `defaultRoutingConfig`, `getProviderConfig` | 14, 56 | High |
| OpenAI chat calls support tool_choice and json_schema | `yyx-server/supabase/functions/_shared/ai-gateway/providers/openai.ts` | `callOpenAI` request assembly | 103, 115, 126 | High |
| Vector search table + RPC restricted to service role | `yyx-server/supabase/migrations/20260207010001_create_recipe_embeddings.sql` | table/policy/RPC grants | 9, 27, 35, 59 | High |
| RLS policies protect chat and voice user tables | `yyx-server/supabase/migrations/20260202180538_fix_rls_performance.sql` | policy definitions | 122, 133, 162, 177 | High |
| Cooking resume persistence model exists with 24h stale logic | `yyx-server/supabase/migrations/20260207010002_create_cooking_sessions.sql` | table + `mark_stale_cooking_sessions` | 5, 41 | High |
| **Inference**: Text client does not directly call OpenAI chat APIs | `yyx-app/services/chatService.ts` | only edge-function URL is used | 52, 196 | Medium |
| **Inference**: Voice direct OpenAI access is constrained via ephemeral token minting backend-side | `yyx-server/supabase/functions/irmixy-voice-orchestrator/index.ts` + `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts` | token mint + token use | 129, 158, 148 | Medium |

## Open Questions / Validation Needed
1. Base DDL provenance for some legacy AI tables is not present in this repo snapshot.
- `yyx-server/supabase/migrations/20260116234443_remote_schema.sql` is empty, so original `CREATE TABLE` statements for `user_chat_sessions`, `user_chat_messages`, `ai_voice_sessions`, and `ai_voice_usage` are not directly visible here.
- Next validation step: inspect Supabase cloud schema (table definitions + triggers + constraints) and capture exact DDL snapshot for documentation completeness.

2. Legacy `ai-chat` function has been removed. All text chat traffic routes through `irmixy-chat-orchestrator`.

3. Exact trigger chain for voice usage rollups should be verified against live DB.
- Migrations include `update_ai_voice_usage` function updates, but trigger definitions are not in the inspected subset.
- Next validation step: query `pg_trigger`/`pg_proc` in cloud DB to confirm active trigger bindings and rollup behavior.
