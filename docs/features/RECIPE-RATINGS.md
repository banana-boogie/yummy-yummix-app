# Recipe Rating System

The recipe rating system lets users rate recipes (1–5 stars) and leave optional feedback after cooking them. Ratings surface in recipe discovery, Irmixy's search ranking, and the admin feedback dashboard.

---

## Overview

The flow from cook to rating:

1. User completes a recipe in the cooking guide — `recipeCompletionService.recordCompletion()` inserts an append-only event row into `recipe_completions`.
2. The completion gate is enforced at the **RLS policy level** — a user cannot write to `recipe_ratings` unless a matching row exists in `recipe_completions`.
3. After completion, the rating modal (`RecipeRatingModal`) is shown. The user picks 1–5 stars, optionally selects sentiment tags and/or types free-text feedback.
4. `ratingService.submitRating()` upserts the rating. If feedback exists, `ratingService.submitFeedback()` inserts a `recipe_feedback` row.
5. A database trigger (`trg_update_recipe_rating_stats`) recalculates `recipes.average_rating` and `recipes.rating_count` after every insert, update, or delete on `recipe_ratings`.
6. Irmixy (the AI companion) can also submit ratings via the `submit_recipe_rating` tool when a user expresses an opinion in conversation.

---

## Database Schema

### Tables

**`recipe_completions`** — append-only completion events

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `auth.users` |
| `recipe_id` | uuid | FK → `recipes` |
| `completed_at` | timestamptz NOT NULL | Default `now()` |

Each cook-through appends a new row. There is no unique constraint on `(user_id, recipe_id)` — one user cooking the same recipe three times produces three rows. RLS allows authenticated users to select/insert/delete their own rows (no UPDATE — append-only).

Key indexes: `(user_id, recipe_id)`, `(recipe_id, completed_at DESC)`, `(user_id, completed_at DESC)`.

---

**`recipe_ratings`** — one rating per user per recipe

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `auth.users` |
| `recipe_id` | uuid | FK → `recipes` |
| `rating` | integer | CHECK 1–5 |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by `handle_updated_at()` trigger |

UNIQUE constraint on `(user_id, recipe_id)` — re-rating uses upsert. Ratings are publicly readable (SELECT policy is `USING (true)`). INSERT and UPDATE require the user to have a completion row for that recipe (see Completion Gate below).

---

**`recipe_feedback`** — free-text feedback for admin review

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `auth.users` |
| `recipe_id` | uuid | FK → `recipes` |
| `feedback` | text | 1–2000 characters |
| `created_at` | timestamptz | |

Multiple feedback rows per user/recipe are allowed. Users can only read their own feedback; admins access all rows via the `admin_recipe_feedback_list` RPC (authenticated RPC guarded by `is_admin()` with `SECURITY DEFINER`).

---

**`recipes` columns added by migrations**

| Column | Type | Notes |
|---|---|---|
| `average_rating` | numeric | NULL until first rating; rounded to 2 dp by trigger |
| `rating_count` | integer | Default 0 |

---

### Trigger: `trg_update_recipe_rating_stats`

Fires `AFTER INSERT OR UPDATE OR DELETE` on `recipe_ratings` (row-level). Calls `update_recipe_rating_stats()` which recalculates `average_rating` and `rating_count` on the affected recipe via a single `UPDATE ... FROM (SELECT AVG, COUNT ...)`.

`SECURITY DEFINER` so it can write to `recipes` regardless of the calling user's permissions.

Migration: `yyx-server/supabase/migrations/20260211100300_add_recipe_rating_stats.sql`

---

### RPC Functions

**`get_recipe_rating_distribution(p_recipe_id uuid)`**

Returns `TABLE(rating integer, count bigint)` — up to 5 rows (one per star level), ordered 5→1. `STABLE SECURITY INVOKER`. Used by `ratingService.getRatingDistribution()` to avoid fetching all individual rating rows client-side.

**`admin_recipe_feedback_list(p_page, p_page_size, p_recipe_id, p_start_date, p_end_date, p_language)`**

Returns paginated feedback with recipe name (resolved from `recipe_translations` with locale fallback) and user email. Raises an exception if `is_admin()` returns false. Page size is clamped to 1–100. Returns `{ data, count, hasMore }`.

Migration: `yyx-server/supabase/migrations/20260318201019_fix_rating_database_issues.sql` (updated to join `recipe_translations` instead of dropped `name_en`/`name_es` columns)

---

## Completion Gate

The INSERT and UPDATE RLS policies on `recipe_ratings` include an existence check:

```sql
AND EXISTS (
  SELECT 1 FROM public.recipe_completions rc
  WHERE rc.user_id = auth.uid()
    AND rc.recipe_id = recipe_id
)
```

This means the database itself rejects rating writes for recipes the user has not cooked — there is no application-layer bypass. If this policy fires, Supabase returns error code `42501` (or a message matching `row-level security policy.*recipe_ratings`). `ratingService` detects this and throws `RATING_REQUIRES_COMPLETION_ERROR`, which `RecipeRatingModal` maps to a user-facing localized message.

