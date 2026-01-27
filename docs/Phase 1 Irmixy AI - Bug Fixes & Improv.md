# Phase 1 Irmixy AI - Bug Fixes & Improvements Plan

## Summary

Fixes for 2 bugs, UX improvements for text chat, context awareness issues, and user-requested TODOs found during manual testing.

---

## Sprint 1: Quick Wins (< 2 hours)

### 1.1 Fix Missing Translation Keys for Language Buttons
**Bug:** Settings page shows raw keys instead of "English"/"Spanish"

**Root Cause:** `SystemButtons.tsx` uses `i18n.t('settings.english')` but the key exists at `common.english`

**Fix:** Update references in SystemButtons.tsx
- Line 62: `i18n.t('settings.english')` → `i18n.t('common.english')`
- Line 67: `i18n.t('settings.spanish')` → `i18n.t('common.spanish')`

**File:** `yyx-app/components/settings/SystemButtons.tsx`

---

### 1.2 Fix Chat Suggestions Not Updating on Language Change
**Bug:** When switching languages, suggestion chips stay in old language until switching voice↔text

**Root Cause:** `useMemo` has empty dependency array `[]` - never recomputes

**Fix:** Add language dependency
```tsx
import { useLanguage } from '@/contexts/LanguageContext';
const { language } = useLanguage();

const initialSuggestions = useMemo(() => [...], [language]);
```

**File:** `yyx-app/components/chat/ChatScreen.tsx`

---

### 1.3 Add Thinking Indicator with Irmixy Avatar
**Issue:** Long pause with no visual feedback while waiting for AI response

**Fix:** Add IrmixyAvatar with thinking state when `isLoading=true`
- Import IrmixyAvatar component
- Add thinking indicator after messages when loading
- Add `chat.thinking` translation key to i18n

**File:** `yyx-app/components/chat/ChatScreen.tsx`, `yyx-app/i18n/index.ts`

---

### 1.4 Add Brevity Instructions to ai-chat System Prompt
**Issue:** Text responses are too verbose/long

**Fix:** Add to both EN and ES system prompts:
```
Response Style:
- Keep responses concise (2-4 sentences for simple questions)
- Use bullet points for lists instead of paragraphs
- Only elaborate when asked for details
```

**File:** `yyx-server/supabase/functions/ai-chat/index.ts`

---

### 1.5 Add Irmixy to Mise-en-Place Useful Items
**Issue:** Missing voice assistant button in useful items screen

**Fix:** Add `<VoiceAssistantButton />` component to screen

**File:** `yyx-app/app/(tabs)/recipes/[id]/cooking-guide/mise-en-place-useful-items.tsx`

---

## Sprint 2: UX Polish (1-2 days)

### 2.1 Add Markdown Rendering for AI Responses
**Issue:** Markdown formatting (bold, lists, etc.) shows as raw text

**Fix:**
1. Install: `npm install react-native-markdown-display`
2. Apply markdown styling to assistant messages only
3. Style to match app design tokens

**Files:**
- `yyx-app/package.json`
- `yyx-app/components/chat/ChatScreen.tsx`

---

### 2.2 Fix Auto-Scroll on AI Response
**Issue:** Chat doesn't auto-scroll when AI responds

**Current:** Uses `scrollToEnd` on `messages.length` change, but may not work with streaming

**Fix:** Scroll on each streaming chunk, not just message count change

**File:** `yyx-app/components/chat/ChatScreen.tsx`

---

### 2.3 Move Irmixy Icon to Top-Right in Cooking Guide
**Issue:** Button overlaps navigation "Next" button

**Fix:** Add `position="top-right"` option to VoiceAssistantButton, update cooking guide

**Files:**
- `yyx-app/components/common/VoiceAssistantButton.tsx`
- `yyx-app/app/(tabs)/recipes/[id]/cooking-guide/[step].tsx`

---

### 2.4 Rename Chat Tables to ai_ Namespace
**Issue:** Tables named `user_chat_*` should be `ai_chat_*`

**user_chat_sessions purpose:** Groups messages by conversation session. Has `title` (for future session list), `user_id` (ownership), timestamps. Used to maintain conversation context.

**Fix:** Create migration + update all references

**Files:**
- New migration: `supabase migration new rename_chat_tables_to_ai`
- `yyx-server/supabase/functions/ai-chat/index.ts`
- `yyx-server/supabase/functions/ai-orchestrator/index.ts`
- `yyx-server/supabase/functions/_shared/context-builder.ts`
- `yyx-app/services/chatService.ts`

