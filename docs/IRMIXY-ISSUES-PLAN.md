# Irmixy Issues — Prioritized Fix Plan

## Context

Multiple issues surfaced from real usage of Irmixy (text chat, voice chat, cooking guide). This plan organizes issues into priority tiers with specific file-level fixes. The goal is to ship the most impactful fixes first, grouped by deploy target (backend vs frontend).

---

## Phase 1: Quick Wins

**Done when**: Session menu shows 10 sessions, emoji fix is live, equipment icons are image-ready.

### 1A. Chat Session History Limit (5 → 10)
- **File**: `yyx-app/services/chatService.ts:584`
- **Change**: `.limit(5)` → `.limit(10)`

### 1B. Deploy Emoji Fix (already coded)
- System prompt already updated in `system-prompt-builder.ts:151,177`
- **Command**: `cd yyx-server && npm run deploy irmixy-chat-orchestrator`

### 1C. Equipment Icons — Make Swappable
- Currently emoji in `yyx-app/constants/equipment.ts:13,19`
- **Change**: Switch from emoji `Text` to `Image` component with `require()` paths
- **Steps**:
  1. Create `yyx-app/assets/images/equipment/` directory
  2. Ship simple temporary placeholder PNGs (generic appliance icons) so `require()` paths resolve at build time. User replaces with branded assets later.
  3. Update `equipment.ts`: `icon: require('@/assets/images/equipment/thermomix.png')`
  4. Update `EquipmentStep.tsx:132-134,202`: Replace `<Text>` with `<Image>` (follow `dietaryIcons.ts` pattern)
- **Icon spec**: 200x200 PNG with transparency. Drop replacements into `yyx-app/assets/images/equipment/`.

### 1 — Verify
- Open chat sessions menu → 10 sessions visible
- Send chat message → no unprompted emojis
- Open onboarding equipment step → placeholder images render without crash

---

## Phase 2: Thermomix Reference & Prompt Updates

**Done when**: Reference doc covers TM5/TM6/TM7 + cutter disc/Cutter+, system prompt has accurate Thermomix knowledge, temperature types are model-specific, measurements are kitchen-friendly.

### 2A. Update THERMOMIX-REFERENCE.md
- **File**: `docs/references/THERMOMIX-REFERENCE.md`
- **Changes**:
  1. Rename title from "TM6/TM5 Cooking Reference" → "Thermomix Cooking Reference (TM5 / TM6 / TM7)"
  2. Add **TM7-specific section** covering:
     - Open Cooking mode (no lid, up to 100°C — ideal for stir-fries, reductions, meatballs)
     - Manual browning available in both guided and manual modes
     - Improved fermentation (yogurt, cheese, dough proofing)
     - Lid behavior: doesn't lock until speed 2, blade auto-stops when lid lifted
     - 10-inch touchscreen, quieter motor
     - Temperature range extended to 160°C (manual mode, not just Guided Cooking like TM6)
  3. Add **Cutter Disc / Cutter+ section**:
     - **Cutter disc (TM5/TM6 only)**: Slicing and grating accessory. Place in lid, feed food through hopper. Speed 4 only. Thin slices (1-2mm), thick slices (4-5mm), thin grating (2mm), thick grating (4mm). Max 28oz per batch. NOT compatible with TM7.
     - **Cutter+ (TM7 only)**: Upgraded version with spiralizing. Same speed 4 operation. NOT backwards-compatible with TM5/TM6.
     - **Suitable foods**: Firm vegetables (carrots, zucchini, onions, potatoes), firm fruits (tomatoes, avocado, mango), cured meats (salami). NOT for frozen food, soft cooked ingredients, or fresh sausages.
     - **Maintenance**: Beta-carotene foods (carrots) stain — rub with vegetable oil to remove.
  4. Add **Model comparison table**:

     | Feature | TM5 | TM6 | TM7 |
     |---------|-----|-----|-----|
     | Timer max | 99 min | 12 hours | 12 hours |
     | Temp max (manual) | 120°C | 120°C | 160°C |
     | High-temp browning | No | Guided only | Manual + Guided |
     | Open Cooking | No | No | Yes (up to 100°C) |
     | Cutter disc | Yes | Yes | No (use Cutter+) |
     | Cutter+ | No | No | Yes |
     | Butterfly whisk | Yes | Yes | Yes |
     | Sous vide | No | Yes | Yes (40-85°C) |
     | Fermentation mode | No | No | Yes |

  5. Update "Steps That Should NOT Use Thermomix" to note: "Large-batch browning (small surface area) — recommend a regular pan/skillet for searing > 250g. The Thermomix can brown in small batches in a pinch, but a hot pan gives better Maillard reaction."
  6. Add sources from TM7 research (official Vorwerk, Thermojo, etc.)

