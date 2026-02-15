# YummyYummix Analytics

This document describes the analytics system used to track user engagement and retention.

## Philosophy

**Track what tells us if users are happy and coming back, not vanity metrics.**

We focus on:
- **Core engagement**: Are users discovering and cooking recipes?
- **Retention**: Are users coming back?
- **Feature value**: Are AI features making users stickier?

We don't track:
- Individual page views (except recipes)
- Button clicks
- Scroll depth
- Navigation events
- Internal operations (costs, errors)

---

## Event Schema

All events are stored in the `user_events` table:

```sql
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('view_recipe', 'cook_start', 'cook_complete', 'search', 'rate_recipe', 'save_recipe', 'chat_message')),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Event Types

| Event Type | Description | Payload |
|------------|-------------|---------|
| `view_recipe` | User viewed a recipe detail page | `{ recipe_id, recipe_name }` |
| `cook_start` | User started cooking a recipe | `{ recipe_id, recipe_name }` |
| `cook_complete` | User finished cooking a recipe | `{ recipe_id, recipe_name }` |
| `search` | User performed a search | `{ query }` |

### Future Event Types (reserved)

| Event Type | Description | Feature Branch |
|------------|-------------|----------------|
| `rate_recipe` | User rated a recipe | recipe-rating |
| `save_recipe` | User saved a recipe | shopping-list |

---

## AI Feature Tables

AI usage is tracked in dedicated tables:

### `user_chat_sessions`
- `id`, `user_id`, `title`, `created_at`, `updated_at`
- Related messages in `user_chat_messages`

### `ai_voice_sessions`
- `id`, `user_id`, `status`, `duration_seconds`, `started_at`, `completed_at`
- Token counts and cost tracking

---

## Metrics Reference

### Active Users
```sql
-- DAU (Daily Active Users)
SELECT COUNT(DISTINCT user_id) as dau
FROM user_events
WHERE created_at >= CURRENT_DATE;

-- WAU (Weekly Active Users)
SELECT COUNT(DISTINCT user_id) as wau
FROM user_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- MAU (Monthly Active Users)
SELECT COUNT(DISTINCT user_id) as mau
FROM user_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
```

### Cooking Funnel
```sql
-- Funnel metrics for last 7 days
SELECT
  COUNT(*) FILTER (WHERE event_type = 'view_recipe') as views,
  COUNT(*) FILTER (WHERE event_type = 'cook_start') as starts,
  COUNT(*) FILTER (WHERE event_type = 'cook_complete') as completes,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'cook_start')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'view_recipe'), 0) * 100, 1
  ) as view_to_start_rate,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'cook_complete')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'cook_start'), 0) * 100, 1
  ) as start_to_complete_rate
FROM user_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
```

### Top Recipes
```sql
-- Most viewed recipes
SELECT
  payload->>'recipe_id' as recipe_id,
  payload->>'recipe_name' as recipe_name,
  COUNT(*) as view_count
FROM user_events
WHERE event_type = 'view_recipe'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY payload->>'recipe_id', payload->>'recipe_name'
ORDER BY view_count DESC
LIMIT 10;

-- Most cooked recipes
SELECT
  payload->>'recipe_id' as recipe_id,
  payload->>'recipe_name' as recipe_name,
  COUNT(*) as cook_count
FROM user_events
WHERE event_type = 'cook_complete'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY payload->>'recipe_id', payload->>'recipe_name'
ORDER BY cook_count DESC
LIMIT 10;
```

### Top Searches
```sql
SELECT
  LOWER(payload->>'query') as search_query,
  COUNT(*) as search_count
FROM user_events
WHERE event_type = 'search'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY LOWER(payload->>'query')
ORDER BY search_count DESC
LIMIT 10;
```

### AI Adoption
```sql
-- AI adoption rate
SELECT
  ROUND(
    (SELECT COUNT(DISTINCT user_id)
     FROM (
       SELECT user_id FROM user_chat_sessions
       UNION
       SELECT user_id FROM ai_voice_sessions
     ) ai_users)::numeric /
    NULLIF((SELECT COUNT(*) FROM user_profiles), 0) * 100, 1
  ) as ai_adoption_rate;