Migration: `yyx-server/supabase/migrations/20260212103000_harden_rating_and_completion_integrity.sql`

---

## Frontend Components

All components live in `yyx-app/components/rating/`.

### `StarRating`

Display-only. Renders filled/half/empty stars for a `rating` value (0–5, rounded to nearest 0.5). Supports sizes `sm | md | lg`. Optional `showCount` prop renders the total count in parentheses. Memoized with `React.memo`.

### `StarRatingInput`

Interactive input for selecting 1–5 whole stars. Each star is an `AnimatedStar` with a spring scale animation (react-native-reanimated) on press. Fires haptic feedback (`ImpactFeedbackStyle.Medium`). Fully accessible — each star has an `accessibilityRole="button"` and localized label.

### `SentimentTags`

A row of toggleable pill tags. The seven available tag keys are:

- `easyToFollow`, `delicious`, `quickToMake`
- `needsMoreSeasoning`, `tooHard`, `greatForFamily`, `wouldMakeAgain`

Labels are resolved from `i18n` (`recipes.rating.sentimentTags.*`). Selected tags are combined with the free-text feedback and stored as a single `recipe_feedback` row with the format `[Tag1, Tag2] Free text here`.

### `RecipeRatingModal`

Bottom-sheet modal triggered after recipe completion. Flow:

1. Shows recipe name and `StarRatingInput` (lg size).
2. Shows `SentimentTags` beneath the stars.
3. A "Add comment" link expands a `TextInput` (max 2000 chars).
4. Skip / Submit buttons. Submit is disabled until at least one star is selected.
5. On success: shows a brief "Thank you" confirmation then auto-closes after 1.5 s.
6. On `RATING_REQUIRES_COMPLETION_ERROR`: shows the localized completion-required message (should not occur in practice since the modal is only shown post-completion).

The modal guards against double submission with a `submittingRef` ref. Tags and free text are combined before calling `submitFeedbackAsync` — feedback is only inserted if there is something to store.

### `RatingDistribution`

Read-only distribution panel showing average score, star mini-display, total count, and a percentage bar for each star level (5→1). Formatted with `Intl.NumberFormat` for locale-aware percent display. Returns `null` when `total === 0`. Memoized.

---

## Services and Hooks

### `recipeCompletionService` — `yyx-app/services/recipeCompletionService.ts`

| Method | Description |
|---|---|
| `recordCompletion(recipeId)` | Inserts a completion event. Validates the recipe is published first. No-ops silently for unauthenticated users. |
| `hasCompletedRecipe(recipeId)` | Returns `boolean` — checks for any completion row for the current user + recipe. |

### `ratingService` — `yyx-app/services/ratingService.ts`

| Method | Description |
|---|---|
| `submitRating(recipeId, rating)` | Upserts a rating (1–5 integer). Validates recipe is published. Translates RLS error `42501` into `RATING_REQUIRES_COMPLETION_ERROR`. |
| `submitFeedback(recipeId, feedback)` | Inserts a feedback row (trimmed, 1–2000 chars). |
| `getUserRating(recipeId)` | Returns the current user's rating or `null`. Ignores `PGRST116` (no row found). |
| `getRatingDistribution(recipeId)` | Calls `get_recipe_rating_distribution` RPC and normalizes into `{ distribution: {1..5: count}, total }`. |

### `useRecipeRating` — `yyx-app/hooks/useRecipeRating.ts`

React Query wrapper over `ratingService`. Query keys:

- `['ratings', 'user', recipeId]` — user's own rating (stale after 5 min, only fetched when logged in)
- `['ratings', 'distribution', recipeId]` — distribution (stale after 5 min)

The `submitRating` mutation applies **optimistic updates**: immediately writes the new rating to the cache and rolls back on error. On settle it invalidates both rating queries plus `['recipes', recipeId]` to refresh the cached recipe's aggregate stats.

Returned values: `userRating`, `submitRating`, `submitRatingAsync`, `submitFeedback`, `submitFeedbackAsync`, `isSubmittingRating`, `isSubmittingFeedback`, `ratingError`, `feedbackError`, `ratingDistribution`, `totalRatings`, `isLoadingRating`, `isLoadingDistribution`, `isLoggedIn`.

---

## AI Integration

### `submit_recipe_rating` Tool — `yyx-server/supabase/functions/_shared/tools/submit-recipe-rating.ts`

Irmixy can submit ratings on behalf of the user in conversation. The tool:

1. Fuzzy-matches the recipe name via `ILIKE` on `recipe_translations` (preferred locale first, then all locales as fallback).
2. Checks `recipe_completions` for a completion row — returns a descriptive failure message if none found.
3. Upserts into `recipe_ratings`.
4. Optionally inserts into `recipe_feedback` (failure here does not fail the whole operation).

