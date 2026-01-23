# Irmixy AI: Text/Voice Parity + Chat Excellence

## Text Chat Improvements (10)
1. Single conversation orchestrator/gateway: unify prompt building, tool calls, and response formatting so text and voice use identical pipeline; voice only adds TTS/ASR adapters.
2. Predictive suggestions: surface 2–3 context-aware quick replies (next step, variant, substitution, timer) based on user state, pantry, and current recipe step.
3. Inline actions: render chips for timers, “add to grocery list”, “swap ingredient”, “start cooking now” with one tap; confirm via chat message.
4. Multimodal snippets: allow photo upload for pantry/fridge; parse with vision model to propose recipes and substitutes.
5. State-aware prompting: include current recipe, step, timers, dietary prefs, pantry, skill level, and device locale in every LLM call; keep a conversation state object.
6. Step-focused mode: concise, numbered instructions with “read aloud” toggle; one-line recap + next-suggestion after each step.
7. Error recovery: detect confusion/failure cases and proactively ask clarifying questions instead of generic replies.
8. Localized tone: bilingual, friendly sous-chef persona with cultural notes; mirror user language automatically.
9. Fast-path intents: classify messages into intents (ask recipe, start cook, substitute, timer, shop list, prep plan) and route to specialized handlers/tools.
10. Quality guardrails: response templates per intent, length limits, bullet-first for steps, emoji-sparse; automatic self-check for safety/allergens.

## AI Capabilities & “Magic” (10)
1. Recipe DB search tool: semantic + filter search (diet, time, difficulty, appliances) exposed as a tool call; re-rank by user history.
2. Pantry-aware suggestions: maintain a lightweight pantry model (from scans, manual adds); prefer “use what you have” recipes.
3. Habit-based nudges: learn meal times; propose “start prep now?” notifications with timer auto-setup and shopping gaps highlighted.
4. Prep planner: generate weekly plan with batching, leftovers reuse, and grocery list grouping; adjust when user declines items.
5. Substitution engine: tool for safe swaps (diet, availability, cost) with confidence scores; update instructions accordingly.
6. Skill coaching: detect novice/expert; add optional micro-tips, knife safety, and timing cues; offer “faster” vs “precise” modes.
7. Smart timers: auto-create timers from instructions; keep them in chat, allow voice/text control; send step-ready pings.
8. Vision assistance: plate critique or doneness checks via photo; suggest fixes (thicken sauce, adjust bake time).
9. “Chef remembers me”: persistent profile with flavor likes/dislikes, allergies, appliance inventory, and past wins; use in prompts and tool filters.
10. Party/occasion mode: plan menus with sequencing, shopping, and parallel timers; adjust servings on the fly.

## RAG and Intent
- **RAG value:** yes. Use for proprietary recipes, brand voice, safety guidelines, appliance-specific instructions, and FAQs.
- **Retrieval strategy:** hybrid semantic + structured filters (diet/allergens/appliance/time). Maintain separate indices for recipes, substitutions, safety tips, and habits. Cache per-session context to cut latency.
- **Grounding:** retrieve top 3–5 short chunks with metadata (diet tags, cook time, appliance) to reduce hallucinations.
- **User intent:** run lightweight intent+slot model before LLM; choose tools (search, timers, grocery, pantry update) and tailor RAG filters.
- **Voice/text parity:** both modalities use the same intent -> tools -> LLM -> response pipeline; modality adapters only render/ingest.

## Architecture Recommendation (Text + Voice Parity)
ASR -> gateway (intent + state + RAG + tools + response template) -> single LLM call -> common response object (text + structured actions) -> TTS renderer for voice, chat renderer for text.

## “Magic” Experience Ideas (10)
1. Auto mise en place: generate prep checklist before cooking, ordered for efficiency; confirm via quick replies.
2. Time-aware swaps: if user is late, offer faster variants or Instant Pot/air fryer adaptations.
3. Leftover alchemy: after a meal, ask for leftovers and propose next-day recipes; auto-add missing items to list.
4. Seasonal/market mode: suggest recipes from local seasonal produce; weekly spotlight with cultural notes.
5. “Cook with me” cadence: adaptive pace—if user responds slowly, slow down and add reminders; if fast, bundle steps.
6. Flavor personalization: maintain a “flavor DNA” vector; re-rank recipes to match it and suggest spice tweaks.
7. Health goals: integrate macros/targets; suggest balanced menus and swaps to hit daily goals; gentle nudges, not nagging.
8. Collaborative cooking: shared session for households; split tasks, synced timers, and consolidated shopping.
9. Offline/spotty mode: cache current recipe and timers; degrade gracefully with local instructions.
10. Delight moments: occasional chef trivia or plating tip at the end; short, tasteful, and skippable.
