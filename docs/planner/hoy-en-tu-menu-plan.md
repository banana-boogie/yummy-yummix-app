# "Hoy en tu menú" — Implementation Plan

**Status:** Draft v2 (post code-verification review). Do not build yet.
**Gates:** Blocked on the ranking-core PR and the plan-display + swap-UX PR (both upcoming planner work, same author).
**Source of truth:** `../product-kitchen/repeat-what-works/plans/01-meal-planner.md` § "Home Screen Pattern: Hoy en tu menú (Canonical)".

## 1. Intent

The Mi Menú tab leads with **today** as the primary surface. The weekly grid becomes secondary, one tap away. Lupita gets one obvious daily action; Sofía gets the weekly view on demand.

This is a **surface re-ordering**, not a re-architecture. The weekly engine (ranking, learning, shopping list, rotation) is unchanged. Only what loads first on `/menu` changes.

## 2. Surface composition

```
/menu (default)
├── TodayHero            ← new, primary (renders only when active plan exists)
│   ├── header           "Hoy en tu menú · martes 8 abr"
│   ├── photo            primary component image
│   ├── meta             recipe title + portions + minutes + tool
│   ├── primaryCta       "Cocinar esto" (gated on plan mode === 'active')
│   └── secondary        "Cambiar" → SwapMealSheet (always available when planned)
└── WeekLink             "Ver mi menú de la semana →" → toggles to weekly view
```

Weekly view (existing `MealPlanView`) becomes the secondary surface, reached from the link. It still owns approval + "Hacer mi lista".

## 3. Routing decision

**Recommendation: in-tab toggle, persisted via tab-layout context.**

- `/menu` renders TodayHero by default when `mode === 'today'`.
- Tapping "Ver mi menú de la semana →" sets `mode = 'week'` and renders `MealPlanView`.
- Top-left back affordance ("Volver a hoy") in week mode returns to today.
- No new route. No URL change. No deep-link change.

### Persistence

`mode` lives in a context provided by `app/(tabs)/menu/_layout.tsx` (new file). Both `app/(tabs)/menu/index.tsx` and any future child screens consume it via `useMenuMode()`.

- Survives navigating to recipe detail and back (Sofía's flow: hero → recipe → back → expects to be back on weekly view if that's where she was).
- Survives switching tabs to /chat and back.
- **Resets** on cold start / process death (in-memory state only).
- **Resets** when app is backgrounded for >30 minutes (wire `AppState` listener in `_layout.tsx`).

Do **not** use `AsyncStorage` — this is ephemeral session state, not a user preference. Do **not** use a module-level `let` — Fast Refresh wipes it during dev and confuses build-time debugging.

### Hardware/gesture back

- **Android:** in week mode, `BackHandler` listener (mounted only when `mode === 'week'`) returns to today mode and consumes the event so the tab is not exited.
- **iOS:** edge-swipe-back is a no-op in week mode (no nav stack push to pop). The header "Volver a hoy" affordance is the only return path. This is intentional and consistent with the URL-stable design.

### Trade-offs accepted

- No deep-link to the weekly view from notifications. Notifications point to today.
- Analytics page-view tracking needs an explicit `planner_mode_changed` event since URL doesn't change. See §8.

## 4. Data

`useMealPlan` already returns the active plan and exposes `todaysSlots` (filtered by `dayIndex === todayDayIndex()`, where Monday=0). Reuse it.

### Today determination

**Use local `dayIndex`, not UTC ISO.** A user in Mexico City at 11pm has local `today = April 25` but UTC ISO returns `April 26`. The existing `useMealPlan.todayDayIndex()` uses local `getDay()`, which is correct. Do not introduce a parallel `toISOString().slice(0, 10)` calculation — it will diverge across DST boundaries and timezones.

### Primary-slot selector