### 2B. Make Temperature Ranges Model-Specific
- **File**: `yyx-app/types/thermomix.types.ts`
- **Current state**: Single flat `VALID_TEMPERATURES.CELSIUS` list maxing at 120°C. The app knows the user's model (stored as `"thermomix_TM6"` in `kitchen_equipment`) but doesn't use it for temperature validation.
- **Changes**:
  1. Restructure `VALID_TEMPERATURES` to be model-aware:
     - **TM5/TM6**: 37–120°C + Varoma (unchanged)
     - **TM7**: 37–160°C + Varoma (add 125, 130, 135, 140, 145, 150, 155, 160)
  2. Add helper: `getValidTemperatures(model: 'TM5' | 'TM6' | 'TM7')` that returns the correct range
  3. Keep a `VALID_TEMPERATURES_ALL` union for contexts where model is unknown (backwards-compatible)
- **File**: `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts`
  - Update `hasThermomix()` or add `getThermomixModel()` helper to extract the specific model from `kitchen_equipment` array (parse `"thermomix_TM6"` → `"TM6"`)
  - Pass model to system prompt so AI knows the user's temperature limits
  - Update validation to accept temps up to 160°C for TM7 users

### 2C. Update System Prompt Thermomix Section
- **File**: `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts:615-662`
- **Changes**: Consolidate Thermomix section into a single "THERMOMIX REFERENCE" block:
  1. **Model-specific context**: "User has a Thermomix {MODEL}. Temperature range: {range}." (dynamic based on parsed model)
  2. **Cutter disc info**: "CUTTER DISC (disco de corte): For slicing/grating vegetables into uniform pieces. TM5/TM6: use Cutter disc at speed 4. TM7: use Cutter+ at speed 4. Always mention when a step requires slicing (e.g., 'Insert cutter disc. Slice cucumbers through hopper at speed 4.'). Max 28oz per batch. Only for firm vegetables/fruits."
  3. **Searing guidance**: "Browning/searing max 250g per batch in Thermomix. For larger quantities, recommend searing outside in a regular pan/skillet (faster, better Maillard reaction) OR split into small Thermomix batches. If user specifically requests Thermomix-only, use small batches at Varoma temperature."
  4. **TM7 Open Cooking** (only for TM7 users): "Open Cooking mode available — cook without lid up to 100°C for stir-fries, reductions, and delicate items."
  5. **Capacity**: "Bowl capacity: 2.2L total, 1.5L for hot liquids."

### 2D. Recipe Measurement Quality
- **File**: `generate-custom-recipe.ts:717`
- **Change**: After "Use practical quantities", add: "Kitchen-friendly minimums: salt (min 1/4 tsp), spices/seeds (min 1/2 tsp), herbs (min 1 tbsp). Never output sub-gram quantities like '1g sesame seeds'. For small amounts use teaspoons/tablespoons."

### 2 — Deploy & Verify
- **Command**: `cd yyx-server && npm run deploy irmixy-chat-orchestrator`
- Generate recipe with small quantities → no sub-gram ingredients
- Generate recipe requiring slicing → cutter disc mentioned with correct model variant
- Ask for brisket recipe with 4kg meat → recommends searing in pan or batches
- Generate recipe for TM7 user → Open Cooking mentioned where appropriate, temps up to 160°C allowed
- Generate recipe for TM5 user → temps capped at 120°C