-- Return AI users (2+ sessions)
SELECT COUNT(*) as return_ai_users
FROM (
  SELECT user_id, COUNT(*) as session_count
  FROM (
    SELECT user_id FROM user_chat_sessions
    UNION ALL
    SELECT user_id FROM ai_voice_sessions
  ) all_sessions
  GROUP BY user_id
  HAVING COUNT(*) >= 2
) repeat_users;
```

### Retention
```sql
-- Day 1, 7, 30 retention (users who returned after signup)
WITH user_signups AS (
  SELECT id as user_id, created_at as signup_date
  FROM user_profiles
  WHERE created_at < CURRENT_DATE - INTERVAL '1 day'
),
user_activity AS (
  SELECT DISTINCT user_id, DATE(created_at) as activity_date
  FROM user_events
)
SELECT
  COUNT(*) as total_users,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM user_activity ua
      WHERE ua.user_id = us.user_id
      AND ua.activity_date = us.signup_date + INTERVAL '1 day'
    )
  ) as day1_retained,
  ROUND(
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM user_activity ua
        WHERE ua.user_id = us.user_id
        AND ua.activity_date BETWEEN us.signup_date + INTERVAL '1 day'
        AND us.signup_date + INTERVAL '7 days'
      )
    )::numeric / COUNT(*) * 100, 1
  ) as day7_retention_rate
FROM user_signups us
WHERE signup_date < CURRENT_DATE - INTERVAL '7 days';
```

### Cooking Patterns
```sql
-- Cooking time of day distribution
SELECT
  EXTRACT(HOUR FROM created_at) as hour_of_day,
  COUNT(*) as cook_count
FROM user_events
WHERE event_type = 'cook_start'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_of_day;

-- Language distribution
SELECT
  COALESCE(language, 'en') as language,
  COUNT(*) as user_count
FROM user_profiles
GROUP BY COALESCE(language, 'en');
```

---

## Implementation

### Event Service (`yyx-app/services/eventService.ts`)

```typescript
import { eventService } from '@/services/eventService';

// Track recipe view
eventService.logRecipeView(recipeId, recipeName);

// Track cook start
eventService.logCookStart(recipeId, recipeName);

// Track cook complete
eventService.logCookComplete(recipeId, recipeName);

// Track search
eventService.logSearch(query);
```

### Instrumentation Points

| File | Event | Trigger |
|------|-------|---------|
| `app/(tabs)/recipes/[id]/index.tsx` | `view_recipe` | On recipe load |
| `app/(tabs)/recipes/[id]/cooking-guide/index.tsx` | `cook_start` | On "Start" button press |
| `app/(tabs)/recipes/[id]/cooking-guide/[step].tsx` | `cook_complete` | On "Finish" button press |
| `app/(tabs)/recipes/index.tsx` | `search` | After debounced search input |

### Design Decisions

1. **Fire-and-forget**: Events are logged asynchronously without blocking the UI
2. **Silent failures**: Analytics errors don't impact user experience
3. **User-tied**: Every event includes `user_id` for per-user analysis
4. **Debounced search**: Search events only fire after user stops typing (300ms)
5. **Deduplication**: Search events track the last logged query to avoid duplicates

---

## Dashboard

Access the analytics dashboard at `/admin/analytics` (admin users only).

### Sections

1. **Overview**: DAU/WAU/MAU, total signups, onboarding rate
2. **Retention**: Day 1/7/30 retention, time to first cook, weekly cook rate
3. **Funnel**: Views → Starts → Completes with conversion rates
4. **Recipes**: Top viewed and top cooked recipes
5. **Searches**: Most popular search queries
6. **AI**: Adoption rate, session counts, return users
7. **Patterns**: Cooking time of day, language distribution

### Timeframe Filters

Available for funnel, recipes, and searches:
- Today
- 7 Days
- 30 Days
- All Time

---

## Future Additions

When these features merge to main:

### Recipe Rating (recipe-rating branch)
```typescript
eventService.logRateRecipe(recipeId, recipeName, rating);
```

### Recipe Saving (shopping-list branch)
```typescript
eventService.logSaveRecipe(recipeId, recipeName);
```

### Additional Metrics to Consider
- **Repeat cooks**: Same user cooking same recipe multiple times
- **AI → Cook correlation**: Do AI users complete more recipes?
- **Session length**: Time spent in cooking guide
- **Ingredient availability**: Do users have the ingredients they searched for?

---

## Privacy Considerations

- All events are tied to authenticated users only
- No PII is stored in event payloads
- Recipe names are stored for readability but could be derived from IDs
- Search queries may contain personal preferences - handle with care
- RLS policies ensure users can only see aggregate data (admins see all)

---

## Maintenance

### Cleanup (if needed)
```sql
-- Delete old events (e.g., older than 1 year)
DELETE FROM user_events
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';
```

### Indexes (add if queries become slow)
```sql
CREATE INDEX idx_user_events_type_created ON user_events(event_type, created_at);
CREATE INDEX idx_user_events_user_created ON user_events(user_id, created_at);
```