```ts
// components/planner/utils/selectPrimarySlot.ts (new)
import type { MealPlanSlotResponse, PreferencesResponse, CanonicalMealType } from '@/types/mealPlan';

export function selectPrimarySlot(
  todaysSlots: MealPlanSlotResponse[],
  preferences: PreferencesResponse | null,
  locale: string,
  now = new Date(),
): MealPlanSlotResponse | null {
  if (todaysSlots.length === 0) return null;

  // 1. Time-of-day-aware primary preference.
  const timePreferred = mealTypeForHour(now.getHours());
  const byTime = todaysSlots.find((s) => s.mealType === timePreferred && s.status !== 'cooked');
  if (byTime) return byTime;

  // 2. First user-preferred meal type that exists today and is not cooked.
  const userPrefs = preferences?.mealTypes ?? [];
  for (const mealType of userPrefs) {
    const match = todaysSlots.find((s) => s.mealType === mealType && s.status !== 'cooked');
    if (match) return match;
  }

  // 3. Locale default if not in user prefs (e.g. user switched preferences mid-plan).
  const localeDefault: CanonicalMealType = locale.toLowerCase().startsWith('es') ? 'lunch' : 'dinner';
  const byLocale = todaysSlots.find((s) => s.mealType === localeDefault && s.status !== 'cooked');
  if (byLocale) return byLocale;

  // 4. Anything not yet cooked.
  const anyUncooked = todaysSlots.find((s) => s.status !== 'cooked');
  if (anyUncooked) return anyUncooked;

  // 5. Everything is cooked → return the latest cooked slot so the cooked-state hero is shown.
  return [...todaysSlots].sort((a, b) => b.displayOrder - a.displayOrder)[0] ?? null;
}

function mealTypeForHour(hour: number): CanonicalMealType {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  return 'dinner';
}
```

This selector solves the multi-meal-per-day case (a Sofía user with breakfast+lunch+dinner sees lunch at noon, dinner at 6pm, and the freshly-finished cooked card after each meal). It also gracefully degrades when the user has no preferences set yet.

**Note:** `preferences.primaryMealType` does not exist on `PreferencesResponse`. The selector uses `preferences.mealTypes` (which does exist) ordered by user choice. If a future schema adds an explicit primary, swap step 2 to consult it first.

### Helper extraction

The locale → canonical-meal-type mapping currently lives inline in `FirstTimePlanSetupFlow.getMealTypeOptions` (es → `lunch`, en → `dinner`). Extract to `components/planner/utils/primaryMealType.ts` for reuse and refactor `FirstTimePlanSetupFlow` to consume it. Tiny prep PR.

## 5. State variants

Two layers: **MenuScreen orchestrator** (which surface to render) and **TodayHero internal** (how to render the hero when chosen).

### MenuScreen orchestrator dispatch

Existing states from `menu/index.tsx` continue to apply:

| State | Trigger | Render |
|-------|---------|--------|
| `setupRehydrating` | `setupCompleted === null` | full-screen `ActivityIndicator` |
| `setupActive` | `setupMode !== null` | `FirstTimePlanSetupFlow` |
| `loadingPlan` | `planQuery.fetchStatus === 'fetching' && !planQuery.data` | full-screen `ActivityIndicator` |
| `noPlanFirstTime` | `setupCompleted === false`, no plan | existing `MealPlanEmptyState variant="first-time"` |
| `noPlanReady` | `setupCompleted === true`, no plan, not generating | existing `MealPlanEmptyState variant="ready"` |
| `generating` | `setupCompleted && isGenerating && !hasPlan` | existing generating placeholder |
| `planPending` | `setupCompleted && !isGenerating && !hasPlan && !isLoading` | existing pending placeholder (stub backend case) |
| `planLoaded(today)` | active plan exists, `mode === 'today'` | **TodayHero** + week link |
| `planLoaded(week)` | active plan exists, `mode === 'week'` | existing `MealPlanView` + back-to-today header affordance |
| `loadError` | `planQuery.error` exists | inline error card, retry button, no week link (week view has nothing to show) |

### TodayHero internal variants

Render only when MenuScreen dispatches to `planLoaded(today)` and a primary slot resolves:

| Variant | Trigger | Render |
|---------|---------|--------|
| `draftPlanned` | active plan, `plan.shoppingListId == null`, primary slot status `planned` | full hero, "Cambiar" enabled, hint copy: "Aprueba tu menú para empezar a cocinar" with link to week view. **No "Cocinar esto"** — mirrors `MealPlanView`'s `mode === 'active'` cook gating. |
| `activePlanned` | active plan, `plan.shoppingListId != null`, primary slot status `planned` | full hero, "Cocinar esto" + "Cambiar" |
| `cooked` | primary slot status `cooked` | hero photo dimmed with checkmark badge, "Cocinada hoy", text-only "Ver receta otra vez" link, no "Cocinar esto", no "Cambiar". Persists for the rest of the calendar day so an accidental "marked cooked" tap can recover by re-opening the recipe. |
| `skipped` | primary slot status `skipped` (after selector tiebreaker — see §4 step 4) | muted hero, "Cambiar" enabled, no "Cocinar esto" |
| `noUncookedToday` | every slot today is cooked (selector returns latest cooked) | cooked variant render with subtle "¡Buen trabajo hoy!" footer |
| `noSlotToday` | active plan but no slot for today's `dayIndex` | "Hoy no tienes nada planeado" message + prominent week link |

`skipped` source ambiguity: the slot doesn't currently distinguish user-skipped from system-skipped (busy-day fallback). For v1 render the same UI; revisit if concierge feedback shows confusion.

### Loading skeleton