---

## Phase 3: Streaming Tool Call Filter (deploy separately — medium risk)

**Done when**: Tool calls never appear in streamed text. Legitimate text containing `{` or `<` is not suppressed.

### 3A. Tool Output Leaking to User — CRITICAL
- **Root cause**: `index.ts:696` sends each token to client via SSE in real-time. `stripToolCallText()` at line 736 only cleans `finalText` for DB persistence — user already saw the leaked tokens.
- **Files**:
  - `yyx-server/supabase/functions/irmixy-chat-orchestrator/tool-call-text.ts` — add streaming filter
  - `yyx-server/supabase/functions/irmixy-chat-orchestrator/index.ts:688-700` — wrap `onToken` callback

#### Implementation Details

**Trigger-based buffering** (zero latency for normal text):
- Normal tokens pass through immediately with no buffering
- Enter buffering mode only when a trigger character is detected: `\n` followed by tool-name chars, or `<` (XML tag), or `{` at start of a chunk
- While buffering: accumulate tokens, check if buffer matches start of any tool-call pattern
- Patterns: `<tool_calls>`, `\ncall:tool_name{`, `tool_name{`, `{"recipeDescription":`, `{"suggestedName":`
- If buffer grows past ~100 chars without matching: flush entire buffer to client (false positive)
- If complete pattern match: suppress the entire matched content
- **On stream end with partial match**: Flush buffer to client (incomplete match = not a tool call)
- **On abort (`signal.aborted`)**: Discard buffer

**Relationship to existing retry logic**: Defense-in-depth. Keep `detectTextToolCall()` retry as primary fix. Streaming filter catches partial leaks.

**Rollback**: Add env var `DISABLE_STREAMING_FILTER`. When set, bypass buffer and forward tokens directly.

### 3 — Deploy & Verify
- **Command**: `cd yyx-server && npm run deploy irmixy-chat-orchestrator`
- Send 10 messages triggering tool calls → zero raw JSON in streamed output
- Send messages containing `{`, `<`, curly braces in normal text → NOT suppressed
- Test with `DISABLE_STREAMING_FILTER=true` → tokens pass through unfiltered

---

## Phase 4: Image Placeholder Fixes (frontend batch)

**Done when**: No broken/blank images anywhere in the custom recipe flow. Every image component shows a placeholder on null URL or load failure.

### 4A. Create `SafeImage` Component
- **File**: New `yyx-app/components/common/SafeImage.tsx`
- **Purpose**: Shared wrapper around expo-image `Image` with built-in null/error/placeholder handling. Eliminates duplicating fallback pattern across 10 components.
- **API**:
  ```tsx
  <SafeImage
    source={pictureUrl}           // string | { uri: string } | require() | null
    placeholder="ingredient"      // "ingredient" | "kitchenTool" | "recipe" → maps to PLACEHOLDER_IMAGES
    className="w-[80px] h-[80px]"
    contentFit="contain"
  />
  ```
- **Behavior**: If `source` is null/undefined → show placeholder. If image load fails (`onError`) → show placeholder. Handles both `string` and `{ uri: string }` source formats.

### 4B. Add Kitchen Tool Placeholder
- **File**: `yyx-app/constants/placeholders.ts`
- **Change**: Add `PLACEHOLDER_IMAGES.kitchenTool` — create `kitchen-tool-placeholder.png` asset (simple utensil icon)
- Note: Ingredient placeholder already exists (`ingredient-placeholder.png`)

### 4C. Replace Image Usage in 10 Components

Swap raw `<Image>` for `<SafeImage>` in each, adapting to each component's existing source format:

| Component | File | Placeholder |
|-----------|------|-------------|
| MiseEnPlaceIngredient | `cooking-guide/MiseEnPlaceIngredient.tsx:61-67` | `ingredient` |
| MiseEnPlaceKitchenTool | `cooking-guide/MiseEnPlaceKitchenTool.tsx:64-70` | `kitchenTool` |
| RecipeKitchenTools | `recipe-detail/RecipeKitchenTools.tsx:27-33` | `kitchenTool` |
| RecipeStepContent | `cooking-guide/RecipeStepContent.tsx:65-71` | `ingredient` |
| CookingGuideHeader | `cooking-guide/CookingGuideHeader.tsx:69-75` | `recipe` |
| CustomRecipeCard (tools) | `chat/CustomRecipeCard.tsx:428-434` | `kitchenTool` |
| CustomRecipeCard (ingredients) | `chat/CustomRecipeCard.tsx:317-324` | `ingredient` |
| ChatRecipeCard | `chat/ChatRecipeCard.tsx:72-80` | `recipe` |
| AdminRecipeIngredientCard | `admin/.../AdminRecipeIngredientCard.tsx:46-50` | `ingredient` |
| AdminRecipeKitchenToolCard | `admin/.../AdminRecipeKitchenToolCard.tsx:46-52` | `kitchenTool` |

### 4 — Verify
- Generate custom recipe with missing ingredient/tool images → placeholders render
- Navigate to cooking guide for custom recipe → no blank images on any step
- Admin recipe form with missing images → placeholder icons shown

---

## Phase 5: Kitchen Tool Selection Quality

**Done when**: Custom recipes have relevant, deduplicated kitchen tools that match the recipe's actual needs. No inappropriate or duplicate tools.

### 5A. Improve `getRelevantKitchenTools()`
- **File**: `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts:1067-1206`
- **Current state**: Purely deterministic keyword scorer. Queries 50 tools from DB, scores by keyword matches against recipe text, returns top 4. The LLM generates the recipe but has zero input on tool selection.
- **Changes**:
  1. **Hybrid LLM + DB approach**:
     - Add `suggestedTools` field to the recipe generation schema so the LLM can suggest tool names (e.g., `["whisk", "cutting board", "Varoma"]`) as part of recipe output
     - Fuzzy-match LLM suggestions against DB tool names/translations to get real entries (with images, IDs, translations)
     - Keep keyword scorer as fallback for tools the LLM missed but the recipe clearly needs
     - Final list = LLM-matched tools (primary) + keyword-scored gap-fills (secondary)
  2. **Deduplicate results** — deduplicate by tool ID before returning (safety net)
  3. **Tighten keyword mappings** — review the hardcoded keyword→tool mappings (lines 1126-1147) for false positive triggers
  4. **Keep cap reasonable** — current `.slice(0, 4)` is fine. Could raise to ~10 as upper bound but 4 is practical for UI.
  5. **Enrich with images** — ensure matched tools always carry their `image_url` from the DB. If a tool has no image, still include it but `SafeImage` will handle the fallback.

### 5 — Verify
- Generate 5 different custom recipes → each has relevant tools, no duplicates, no odd matches
- Tools have images where available, placeholders where not
- LLM suggestions are validated against DB (no hallucinated tools)

---

## Phase 6: Frontend Medium Fixes

**Done when**: Chat input recovers from hung connections. Voice session survives recipe generation. Voice usage doesn't count generation wait time.

### 6A. Chat Input Stuck Disabled
- **File**: `yyx-app/hooks/chat/useMessageStreaming.ts`
- **Root cause**: If SSE connection hangs (no error, no events), `isLoading` stays true forever
- **Fix**: Add `useEffect` watching `isLoading` — when true, start 60-second timeout. If still true after timeout, force reset `isLoading`, `isStreaming`, `currentStatus`

### 6B. Voice Stops Prematurely
- **File**: `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:45, 581-584`
- **Note**: Search for `"response.audio.done"` case in the file (originally referenced lines 666-671 but those are `response.audio.delta`).
- **Root cause**: 10-second `InactivityTimer` fires during recipe generation
- **Fix** (event-driven, not longer timeout):
  1. Add `pause()`/`resume()` to `InactivityTimer` (`VoiceUtils.ts:33-59`)
  2. Pause timer when tool execution starts (line 581)
  3. Resume timer only AFTER `response.audio.done` fires (Irmixy finishes speaking)
  4. Timeout only starts counting when Irmixy is actually done speaking
