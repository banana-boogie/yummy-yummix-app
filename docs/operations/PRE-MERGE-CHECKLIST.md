# AI Foundation PR — Setup & Testing Checklist

## 1. Get Your Environment Up to Date

### Step 1: Push database migrations

```bash
cd yyx-server
npm run backup:all        # Safety net
npm run db:push           # Applies 29 migrations
```

Verify in Supabase Dashboard (SQL Editor):
```sql
-- New tables should exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('recipe_embeddings', 'cooking_sessions',
    'food_allergies', 'diet_types', 'cuisine_preferences',
    'ingredient_aliases', 'food_safety_rules');

-- pgvector extension enabled
SELECT installed_version FROM pg_available_extensions WHERE name = 'vector';
```

### Step 2: Set cloud secrets

In **Supabase Dashboard > Settings > Edge Functions > Secrets**, ensure:
- `OPENAI_API_KEY` is set
- `USDA_API_KEY` is set

### Step 3: Deploy edge functions

```bash
cd yyx-server
npm run deploy:all
```

### Step 4: Populate recipe embeddings (one-time)

```bash
# Dry run first
curl -X POST https://zozskiqxdphmkuniahac.supabase.co/functions/v1/backfill-embeddings \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "dryRun": true}'

# If output looks right, run for real
curl -X POST https://zozskiqxdphmkuniahac.supabase.co/functions/v1/backfill-embeddings \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "dryRun": false}'
```

Verify:
```sql
SELECT COUNT(*) FROM recipe_embeddings;
-- Should roughly match:
SELECT COUNT(*) FROM recipes WHERE status = 'published';
```

### Step 5: Install frontend deps and run

```bash
cd yyx-app
npm install               # Picks up new voice/WebRTC packages
npm run ios               # Or ios:sim
```

---

## 2. Testing Checklist

### Security

- [ ] **Auth required**: Send a chat request with no/invalid JWT → expect 401
  - I need help testing this one, need curl command, can't test on phone.
- [ ] **Session ownership**: User A cannot read User B's chat sessions or cooking sessions
  - I need help testing this one, need curl command, can't test on phone.
- [x] **RLS on embeddings**: Anon/user query on `recipe_embeddings` → denied (service_role only)
- [ ] **Admin analytics**: Non-admin calling `admin_analytics()` → "Admin access required"
 - I need help testing this one, need curl command, can't test on phone.
- [ ] **Input sanitization**: Send a message >2000 chars → truncated, no crash
  - I need help testing this one, need curl command, can't test on phone.

### Financial / Quotas

- [x] **Voice quota enforcement**: Start a voice session → `ai_voice_usage` row created/updated
- [ ] **Voice quota limit**: With 30+ minutes used, `start_session` → 429 "Monthly quota exceeded"
- [ ] **check_quota returns correct values**: Call `action: "check_quota"` → `{ minutesUsed, quotaLimit, remainingMinutes }`
  - I need help testing this one, need curl command, can't test on phone.
- [ ] **Text chat uses cheap model**: Check edge function logs → model should be `gpt-4o-mini`
  - Model doesn't show in logs.

### Text Chat (irmixy-chat-orchestrator)

- [x] **Basic chat**: Send "hello" → get a response with suggestions
- [x] **Template suggestions**: First message → suggestions appear without AI call (fast)
- [x] **Recipe generation**: "Make me a chicken pasta" → recipe card streams via SSE
- [x] **Recipe modification**: After recipe, say "make it spicier" → modified recipe generated
- [ ] **Recipe search** (NOT WORKING, cannot find recipes): "Show me dessert recipes" → recipe cards returned 
- [x] **No results fallback**: Search for something impossible → fallback message with suggestions
- [x] **Session persistence**: Close and reopen chat → history loads, session resumes
- [x] **Stream timeout**: If AI hangs, stream closes after 30s with error (hard to test manually)
- [x] **Allergen filtering**: User with nut allergy → recipes exclude nuts

### Voice Chat (irmixy-voice-orchestrator)

- [x] **Start session**: `action: "start_session"` → returns ephemeral token
- [x] **Voice conversation**: Speak a request → voice responds naturally
- [ ] **Voice tool calls** (RECIPE SEARCH NOT WORKING, same as text): Ask voice to find an ingredient → tool executes on backend
- [x] **Voice recipe generation**: Ask voice to create a recipe → recipe generated
- [x] **Session tracking**: After voice session, `ai_voice_sessions` has a new row

### Embeddings / Semantic Search
RECIPE SEARCH NOT WORKING. CAN'T FIND ANY RECIPES.
- [ ] **Hybrid search works**: Search for "something warm for winter" → semantic results (not just keyword)
- [ ] **Fallback to lexical**: If embedding fails, search still returns keyword-based results
- [x] **Embedding count**: All published recipes have embeddings

### Cooking Sessions

- [ ] **Start cooking** (NOT SHOWING IN DB): Begin step-by-step guide → `cooking_sessions` row created
- [x] **Progress tracking**: Advance to step 3 → `current_step` updates
- [x] **Resume**: Leave and return → resumes from last step, not step 1
- [x] **Stale cleanup**: Sessions >24h inactive → marked abandoned on next load

### Database / Data Integrity

- [x] **Food preferences**: Onboarding saves allergies, diet types, cuisine preferences correctly
- [ ] **Ingredient matching**: `find_closest_ingredient('pollo')` → returns chicken
- [ ] **Food safety**: Generated recipes include safe cooking temps for meat/poultry
- [x] **Lookup tables populated**: `food_allergies` (5 rows), `diet_types` (8), `cuisine_preferences` (13)

---

## 3. Known Issues / Things to Watch

| Item | Status |
|------|--------|
| CORS wildcard (`*`) in `_shared/cors.ts` | Works for now, restrict for production |
| Text chat has no per-user cost limit | Uses gpt-4o-mini (cheap), monitor usage |
| Voice quota is hardcoded (30 min) | Change requires code deploy, not config |
| `getRecommendedTemp()` deleted | Was dead code, removed |
| 1 pre-existing frontend test failure | `AllergiesStep` test — unrelated to AI foundation |