- Uses `planQuery.fetchStatus === 'fetching' && !planQuery.data`, **not** `useMealPlan.isLoading` (which OR's plan + preferences and stays true during prefs-only refetches).
- **Also gates on `LanguageContext` ready.** Do not render the heading "Hoy en tu menú · martes 8 abr" until locale is loaded — partial Spanish heading + English-formatted date is uglier than a half-second skeleton.

### Pull-to-refresh

- `RefreshControl` on the hero's outer `ScrollView`.
- Pulls call `useMealPlan.refetch()` which currently refetches **only** `planQuery`. Acceptable for v1 (preferences rarely change cross-device). If concierge feedback shows stale-prefs problems, expose `refetchAll()` from the hook.

### Stale shopping list after swap

Slots have `shoppingSyncState: 'not_created' | 'current' | 'stale' | 'error'`. After "Cambiar", a picked alternative may flip the slot's state to `stale`. **TodayHero hides this state** — sync happens silently when the user opens the shopping tab. Strategy doc favors not interrupting the daily flow with sync warnings. Revisit if concierge feedback shows users surprised by stale lists.

## 6. Actions

### "Cocinar esto"
- Extract primary recipe from the slot:
  ```ts
  const primary = slot.components.find((c) => c.isPrimary) ?? slot.components[0];
  if (primary?.recipeId) router.push(`/recipes/${primary.recipeId}`);
  ```
- Mirrors `MealPlanView.handleCook`. Path is `/recipes/[id]` (plural, in tabs), not `/recipe/[id]`.
- **Future:** if `slot.mergedCookingGuide != null`, the planner may want a slot-level cooking guide route (merged Thermomix steps across components). That route does not exist yet. File a follow-up issue; for v1, route to the primary recipe and accept that multi-component slots show only the primary's cooking guide.
- Cook is **navigation-only**. Mark-as-cooked happens in the cooking-guide completion flow, not on tap. Same as weekly grid.

### "Cambiar"
- Opens `SwapMealSheet` (modal/bottom sheet, shipped by the upcoming swap-UX PR).
- Shows 3 alternatives from the ranking engine.
- Selection → local mutation via existing `swapMutation` in `useMealPlan` (`swapSlot(slotId, reason?)`).
- On success, hero re-renders with the new slot. No re-approval. Stale-shopping-list state hidden per §5.

**Self-imposed constraint:** The swap-UX PR ships swap as a reusable `SwapMealSheet` component, not as inline rows inside the weekly grid only. Both surfaces (weekly grid + TodayHero) consume the same component. Decide this before building the swap PR; retrofitting an inline swap into a sheet costs more than designing the sheet up front.

### "Ver mi menú de la semana →"
- Sets `mode = 'week'` via the menu-tab context.
- No mutation, no fetch. Plan data already loaded.

## 7. i18n keys to add

```ts
planner.today: {
  heading: "Hoy en tu menú",                  // EN: "Today on your menu"
  cookThis: "Cocinar esto",                   // EN: "Cook this"
  change: "Cambiar",                           // EN: "Change"
  cookedToday: "Cocinada hoy",                // EN: "Cooked today"
  greatJobToday: "¡Buen trabajo hoy!",        // EN: "Nice work today!"
  viewRecipeAgain: "Ver receta otra vez",     // EN: "View recipe again"
  nothingPlanned: "Hoy no tienes nada planeado", // EN: "Nothing planned for today"
  approveFirstHint: "Aprueba tu menú para empezar a cocinar", // EN: "Approve your menu to start cooking"
  seeWeek: "Ver mi menú de la semana →",      // EN: "See my menu for the week →"
  backToToday: "Volver a hoy",                // EN: "Back to today"
  loadError: "No pude cargar tu menú",        // EN: "Couldn't load your menu"
}
```

For the retry button, **reuse an existing common key** (e.g. `common.retry`) if one exists; only add a planner-scoped one if not.

Date formatting (`martes 8 abr`) uses an existing locale-aware formatter (or `Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' })`). Do not hardcode the format string.

## 7a. Accessibility

- **"Cocinar esto" CTA height: 72px minimum** (matches strategy spec). Use existing `Button` size token if available, otherwise specify explicitly.
- **"Cambiar" hit target: 44pt minimum** even though it's text-only. Wrap in a `Pressable` with padded hit area, not a bare `Text` link.
- **Screen reader order:** heading → date → recipe name → meta (portions, time, tool) → primary CTA → secondary action → week link. Photo gets `accessibilityLabel` matching recipe name; do not announce as "image".
- **Cooked state:** announce "Cocinada hoy" before recipe name so screen reader users hear status first.
- **"Ver receta otra vez" (cooked variant):** navigates routes, so it's a true link. `accessibilityRole="link"`.
- **"Ver mi menú de la semana →" (week link):** changes view without navigating routes. `accessibilityRole="button"`. Verify on real device that the `→` is not announced as "right arrow" by VoiceOver/TalkBack — if it is, drop the arrow from the `accessibilityLabel` while keeping it visually.
- **Focus management on toggle:** when toggling today→week, set focus to the week-mode header (or first day in the day selector). When toggling week→today, set focus to the hero photo. Avoid losing focus into nowhere.
- **Dynamic type / large-text scaling:** the 72px CTA target uses absolute height for hit-target safety, but inner text label scales with system font scale. Verify hero layout doesn't clip at 1.5×.
- **Reduce Motion:** any photo zoom/parallax on hero respects `useReducedMotion`. Skeleton loader uses opacity pulse, not translation.
- **Color contrast on "Cambiar":** muted text on warm backgrounds can fall below WCAG AA. Verify against `bg-primary-lightest` with `text-text-secondary` — if contrast fails, use `text-text-default` with a smaller size.

## 8. Analytics

No analytics in planner today. When the surface ships, add methods to `services/eventService.ts` matching existing camelCase convention (`logRecipeView`, `logCookStart`):

- `logPlannerTodayView({ variant })` where variant is one of the §5 hero variants
- `logPlannerCookPress({ slotId, recipeId })`
- `logPlannerSwapPress({ slotId })`
- `logPlannerSwapComplete({ slotId, newRecipeId })`
- `logPlannerWeekLinkPress()`
- `logPlannerModeChange({ from, to, trigger })` — trigger: 'link' | 'back-button' | 'hardware-back'
- `logPlannerPullToRefresh()`

`logPlannerModeChange` substitutes for the route-based page-view tracking we'd otherwise get from a separate `/menu/week` route. Without it, the toggle is invisible to analytics.

**Feature flag:** wire behind a flag (`planner_today_hero_v1`). Default off. Concierge cohort gets it on. Lets you A/B test the surface re-ordering against today's behavior. Defer flag impl to whatever flag tooling the project ships with — if none exists, use a server-side preference or hard-code based on user list for the cohort.

Defer to `06-analytics-and-metrics.md` for the canonical event names if they conflict.

## 9. Out of scope

- Mark-as-cooked from the hero (handled in cooking guide).
- Slot-level cooking guide route consuming `mergedCookingGuide` (file follow-up).
- Hero on home tab outside `/menu` (Tonight Card pivot was rejected).
- Tomorrow preview, weekly summary cards.
- Push notifications driving deep-links into the hero.
- Tab badge / unread indicator on Mi Menú tab when today's meal is uncooked. May fit the daily-loop framing later — defer until concierge data shows it'd be useful.
- Distinguishing user-skipped vs system-skipped slots in render. Same UI for v1.

## 10. Open questions

1. **Swap sheet contract:** Resolved by self-imposed constraint in §6. Single reusable `SwapMealSheet` consumed by weekly grid and TodayHero.
2. **Cooked-today persistence:** Resolved — stay on cooked card with checkmark for the rest of the calendar day. Reason: protects against accidental mark-cooked taps (user re-opens recipe to undo or just verify).
3. **Time-of-day awareness:** Resolved by §4 selector — `mealTypeForHour` picks breakfast (<11), lunch (11–4), dinner (≥4) when user has multi-meal slots today.
4. **Stale-shopping-list visibility:** Resolved by §5 — hidden in TodayHero, surfaced in shopping tab. Revisit on concierge feedback.

## 11. Sequencing

1. Ranking-core PR merges.
2. Plan-display + swap-UX PR merges. Ship `SwapMealSheet` as a reusable component (not inline-only); both weekly grid and TodayHero consume it.
3. Extract `primaryMealType` helper from `FirstTimePlanSetupFlow` into `components/planner/utils/primaryMealType.ts`. Tiny prep PR or part of step 4.
4. Build `selectPrimarySlot` selector + tests (covers all 5 fallback steps, time-of-day, multi-meal, all-cooked).
5. Build `app/(tabs)/menu/_layout.tsx` context provider with mode state + 30-min `AppState` reset + Android `BackHandler`.
6. Build `TodayHero` + all 6 internal variants + skeleton loader + `RefreshControl`.
7. Wire MenuScreen dispatch (§5 orchestrator table) to render TodayHero or MealPlanView based on mode.
8. Add `planner.today.*` i18n keys (EN + ES).
9. Add analytics events to `eventService.ts`.
10. Wire `planner_today_hero_v1` feature flag. Default off.
11. **Lupita usability check** — operationalized script:
    - Hand user device cold-launched, not on Mi Menú tab.
    - Prompt in their language: "It's [lunchtime/dinnertime]. What's on your menu today?"
    - Record: time-to-meal-name (target <10s), tap count to enter cooking guide (target ≤3), any verbal "what does this do?" / "where is X?" / pointing for confirmation = failure, mis-taps noted.
    - Pass: ≤10s + ≤3 taps + 0 help requests, on 2-of-3 representative users (Spanish-speaking, 55+, Thermomix owner).
    - Repeat post-cooking: "You finished. What now?" — checks the cooked-state UX.
    - 1+ failure → redesign before concierge.
12. Sofía sanity check — same flow but verify the "weekly view + Hacer mi lista" path is still findable and feels primary on her schedule (Sunday planning).
13. Enable flag for concierge cohort. Watch `logPlannerTodayView` variant distribution. If `noSlotToday` is >20% (provisional threshold), the multi-step selector's tiebreaker is wrong.

## 12. Files this will touch

- `yyx-app/app/(tabs)/menu/_layout.tsx` — **new**. Tab-layout context provider for `mode`, `AppState` listener for 30-min reset, `BackHandler` mount.
- `yyx-app/app/(tabs)/menu/index.tsx` — refactor MenuScreen to dispatch on the §5 orchestrator table; consume `useMenuMode()`; render TodayHero or MealPlanView.
- `yyx-app/components/planner/TodayHero.tsx` — **new**. All 6 internal variants + skeleton + RefreshControl.
- `yyx-app/components/planner/utils/selectPrimarySlot.ts` — **new**.
- `yyx-app/components/planner/utils/primaryMealType.ts` — **new** (extracted from `FirstTimePlanSetupFlow`).
- `yyx-app/components/planner/FirstTimePlanSetupFlow.tsx` — refactor to consume the extracted helper.
- `yyx-app/services/eventService.ts` — add planner methods listed in §8.
- `yyx-app/i18n/locales/{en,es}/planner.ts` — add `today.*` namespace.
- `yyx-app/components/planner/__tests__/TodayHero.test.tsx` — **new**, all 6 internal variants + a11y assertions (CTA height, screen reader order, role attributes).
- `yyx-app/components/planner/utils/__tests__/selectPrimarySlot.test.ts` — **new**, all 5 selector fallback steps + multi-meal + time-of-day boundaries.
- `yyx-app/components/planner/utils/__tests__/primaryMealType.test.ts` — **new**, locale + preference resolution.
- `yyx-app/app/(tabs)/menu/__tests__/menu.layout.test.tsx` — **new**, mode persistence across remounts + `AppState` reset behavior.

No backend changes. No migration. No new edge function.