- **Telemetry**: Log `response.audio.done` timestamps to voice sessions for debugging future cutoff reports

### 6C. Voice Usage Overcounting During Recipe Generation
- **File**: `yyx-app/services/voice/providers/OpenAIRealtimeProvider.ts:509-514, 759-781`
- **Root cause**: `sessionStartTime` uses wall-clock time including tool execution pauses
- **Fix**: Track `audioActiveTime` separately:
  - Start on `speech_started` / `response.audio.delta`
  - Stop on `speech_stopped` / `response.audio.done`
  - Use for token estimation fallback instead of total elapsed time
  - Send `audioActiveTime` to backend on session end for reconciliation

### 6 — Verify
- 6A: Simulate hung connection (airplane mode mid-stream) → input re-enables after 60s
- 6B: Voice session + recipe generation (15+ seconds) → session stays alive, ends ~10s after Irmixy stops speaking
- 6C: Voice session with recipe generation → usage reflects actual audio time, not wait time

---

## Phase 7: Chat-to-Cooking-Guide Navigation

**Done when**: User can ask Irmixy a question from any cooking step and return to the exact step. Lupita can do this without help.

### 7A. Seamless Irmixy ↔ Cooking Guide Navigation
- **Key requirement**: Must be intuitive for Lupita (55+, tech-challenged). No hidden gestures or self-discovery.
- **Files**:
  - `yyx-app/app/(tabs)/recipes/[id]/cooking-guide/[step].tsx:37-42` — finish handler
  - Cooking guide layout/header components
- **State persistence**: Create a new `CookingSessionContext` (following existing Context pattern — no external libraries). Holds `{ recipeId, recipeName, currentStep, sessionId }`. Persists across tab navigation since Expo Router may remount tab screens. Cooking guide writes to this context on mount/step change; chat reads from it to show return banner.
- **Changes**:
  1. **"Ask Irmixy" button in cooking guide** — Persistent, visible on every step. Not floating/hidden. Labeled clearly. Navigates to `/(tabs)/chat` preserving the active session.
  2. **Return to cooking from chat** — Banner/card in chat reads from `CookingSessionContext`: "You're cooking [recipe name] — tap to go back to step 3."
  3. **Finish handler** — When cooking guide completes from a chat flow, offer choice: "Back to Irmixy" or "Done" (not just redirect to recipes tab)
  4. Context cleared when user finishes cooking or explicitly dismisses
- **i18n keys** (add to both `en` and `es`):
  - `cookingGuide.askIrmixy` — "Ask Irmixy" / "Preguntale a Irmixy"
  - `chat.returnToCooking` — "You're cooking {recipeName} — tap to go back" / "Estas cocinando {recipeName} — toca para volver"
  - `cookingGuide.finishBackToIrmixy` — "Back to Irmixy" / "Volver a Irmixy"
  - `cookingGuide.finishDone` — "Done" / "Listo"

### 7 — Verify
- Start cooking from chat-generated recipe → "Ask Irmixy" button visible on every step
- Tap it → chat opens with return banner showing recipe name + step number
- Tap return banner → returns to exact cooking step
- Finish cooking → offered "Back to Irmixy" or "Done"

---

## Phase 8: Recipe Search Status Animation

**Done when**: `searching` status shows a prominent centered animation. `cooking_it_up` unchanged.

- **Change**: When status is `searching` ONLY (not `cooking_it_up`), show a prominent centered animation (pulsing search icon or Lottie) overlaid on chat
- **File**: Chat status display component (wherever `currentStatus` renders)
- `cooking_it_up` keeps its current subtle indicator

### 8 — Verify
- Trigger recipe search → centered animation appears prominently
- Trigger recipe generation → NO centered animation, existing subtle indicator only

---

## Phase 9: Budget Limit UX

**Done when**: Grace buffer silently extends limits, analytics track limit hits, settings show usage, Irmixy warns warmly at 80%.

9A+9B (backend) can be built in parallel with 9C+9D (frontend).

