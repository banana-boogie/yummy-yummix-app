# Irmixy AI Enhancement Plan

## Vision: Time, Energy, Creativity

Irmixy helps users cook better with less effort by understanding their needs, preferences, and what they have on hand. **Core principles: save time, reduce energy, inspire creativity.**

---

## Core Abilities (North Star)

### Ability 1: Build Custom Recipes from Ingredients

**User says:** _"I have chicken, zucchini, and rice. Help me cook dinner."_

**Irmixy does:**
1. **Creates a custom recipe** using those ingredients
2. **Adjusts for user preferences** (dietary restrictions, skill level, taste profile)
3. **Incorporates feedback** as conversation progresses ("more spicy", "no garlic")
4. **Uses existing recipes as inspiration** (knowledge of cooking techniques, flavor pairings)
5. **Shows recipe with images** (from ingredient database for visual appeal)
6. **Launches cooking guide** when user is ready
7. **Auto-saves recipe** with conversation context for future reference

**User says later:** _"Make that chicken recipe we made last week."_
**Irmixy does:** Retrieves the saved custom recipe and launches cooking guide.

**Key Features:**
- Conversational recipe building (iterative refinement)
- Visual appeal (ingredient images, step photos if available)
- Memory of custom creations (searchable by conversation history)
- Seamless transition to cooking mode

---

### Ability 2: Conversational Recipe Discovery

**User says:** _"What should I make for dinner tonight?"_

**Irmixy does:**
1. **Asks clarifying questions** (cuisine preference, time available, dietary needs)
2. **Searches recipe database** semantically (not just keywords)
3. **Shows relevant recipes** from database as cards (image, time, difficulty)
4. **Narrows down options** through dialogue ("Mexican sounds good", "under 30 minutes")
5. **Falls back to Ability 1** if no existing recipes match ("Let's build something together")

**User says:** _"Something Mexican, quick, and healthy."_
**Irmixy does:** Shows 3-5 matching recipes from database, ranked by relevance.

**Key Features:**
- Natural language search (not rigid filters)
- Progressive refinement through conversation
- Smart fallback (discovery -> custom creation)
- Personalized ranking (based on past preferences)

---

## User Journeys (What It Feels Like)

### Journey 1: "I Have These Ingredients"
```text
User: I have chicken, zucchini, and rice
Irmixy: Great! I can help you make a delicious one-pan meal.
        What cuisine are you in the mood for?
        [Italian] [Asian] [Mediterranean] [Surprise me]

User: [Asian]
Irmixy: Perfect! How about a chicken stir-fry with ginger-garlic sauce?
        It'll take about 25 minutes.
        [Sounds good] [Make it spicier] [Different flavor]

User: [Make it spicier]
Irmixy: Got it! I'll add chili-garlic sauce and fresh chilies.
        Ready to start cooking?
        [Start Cooking] [Show me the recipe first]

User: [Start Cooking]
Irmixy: [Launches cooking guide with custom recipe]
        Step 1: Prep your ingredients...
```

**What happened behind the scenes:**
- Irmixy generated a custom recipe structure
- Used existing stir-fry recipes as templates
- Adjusted spice level based on feedback
- Auto-saved as "Spicy Chicken Stir-Fry (Jan 21, 2026)"

---

### Journey 2: "I Don't Know What to Eat"
```text
User: I'm not sure what to make for dinner
Irmixy: I can help! What sounds good to you right now?
        [Quick & Easy] [Something Healthy] [Comfort Food] [Surprise me]

User: [Something Healthy]
Irmixy: How much time do you have?
        [15 minutes] [30 minutes] [1 hour] [No rush]

User: [30 minutes]
Irmixy: I found 4 healthy recipes ready in 30 minutes:

        [Recipe Card: Quinoa Buddha Bowl]
        [Recipe Card: Grilled Salmon with Veggies]
        [Recipe Card: Mediterranean Chickpea Salad]
        [Recipe Card: Turkey Lettuce Wraps]

        Which sounds good?

User: The salmon one
Irmixy: Great choice! Grilled Salmon with Roasted Vegetables.
        Ready to start cooking?
        [Start Cooking] [Tell me more]
```

**What happened behind the scenes:**
- Semantic search found "healthy" recipes
- Filtered by time constraint (<=30 min)
- Ranked by user's past preferences (ate salmon last week)
- Presented as visual cards, not text list

---

### Journey 3: "Make That Recipe Again"
```text
User: Help me make that chicken recipe we made last week
Irmixy: Found it! "Spicy Chicken Stir-Fry" from January 14.
        You loved the spice level but wanted more veggies.
        Should I adjust it this time?
        [Same as before] [More veggies] [Less spicy]

User: [More veggies]
Irmixy: Perfect! I'll add bell peppers and snap peas.
        Ready to start?
        [Start Cooking]
```

