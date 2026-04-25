# "Hoy en tu menú" — Implementation Plan

**Status:** Draft. Do not build yet.
**Gates:** Blocked on PR #2 (ranking core) + PR #4 (plan display + swap UX).
**Source of truth:** `../product-kitchen/repeat-what-works/plans/01-meal-planner.md` § "Home Screen Pattern: Hoy en tu menú (Canonical)".

## 1. Intent

The Mi Menú tab leads with **today** as the primary surface. The weekly grid becomes secondary, one tap away. Lupita gets one obvious daily action; Sofía gets the weekly view on demand.

This is a **surface re-ordering**, not a re-architecture. The weekly engine (ranking, learning, shopping list, rotation) is unchanged. Only what loads first on `/menu` changes.

## 2. Surface composition

```
/menu (default)
├── TodayHero            ← new, primary
│   ├── header           "Hoy en tu menú · martes 8 abr"
│   ├── photo            recipe.image
│   ├── meta             name + portions + minutes + tool
│   ├── primaryCta       "Cocinar esto" → /recipe/[id]
│   └── secondary        "Cambiar" → SwapMealSheet (PR #4)
└── WeekLink             "Ver mi menú de la semana →" → weekly view
```

Weekly view (existing `MealPlanView`) becomes the secondary surface, reached from the link. It still owns approval + "Hacer mi lista".

## 3. Routing decision

**Recommendation: in-tab toggle, persisted for the session.**

- `/menu` renders TodayHero by default when `mode === 'today'`.
- Tapping "Ver mi menú de la semana →" sets `mode = 'week'` and renders `MealPlanView`.
- Top-left back affordance ("Volver a hoy") in week mode returns to today.
- No new route. No URL change. No deep-link change.

**Persistence:** `mode` is stored in a module-level ref (or `useRef` in a tab-level wrapper that survives tab focus changes) keyed to the current Mi Menú tab session. It survives navigating to recipe detail and back (Sofía's flow: hero → recipe → back → expects to be back on weekly view if that's where she was). It resets when the app is backgrounded for >30 minutes or on cold start. Do not use AsyncStorage — this is ephemeral session state, not a user preference.

**Android hardware back:** in week mode, hardware back returns to today mode (does not exit the tab). Wire via `BackHandler` listener mounted only when `mode === 'week'`.

**Rationale:** A second route (`/menu/week`) would force a tab-stack push, animate a screen transition, and complicate back behavior on Android. An in-tab toggle is cheaper, matches the "weekly view is one tap away" framing, and keeps the URL stable.

**Tradeoffs accepted:**
- No deep-link to the weekly view from notifications. Acceptable — notifications point to today.
- Analytics page-view tracking needs an explicit `planner_mode_changed` event since URL doesn't change. See §8.

## 4. Data

No new hook. `useMealPlan` already returns the active plan with all slots.

```ts
// New derived selector, colocated with useMealPlan or in components/planner/utils
function selectTodaySlot(
  plan: MealPlanResponse | null,
  preferences: MealPlanPreferences | null,
  locale: string,
): MealPlanSlotResponse | null {
  if (!plan) return null;
  const todayISO = new Date().toISOString().slice(0, 10);
  const primary = primaryMealTypeForUser(preferences, locale);
  return (
    plan.slots.find(
      (s) => s.date === todayISO && s.mealType === primary,
    ) ?? null
  );
}
```

**`primaryMealTypeForUser` does not exist yet.** The locale → canonical-meal-type mapping is currently inline in `FirstTimePlanSetupFlow.getMealTypeOptions` (es → `lunch`, en → `dinner`). Extract it to `components/planner/utils/primaryMealType.ts` as part of this PR. Resolution order:

1. If `preferences.primaryMealType` is set, use it.
2. Else, fall back to locale default: `es*` → `lunch`, otherwise `dinner`.
3. Else (no preferences yet), `noPlan` variant — TodayHero is not rendered anyway.

If the user's plan only has dinners but locale-default is `lunch` (or vice versa), the plan-resolution should pick the highest-priority meal type *that exists in today's slots*, not blindly the locale default. Add a tiebreaker: prefer `preferences.mealTypes[0]` over locale default when both disagree.