### 9A. Grace Buffer ("Finish What You Started")
- **File**: `yyx-server/supabase/functions/_shared/ai-budget/index.ts`
- **DB migration**: `npm run backup && npm run migration:new add_grace_buffer_pct` — add `grace_buffer_pct` column to `ai_membership_tiers` (default 0.10)
- **Change**: In `_computeTextBudgetResult`, change allowed check to `usedUsd < limits.monthlyTextBudgetUsd * (1 + graceBufferPct)`
- Grace is silent — user doesn't know it exists

### 9B. Internal Alerting
- **File**: Budget check functions in `ai-budget/`
- **Change**: Log `budget_limit_reached` analytics event when `allowed: false` (user_id, tier, usage, timestamp)
- Dashboard query: "How many users hit their limit this month?"

### 9C. Usage Visibility in Settings
- **File**: New section in settings/profile screen
- **Change**: "Irmixy Usage: 75% used this month" with progress bar
- Fetch from `ai_budget_usage` table

### 9D. Proactive Irmixy Warning at 80%
- Instead of system `Alert.alert()`, have Irmixy herself say it warmly in chat
- **File**: `ChatScreen.tsx:127-134` (replace alert with chat message insertion)

### 9E. Upgrade Path (requires payment infra — future)
- Free tier exceeded → show upgrade prompt with Irmixy voice
- Requires RevenueCat/Stripe setup

### 9F. Contact Channel at Limit
- Simple: "Need more? Let us know" → WhatsApp link (natural for Mexico market)
- Or mailto link as MVP

### 9 — Verify
- 9A: Set free tier user to 95% usage → send 3 more messages → they go through (grace). Hard block at ~110%.
- 9B: Check analytics for `budget_limit_reached` event after limit hit
- 9C: Open settings → usage progress bar shows correct percentage
- 9D: Reach 80% → Irmixy says warm message in chat (no system alert)

---

## Phase 10: Additional Feature Work

### 10A. Timer for "Let Sit" Steps in Cooking Guide
- Detect rest keywords ("let sit", "rest", "dejar reposar", "marinar") + extract time
- Show countdown timer button in step UI
- Optional notification when done

### 10B. Difficulty as Ranking Signal (Not Filter)
- Difficulty should WEIGHT search results, not exclude recipes
- Modify search scoring to incorporate difficulty as soft signal based on user profile

---

## Not In Scope

- **Allergen groups → frontend**: Intentionally hardcoded (Feb 2026 decision). Frontend uses 6 stable categories with TypeScript type safety; backend uses DB-driven ingredient matching with 80+ entries. Well-designed split. No change needed.
- **Non-cooking topic guardrails**: Already implemented — voice and chat prompts both have identical SECURITY blocks and topic redirect rules.

---

## Execution Order

| Step | Items | Target | Effort |
|------|-------|--------|--------|
| 1 | 1A-1C | Frontend quick wins | 1 hour |
| 2 | 2A-2D | Thermomix reference + model-specific temps + prompt fixes (deploy) | 2-3 hours |
| 3 | 3A | Streaming filter (deploy separately) | 2-3 hours |
| 4 | 4A-4C | SafeImage + image placeholders (10 components) | 2 hours |
| 5 | 5A | Kitchen tool selection quality (hybrid LLM + DB) | 2-3 hours |
| 6 | 6A-6C | Voice + input fixes | 3-4 hours |
| 7 | 7A | Chat ↔ cooking guide navigation | 4-6 hours |
| 8 | 8 | Search animation | 1-2 hours |
| 9 | 9A-9F | Budget UX (9A+9B || 9C+9D) | 2-3 days |
| 10 | 10A-10B | Timer + difficulty ranking | 1 day |

## Verification

Phase-specific verification is listed after each phase above. Additionally, after each phase:
- `cd yyx-app && npm run test:ci` — frontend tests
- `cd yyx-server && deno task test` — backend tests
- Manual QA: full chat → recipe → cooking guide flow
- Backend deploy: `cd yyx-server && npm run deploy irmixy-chat-orchestrator`