---

### 2.5 Update IrmixyAvatar Component to Use Correct Images
**Issue:** Verify IrmixyAvatar.tsx is using the correct avatar images from the assets folder

**Status:** Avatar images already exist in `yyx-app/assets/images/irmixy-avatar/`

**Fix:** Review IrmixyAvatar.tsx to ensure it maps to correct images for each state (idle, listening, thinking, speaking)

---

## Sprint 3: Architecture (3-5 days)

### 3.1 Fix Text Streaming in React Native
**Issue:** Response appears all at once instead of word-by-word streaming

**Root Cause:** `response.body.getReader()` unavailable in RN, fallback reads entire response first

**Options:**
- **A (recommended):** Use `react-native-sse` library for proper SSE
- **B:** EventSource polyfill
- **C:** WebSocket transport

**Files:**
- `yyx-app/services/chatService.ts`
- `yyx-app/package.json`

---

### 3.2 Enhance Context Builder - AI Doesn't Know User Data
**Issue:** AI says "I don't have access to your recipes/allergies"

**Currently Fetched:**
- language, dietary_restrictions, measurement_system
- skill_level, household_size, ingredient_dislikes
- conversation history (10 messages)

**Missing (should fetch):**
- `other_allergy` from user_profiles (custom allergies)
- `diet_types` from user_profiles
- User's saved recipes count/names (from user_saved_recipes)
- `kitchen_equipment` from user_context

**Note:** AI needs to re-fetch context on EACH request (not just session start) to pick up profile changes made mid-conversation.

**Files:**
- `yyx-server/supabase/functions/_shared/context-builder.ts`
- `yyx-server/supabase/functions/_shared/irmixy-schemas.ts`

---

### 3.3 Dynamic Suggestion Chips Based on Conversation
**Issue:** Suggestions are static, don't adapt to chat context

**Fix Options:**
- **A:** Extend ai-chat to return suggestions (like ai-orchestrator)
- **B:** Switch ChatScreen to use ai-orchestrator endpoint

**Files:**
- `yyx-server/supabase/functions/ai-chat/index.ts`
- `yyx-app/services/chatService.ts`
- `yyx-app/components/chat/ChatScreen.tsx`

---

### 3.4 Chat History / Resume Conversation
**Issue:** No way to see or resume previous conversations

**Fix:**
1. On chat screen mount, check for recent session (last 24h)
2. Show "Resume last conversation?" prompt if exists
3. Load previous messages if user chooses to resume

**Files:**
- `yyx-app/components/chat/ChatScreen.tsx`
- `yyx-app/services/chatService.ts`

---

### 3.5 Create Admin AI Usage Dashboard
**Issue:** No visibility into AI token usage

**Fix:** Create admin page showing:
- Total tokens used per day/week/month
- Top users by token consumption
- Average tokens per conversation
- Cost estimates

Data source: `user_chat_messages.input_tokens` and `output_tokens`

**Files:**
- New: `yyx-app/app/(tabs)/admin/ai-usage.tsx`
- New: `yyx-app/services/admin/aiUsageService.ts`

---

## Critical Files

| File | Changes |
|------|---------|
| `yyx-app/components/settings/SystemButtons.tsx` | Fix translation keys |
| `yyx-app/components/chat/ChatScreen.tsx` | Language reactivity, thinking indicator, markdown, scroll |
| `yyx-app/i18n/index.ts` | Add chat.thinking key |
| `yyx-server/supabase/functions/ai-chat/index.ts` | Brevity prompt, suggestions |
| `yyx-server/supabase/functions/_shared/context-builder.ts` | Fetch more user data |
| `yyx-app/services/chatService.ts` | SSE streaming fix, table rename |

---

## Verification

After implementation:

1. **Translation bug:** Settings shows "English"/"Spanish" or "Inglés"/"Español"
2. **Language reactivity:** Change language → suggestion chips update immediately (no mode switch needed)
3. **Thinking indicator:** Send message → see Irmixy avatar thinking animation
4. **Brevity:** AI responses are 2-4 sentences, not paragraphs
5. **Markdown:** Bold text, lists render properly
6. **Auto-scroll:** Chat scrolls as AI types
7. **Context awareness:** Ask "What am I allergic to?" → AI knows your allergies

---

## Out of Scope (Future)

- Voice chat improvements (separate from text chat)
- Full conversation history UI with session list
- AI-generated recipe creation
- Recipe knowledge (AI knowing public recipe database directly)