The tool schema instructs Irmixy to **always confirm with the user** before calling it (e.g., "Entiendo que te encantó, le pongo 5 estrellas?"). Star inference guidance is embedded in the schema description: "riquísima/increíble/amazing = 5, muy buena/great = 4, estuvo bien/okay = 3, no me gustó mucho/not great = 2, horrible/terrible = 1."

### Rating Boost in `search_recipes` (Lexical Path)

`scoreByQuery` in `yyx-server/supabase/functions/_shared/tools/search-recipes.ts` applies a gentle boost to recipes with a trustworthy rating:

```typescript
// Only for recipes with ≥3 ratings
if (original.average_rating && (original.rating_count ?? 0) >= 3) {
  score += (original.average_rating - 3) * 8;
}
```

A 5-star recipe gains +16 points; a 1-star recipe loses 16 points. The minimum threshold of 3 ratings prevents single-vote distortion.

### Rating Weight in Hybrid Search

`yyx-server/supabase/functions/_shared/rag/hybrid-search.ts` includes ratings in its multi-factor scoring:

```
RATING_WEIGHT = 0.05
```

Unrated recipes (or those with fewer than 3 ratings) receive a neutral score of 0.5. Rated recipes score `average_rating / 5`. The rating component sits alongside semantic (0.38), lexical (0.33), metadata (0.09), and personalization (0.15) weights.

---

## Analytics

All rating events use event type `rate_recipe` via `eventService` (`yyx-app/services/eventService.ts`). Events are batched and flushed every 5 seconds (or on app background).

| Action | When fired | Extra payload fields |
|---|---|---|
| `modal_shown` | Modal becomes visible | `recipe_id`, `recipe_name` |
| `submitted` | Rating saved via modal | `rating`, `has_feedback`, `has_tags` |
| `inline_submitted` | Rating saved without modal | `rating`, `has_feedback`, `has_tags` |
| `skipped` | User taps Skip | `recipe_id`, `recipe_name` |

The `submitted` vs `inline_submitted` distinction (`source: 'modal' | 'inline'`) allows the analytics dashboard to separate prompted ratings from unprompted ones.

Events are stored in the `user_events` table with `event_type = 'rate_recipe'` and the above payload under the `payload` jsonb column.

---

## Discovery Integration

### Top Rated Section

`filterTopRated` in `yyx-app/utils/recipeFilters.ts` produces the "Top Rated" section on the recipe browse screen:

```typescript
export function filterTopRated(recipes: Recipe[], minRatings: number = 2): Recipe[] {
  return recipes
    .filter(r => (r.ratingCount ?? 0) >= minRatings && (r.averageRating ?? 0) > 0)
    .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
    .slice(0, 10);
}
```

The default minimum of 2 ratings prevents a single 5-star vote from dominating the section.

### Star Badges on Recipe Cards

Recipe cards receive `averageRating` and `ratingCount` from `recipes.average_rating` and `recipes.rating_count` (denormalized columns kept in sync by the trigger). The `StarRating` component renders the badge using `size="sm"` with `showCount`.

---

## Admin

**Feedback Dashboard** — `admin_recipe_feedback_list` RPC

Access is restricted to users where `is_admin()` returns true. Parameters:

| Parameter | Default | Description |
|---|---|---|
| `p_page` | 1 | Page number (1-based) |
| `p_page_size` | 20 | Rows per page (max 100) |
| `p_recipe_id` | NULL | Filter to a specific recipe |
| `p_start_date` | NULL | Filter by `created_at >=` |
| `p_end_date` | NULL | Filter by `created_at <=` |
| `p_language` | `'en'` | Preferred locale for recipe name |

Recipe names are resolved from `recipe_translations` with a COALESCE fallback chain: preferred locale → `en` → `es` → `'Untitled'`. Each row includes `id`, `feedback`, `created_at`, `user_id`, `recipe_id`, `recipe_name`, `user_email`.

Returns `{ data: [...], count: <total>, hasMore: boolean }`.

---

## Migration History

| File | Description |
|---|---|
| `20260211100000_add_recipe_completions.sql` | `recipe_completions` table with initial unique constraint (later dropped) |
| `20260211100100_add_recipe_ratings.sql` | `recipe_ratings` table, basic RLS |
| `20260211100200_add_recipe_feedback.sql` | `recipe_feedback` table |
| `20260211100300_add_recipe_rating_stats.sql` | `average_rating`, `rating_count` columns + `trg_update_recipe_rating_stats` trigger |
| `20260212103000_harden_rating_and_completion_integrity.sql` | Convert completions to append-only events; enforce completion gate in RLS; add `admin_recipe_feedback_list` RPC |
| `20260318201019_fix_rating_database_issues.sql` | Fix `admin_recipe_feedback_list` to use `recipe_translations`; add `get_recipe_rating_distribution` RPC; consolidate `updated_at` trigger onto `handle_updated_at()` |