**What happened behind the scenes:**
- Retrieved custom recipe from conversation history
- Recalled user feedback ("wanted more veggies")
- Offered to refine based on memory
- Updated saved recipe with new version

---

## Technical Foundation (Enablers)

Everything below exists to make the two core abilities work reliably, safely, and delightfully.

### 1. Unified Orchestrator (Single Source of Truth)

**Purpose:** Text and voice use identical AI logic for consistent experience.

**What it does:**
- Fetches user context (dietary restrictions, preferences, past recipes)
- Calls LLM with tools (search recipes, generate custom recipe, save recipe)
- Returns structured response (message + recipe cards + actions)
- Enforces safety (allergen filtering, schema validation)

**Files:**
- `yyx-server/supabase/functions/ai-orchestrator/index.ts`
- `yyx-server/supabase/functions/_shared/context-builder.ts`

---

### 2. Recipe Search Tool (Enable Ability 2)

**Purpose:** Find existing recipes from database using natural language.

**What it does:**
- Hybrid search: semantic (embeddings) + keyword + metadata filters
- Filters by: time, dietary needs, difficulty, cuisine, allergens
- Returns top 5 recipes with confidence scores
- Falls back to custom recipe generation if no good matches

**Files:**
- `yyx-server/supabase/functions/_shared/tools/search-recipes.ts`
- `yyx-server/supabase/functions/_shared/rag/hybrid-search.ts`

---

### 3. Custom Recipe Generator (Enable Ability 1)

**Purpose:** Create recipes from ingredients using AI + existing recipe knowledge.

**What it does:**
- Takes: ingredients list, user preferences, conversation context
- Generates: recipe structure (name, ingredients with quantities, steps, time, difficulty)
- Uses: existing recipes as templates/inspiration for techniques
- Adjusts: based on user feedback in conversation

**Files:**
- `yyx-server/supabase/functions/_shared/tools/generate-custom-recipe.ts`
- Uses existing recipe data as few-shot examples

---

### 4. Recipe Memory (Enable "Make That Again")

**Purpose:** Save and retrieve custom recipes created in conversations.

**What it does:**
- Auto-saves custom recipes to `user_custom_recipes` table
- Links to conversation session for context
- Searchable by: date, ingredients used, conversation keywords
- Stores user feedback for future refinement

**Files:**
- New table: `user_custom_recipes` (migration)
- New tool: `save-custom-recipe.ts`, `retrieve-custom-recipe.ts`

---

### 5. Safety & Privacy (Non-Negotiable)

**Purpose:** Never suggest allergens, respect privacy, validate all outputs.

**What it does:**
- Pre-filters recipes by user's dietary restrictions (rule-based, not LLM)
- Validates recipe outputs (realistic quantities, safe temps, proper steps)
- Redacts PII before prompt injection
- Respects privacy toggles (memory features opt-in)

**Files:**
- `yyx-server/supabase/functions/_shared/safety.ts`

---

### 6. UI Components (Make It Beautiful)

**Purpose:** Render structured responses as visual, interactive elements.

**What it does:**
- RecipeCard: shows image, name, time, difficulty, [Start Cooking] button
- SuggestionChips: context-aware next actions
- QuickActions: [Add to list], [Set timer], [Save recipe]
- Cooking guide: step-by-step with images, timers

**Files:**
- `yyx-app/components/chat/RecipeCard.tsx`
- `yyx-app/components/chat/CookingGuide.tsx` (new)

---

## Implementation Roadmap (Streamlined)

### Phase 1: Foundation (Week 1)
**Goal:** Core infrastructure for abilities 1 & 2 to work.

**Build:**
1. Unified orchestrator (text/voice use same logic)
2. Response schema (`IrmixyResponse` with recipes, actions, suggestions)
3. Context builder (load user profile, dietary restrictions)
4. Recipe search tool (basic DB query, no RAG yet)

**Deliverable:** User can ask "find me a pasta recipe" -> Irmixy shows existing recipes from DB.

---

### Phase 2: Custom Recipe Generation (Week 2)
**Goal:** Ability 1 works end-to-end.

**Build:**
1. Custom recipe generator tool (LLM creates recipe from ingredients)
2. Recipe validation (quantities, steps make sense)
3. Auto-save custom recipes to DB
4. Cooking guide integration (launch from custom recipe)

**Deliverable:** User can say "I have chicken and rice" -> Irmixy builds custom recipe -> launches cooking guide.

---

### Phase 3: Conversational Discovery (Week 3)
**Goal:** Ability 2 feels natural and smart.

**Build:**
1. RAG hybrid search (semantic + keyword + filters)
2. Multi-turn refinement (clarifying questions, narrowing down)
3. Fallback to custom recipe if no matches
4. Personalized ranking (based on past preferences)