## 5. State variants

TodayHero must render gracefully for every state. No blank screens.

| State | Trigger | Render |
|-------|---------|--------|
| `loading` | `useMealPlan.isLoading === true` and no cached data | skeleton hero (photo block + 2 text bars + ghost CTA), no interaction |
| `error` | `useMealPlan.isError === true` | inline error card with retry button; falls back to week link below |
| `planned` | slot exists, `status === 'planned'` | full hero, "Cocinar esto" + "Cambiar" |
| `cooked` | slot exists, `status === 'cooked'` | hero photo dimmed with checkmark badge, "Cocinada hoy", text-only "Ver receta otra vez" link, no "Cocinar esto", no "Cambiar". Persists for the rest of the calendar day. |
| `skipped` | slot exists, `status === 'skipped'` | muted hero, "Cambiar" enabled, no "Cocinar esto" |
| `noSlotToday` | active plan but no slot for today's primary meal | "Hoy no tienes nada planeado" message + prominent week link |
| `noPlan` | no active plan | existing first-time / ready empty states (already built — TodayHero is not rendered) |

`noSlotToday`, `loading`, and `error` are the variants introduced or made explicit by this pattern. Tests must cover all seven; `loading` and `error` are the easiest to silently miss.

**Pull-to-refresh:** TodayHero opts in. Pull triggers `useMealPlan.refetch()`. Same gesture in week mode refreshes the plan; behavior is shared, not duplicated.

## 6. Actions

### "Cocinar esto"
- Navigates to recipe detail: `router.push(`/recipe/${slot.recipe.id}`)`.
- Recipe detail handles tool-specific cooking guide (Thermomix params, air fryer, etc.) — already exists.
- Optimistic mark-as-cooked happens in cooking guide on completion, not here.

