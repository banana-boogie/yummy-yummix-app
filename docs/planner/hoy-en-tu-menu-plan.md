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

**Recommendation: in-tab toggle, not separate route.**

- `/menu` renders TodayHero by default when `mode === 'today'`.
- Tapping "Ver mi menú de la semana →" sets `mode = 'week'` and renders `MealPlanView`.
- Top-left back affordance in week mode returns to today.
- No new route. No deep-link change. State is local component state, not URL.

**Rationale:** A second route (`/menu/week`) would force a tab-stack push, animate a screen transition, and complicate back behavior on Android. An in-tab toggle is cheaper, matches the "weekly view is one tap away" framing, and keeps the URL stable for analytics.

**Tradeoff:** No deep-link to the weekly view from notifications. Acceptable — notifications point to today.

## 4. Data

No new hook. `useMealPlan` already returns the active plan with all slots.

```ts
// New derived selector, colocated with useMealPlan or in components/planner/utils
function selectTodaySlot(
  plan: MealPlanResponse | null,
  locale: string,
): MealPlanSlotResponse | null {
  if (!plan) return null;
  const todayISO = new Date().toISOString().slice(0, 10);
  const canonicalMealType = primaryMealTypeForLocale(locale); // es-MX: 'lunch', en-US: 'dinner'
  return (
    plan.slots.find(
      (s) => s.date === todayISO && s.mealType === canonicalMealType,
    ) ?? null
  );
}
```

`primaryMealTypeForLocale` already exists in setup logic (es-MX comida = canonical `lunch`); reuse it. If the user's setup specified a different "primary" meal, prefer their setting over the locale default.

## 5. State variants

TodayHero must render gracefully for every state. No blank screens.

| State | Trigger | Render |
|-------|---------|--------|
| `planned` | slot exists, `status === 'planned'` | full hero, both CTAs |
| `cooked` | slot exists, `status === 'cooked'` | hero with checkmark, "Cocinada hoy", link to weekly view only |
| `skipped` | slot exists, `status === 'skipped'` | muted hero, "Cambiar" enabled, no "Cocinar esto" |
| `noSlotToday` | active plan but no slot for today | "Hoy no tienes nada planeado" + week link |
| `noPlan` | no active plan | existing first-time / ready empty states (already built) |

`noSlotToday` is the new variant introduced by this pattern. Important because the user's plan may not cover every day.

## 6. Actions

### "Cocinar esto"
- Navigates to recipe detail: `router.push(`/recipe/${slot.recipe.id}`)`.
- Recipe detail handles tool-specific cooking guide (Thermomix params, air fryer, etc.) — already exists.
- Optimistic mark-as-cooked happens in cooking guide on completion, not here.

### "Cambiar"
- Opens `SwapMealSheet` (modal/bottom sheet, PR #4).
- Shows 3 alternatives from the ranking engine.
- Selection → local mutation via existing `swapMutation` in `useMealPlan`.
- On success, hero re-renders with new slot. No re-approval. No shopping list regeneration (alternatives must be ingredient-compatible — that's a PR #4 contract, not a TodayHero concern).

### "Ver mi menú de la semana →"
- Sets local `mode = 'week'`.
- No mutation, no fetch. Plan data already loaded.

## 7. i18n keys to add

```ts
planner.today: {
  heading: "Hoy en tu menú",       // EN: "Today on your menu"
  cookThis: "Cocinar esto",        // EN: "Cook this"
  change: "Cambiar",                // EN: "Change"
  cookedToday: "Cocinada hoy",     // EN: "Cooked today"
  nothingPlanned: "Hoy no tienes nada planeado", // EN: "Nothing planned for today"
  seeWeek: "Ver mi menú de la semana →",         // EN: "See my menu for the week →"
  backToToday: "Volver a hoy",     // EN: "Back to today"
}
```

Date formatting (`martes 8 abr`) uses existing locale-aware formatter; do not hardcode.

## 8. Analytics

No analytics in planner today. When the surface ships, emit:
- `planner_today_viewed` (variant: planned | cooked | skipped | noSlotToday | noPlan)
- `planner_today_cook_pressed`
- `planner_today_swap_pressed`
- `planner_week_link_pressed`

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
2. PR #4 (plan display + swap) merges. Confirms swap contract.
3. Build TodayHero + state variants (one PR).
4. Wire in-tab toggle in `/menu`.
5. Add i18n keys + analytics events.
6. Test with concierge cohort. Iterate.

## 12. Files this will touch

- `yyx-app/app/(tabs)/menu/index.tsx` — add mode state, render TodayHero or MealPlanView.
- `yyx-app/components/planner/TodayHero.tsx` — new.
- `yyx-app/components/planner/utils/selectTodaySlot.ts` — new (or colocate).
- `yyx-app/i18n/locales/{en,es}/planner.ts` — add `today.*` namespace.
- `yyx-app/components/planner/__tests__/TodayHero.test.tsx` — new, cover all 5 state variants.

No backend changes. No migration. No new edge function.