**Deliverable:** User can have dialogue "I want something healthy" -> "Under 30 min" -> Irmixy shows 3 relevant recipes.

---

### Phase 4: Recipe Memory (Week 4)
**Goal:** "Make that again" works.

**Build:**
1. Retrieve custom recipes by conversation history
2. Show user feedback context ("you wanted more spice")
3. Allow refinement of saved recipes
4. Searchable history of custom creations

**Deliverable:** User can say "that chicken recipe from last week" -> Irmixy finds it and offers to cook again.

---

### Phase 5: Polish & Scale (Week 5+)
**Goal:** Production-ready quality.

**Build:**
1. Streaming responses (no UI pop-in, skeleton loaders)
2. Cost optimization (tier fallbacks, token budgets)
3. Privacy controls (opt-in for memory features)
4. Evaluation harness (test search relevance, safety compliance)

**Deliverable:** Fast, safe, cost-effective at scale.

---

## Verification Plan

### Test Ability 1: Custom Recipe Generation
1. Say: "I have chicken, zucchini, and rice"
2. Verify: Irmixy asks clarifying questions
3. Say: "Asian, make it spicy"
4. Verify: Irmixy generates custom stir-fry recipe with those ingredients
5. Click: [Start Cooking]
6. Verify: Cooking guide launches with proper steps
7. Check DB: Custom recipe saved to `user_custom_recipes`

### Test Ability 2: Recipe Discovery
1. Say: "I want something healthy for dinner"
2. Verify: Irmixy asks about time/cuisine
3. Say: "30 minutes, Mexican"
4. Verify: Shows 3-5 relevant recipes from DB as cards
5. Click: Recipe card
6. Verify: Can launch cooking guide or view details

### Test "Make That Again"
1. Say: "Make that chicken recipe from last week"
2. Verify: Irmixy retrieves saved custom recipe
3. Verify: Shows user's previous feedback
4. Verify: Offers to refine or cook as-is

### Test Safety
1. User has nut allergy in profile
2. Say: "Find me a dessert"
3. Verify: NO recipes with nuts are shown (filtered before LLM)
4. User requests custom recipe with almonds
5. Verify: Irmixy warns and suggests alternatives

---

## Critical Files

### New Files (Core Abilities)
| File | Purpose |
|------|---------|
| `ai-orchestrator/index.ts` | Unified entry point for text/voice |
| `tools/search-recipes.ts` | Find existing recipes (Ability 2) |
| `tools/generate-custom-recipe.ts` | Build recipes from ingredients (Ability 1) |
| `tools/save-custom-recipe.ts` | Auto-save creations |
| `tools/retrieve-custom-recipe.ts` | "Make that again" |
| `rag/hybrid-search.ts` | Semantic + keyword search |
| `components/CookingGuide.tsx` | Step-by-step cooking UI |
| `migrations/add_custom_recipes.sql` | Store user-created recipes |

### Modified Files
| File | Changes |
|------|---------|
| `ai-chat/index.ts` | Call orchestrator instead of direct LLM |
| `ai-voice/index.ts` | Call orchestrator instead of direct LLM |
| `ChatScreen.tsx` | Render recipe cards, cooking guide |
| `chatService.ts` | Handle new response schema |

---

## Key Design Decisions

### Why Unified Orchestrator?
- Text and voice return identical content (consistent UX)
- Easier to test and debug (one code path)
- Safety rules enforced in one place

### Why Hybrid Search (RAG + Keyword)?
- Semantic: understands "healthy" means low-calorie, nutritious
- Keyword: catches exact ingredient matches
- Metadata: filters time, allergens, difficulty

### Why Auto-Save Custom Recipes?
- Users forget to save but want to recreate later
- Builds personalized recipe library over time
- Enables "that recipe from last week" feature

### Why Structured Output Schema?
- UI renders cards/buttons safely (no text parsing)
- Easy to add features (new action types)
- Schema validation prevents crashes

---

## Success Metrics

After Phase 4, measure:
1. **Custom recipe creation rate:** % of conversations that generate custom recipes
2. **Recipe discovery success:** % of searches that lead to cooking
3. **"Make that again" usage:** How often users retrieve saved recipes
4. **Safety compliance:** 100% allergen filtering (no false negatives)
5. **User satisfaction:** Post-cooking feedback ("Did you like it?")

---

## What Changed from Original Plan

**Before:** 8 phases focused on architecture (gateway, RAG, privacy, eval)
**After:** 5 phases focused on user abilities (build custom, discover, remember)

**Before:** Technical details up front (tool loops, redaction, streaming)
**After:** User journeys first, technical enablers second

**Before:** Everything has equal weight
**After:** Two core abilities are the north star, everything else supports them

The technical depth is still there (orchestrator, RAG, safety) but framed as "enablers" rather than separate features.