### "Cambiar"
- Opens `SwapMealSheet` (modal/bottom sheet, **shipped by PR #4**).
- Shows 3 alternatives from the ranking engine.
- Selection → local mutation via existing `swapMutation` in `useMealPlan`.
- On success, hero re-renders with new slot. No re-approval. No shopping list regeneration (alternatives must be ingredient-compatible — that's a PR #4 contract, not a TodayHero concern).

**Hard dependency:** This plan assumes PR #4 ships swap as a reusable sheet/modal component, not just inline rows in the weekly grid. If PR #4 ships swap inline-only, TodayHero either inherits the inline list (worse UX, hero turns into a scroll surface) or this PR has to extract the sheet itself. Lock the swap-component contract before TodayHero starts.

### "Ver mi menú de la semana →"
- Sets local `mode = 'week'`.
- No mutation, no fetch. Plan data already loaded.

## 7. i18n keys to add

```ts
planner.today: {
  heading: "Hoy en tu menú",                  // EN: "Today on your menu"
  cookThis: "Cocinar esto",                   // EN: "Cook this"
  change: "Cambiar",                           // EN: "Change"
  cookedToday: "Cocinada hoy",                // EN: "Cooked today"
  viewRecipeAgain: "Ver receta otra vez",     // EN: "View recipe again"
  nothingPlanned: "Hoy no tienes nada planeado", // EN: "Nothing planned for today"
  seeWeek: "Ver mi menú de la semana →",      // EN: "See my menu for the week →"
  backToToday: "Volver a hoy",                // EN: "Back to today"
  loadError: "No pude cargar tu menú",        // EN: "Couldn't load your menu"
  retry: "Reintentar",                         // EN: "Try again"
}
```

Date formatting (`martes 8 abr`) uses existing locale-aware formatter; do not hardcode.

## 7a. Accessibility

- **"Cocinar esto" CTA height: 72px minimum** (matches strategy spec). Use existing `Button` size token if available, otherwise specify explicitly.
- **"Cambiar" hit target: 44pt minimum** even though it's text-only. Wrap in a `Pressable` with padded hit area, not a bare `Text` link.
- **Screen reader order:** heading → date → recipe name → meta (portions, time, tool) → primary CTA → secondary action → week link. Photo gets `accessibilityLabel` matching recipe name; do not announce as "image".
- **Cooked state:** announce "Cocinada hoy" before recipe name so screen reader users hear status first.
- **Week link:** announces as a button, not a link, since it changes view without navigating routes. Use `accessibilityRole="button"`.
- **Reduce Motion:** any photo zoom/parallax on hero respects `useReducedMotion`. Skeleton loader uses opacity pulse, not translation.

## 8. Analytics

No analytics in planner today. When the surface ships, emit:
- `planner_today_viewed` (variant: loading | error | planned | cooked | skipped | noSlotToday)
- `planner_today_cook_pressed`
- `planner_today_swap_pressed`
- `planner_today_swap_completed` (newRecipeId)
- `planner_week_link_pressed`
- `planner_mode_changed` (from: 'today' | 'week', to: 'today' | 'week', trigger: 'link' | 'back-button' | 'hardware-back')
- `planner_today_pull_to_refresh`

The `planner_mode_changed` event substitutes for the route-based page-view tracking we'd otherwise get from a separate `/menu/week` route. Without it, the toggle is invisible to analytics.

Defer to `06-analytics-and-metrics.md` for the canonical event names if they conflict.

## 9. Out of scope

- Mark-as-cooked from the hero (handled in cooking guide).
- Multi-meal-per-day on the hero (today shows the user's primary meal only).
- Hero on home tab outside `/menu` (Tonight Card pivot was rejected).
- Tomorrow preview, weekly summary cards (deferred).
- Push notifications driving deep-links into the hero.

## 10. Open questions

1. **Swap sheet contract:** PR #4 must define the alternatives payload shape. The hero's "Cambiar" depends on it being identical to the weekly grid's swap. Confirm before building.
2. **Cooked-today persistence:** when a recipe is marked cooked, does the hero stay on the cooked card for the rest of the day, or reveal "no más por hoy"? Default: stay on cooked card with checkmark.
3. **Time-of-day awareness:** if it's 9pm and dinner has been cooked, does tomorrow's meal show? Default: no — strictly today until midnight. Can revisit after first concierge cohort.

## 11. Sequencing

1. PR #2 (ranking) merges.
2. PR #4 (plan display + swap) merges. **Confirm swap component is reusable, not inline-only.** If inline-only, file a follow-up to extract before TodayHero starts.
3. Extract `primaryMealTypeForUser` helper from `FirstTimePlanSetupFlow` into shared utils. (Tiny prep PR or part of step 4.)
4. Build TodayHero + all 7 state variants + skeleton loader (one PR).
5. Wire in-tab toggle in `/menu` with session persistence + Android hardware back.
6. Add i18n keys + analytics events.
7. **Lupita usability check** — recruit 1-2 representative users (or proxy via the most analog stakeholder available). Goal: open app cold → cook today's meal in ≤3 taps with zero verbal guidance. If they can't, the surface fails its purpose. Re-design before concierge.
8. Sofía sanity check — same flow but verify the "weekly view + Hacer mi lista" path is still findable and feels primary on her schedule (Sunday planning).
9. Ship to concierge cohort. Watch `planner_today_viewed` variant distribution. If `noSlotToday` is >20%, the locale-default meal-type heuristic is wrong.

## 12. Files this will touch

- `yyx-app/app/(tabs)/menu/index.tsx` — add mode state with session persistence, render TodayHero or MealPlanView, mount BackHandler in week mode.
- `yyx-app/components/planner/TodayHero.tsx` — new. All 7 state variants + skeleton.
- `yyx-app/components/planner/utils/selectTodaySlot.ts` — new.
- `yyx-app/components/planner/utils/primaryMealType.ts` — new (extracted from `FirstTimePlanSetupFlow`).
- `yyx-app/components/planner/FirstTimePlanSetupFlow.tsx` — refactor to consume the extracted helper.
- `yyx-app/i18n/locales/{en,es}/planner.ts` — add `today.*` namespace.
- `yyx-app/components/planner/__tests__/TodayHero.test.tsx` — new, all 7 state variants + a11y assertions (CTA height, screen reader order).
- `yyx-app/components/planner/utils/__tests__/primaryMealType.test.ts` — new, locale + preference resolution.
- `yyx-app/components/planner/utils/__tests__/selectTodaySlot.test.ts` — new.

No backend changes. No migration. No new edge function.
