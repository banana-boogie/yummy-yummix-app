# "Hoy en tu menú" — Implementation Plan

**Status:** Draft v3 (post-second code-verification review). Do not build yet.
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

**In-tab toggle via `useState` in `MenuScreen`. No context, no layout changes.**

- `/menu` renders TodayHero by default when `mode === 'today'`.
- Tapping "Ver mi menú de la semana →" sets `mode = 'week'` and renders `MealPlanView`.
- Top-left back affordance ("Volver a hoy") in week mode returns to today.
- No new route. No URL change. No deep-link change.

### Persistence behavior (free with `useState`)

- **Survives** navigating to recipe detail and back. Expo Router preserves inactive tabs by default — `MenuScreen` is not unmounted on tab switch.
- **Survives** tab switches between Mi Menú and other tabs.
- **Resets** on cold start / process death (in-memory only).
- Does **not** reset on app backgrounding. There is no scenario where Sofía leaves the app in week mode and benefits from being moved to today mode an hour later.

No context provider, no `_layout.tsx` changes, no `AppState` listener. The simplest primitive that does the right thing is the right primitive.

### Hardware/gesture back

- **Android:** in week mode, mount a `BackHandler` listener via `useEffect` inside `MenuScreen`, gated on `mode === 'week'`. The listener returns `true` (consumes the event) and calls `setMode('today')` so the tab is not exited.
- **iOS:** edge-swipe-back is a no-op in week mode (no nav stack push to pop). The header "Volver a hoy" affordance is the only return path.
- **Web:** `BackHandler` is a no-op. Wrap the listener in `Platform.OS !== 'web'` guard. Web users return via the in-screen affordance only — the browser back button is not intercepted.

### Trade-offs accepted

- No deep-link to the weekly view from notifications. Notifications point to today.
- Analytics page-view tracking needs an explicit `logPlannerModeChange` event since URL doesn't change. See §8.

## 4. Data

`useMealPlan` already returns the active plan and exposes `todaysSlots`. Reuse it — but with a stale-plan guard (see §4.1).

### 4.1 Today determination + stale-plan guard

**Use local `dayIndex`, not UTC ISO.** A user in Mexico City at 11pm has local `today = April 25` but UTC ISO returns `April 26`. The existing `todayDayIndex` private function in `useMealPlan.ts` (and a duplicate in `menu/index.tsx`) uses local `getDay()`, which is correct.

**Extraction prep:** Move `todayDayIndex` to `components/planner/utils/dayIndex.ts` and import from `useMealPlan.ts`, `menu/index.tsx`, and the new `selectPrimarySlot`. Eliminates duplication; this is the third caller.

**Stale-plan guard (Critical):** A user who generated a plan 2 weeks ago can still have it returned as `active` server-side, with `dayIndex = 4` slots that point to `plannedDate: '2026-04-18'` instead of today's `'2026-04-25'`. Without a guard, the hero confidently renders a 7-day-old meal.

```ts
// components/planner/utils/dayIndex.ts (new)
export function todayDayIndex(): number {
  const day = new Date().getDay(); // 0 = Sunday
  return (day + 6) % 7;             // Monday = 0
}

export function todayLocalISO(): string {
  // Local-timezone YYYY-MM-DD. Avoid toISOString() — it's UTC.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

`useMealPlan.todaysSlots` should also gate on `slot.plannedDate === todayLocalISO()` to filter stale-plan slots. Update the hook in the prep step:

```ts
// In useMealPlan.ts
const todayIndex = todayDayIndex();
const todayISO = todayLocalISO();
const todaysSlots = useMemo(
  () => (activePlan?.slots ?? []).filter(
    (s) => s.dayIndex === todayIndex && s.plannedDate === todayISO,
  ),
  [activePlan, todayIndex, todayISO],
);
```

When the guard filters everything out, `todaysSlots` is empty and the orchestrator dispatches to `noSlotToday` (which is now also "stale plan" — copy "Hoy no tienes nada planeado" works for both, with the week link offering a place to regenerate).

### 4.2 Primary-slot selector

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

  // 1. Time-of-day preference (locale-aware boundary).
  const timePreferred = mealTypeForHour(now.getHours(), locale);
  const byTime = todaysSlots.find(
    (s) => s.mealType === timePreferred && s.status !== 'cooked',
  );
  if (byTime) return byTime;

  // 2. First user-preferred meal type that exists today and is not cooked.
  const userPrefs = preferences?.mealTypes ?? [];
  for (const mealType of userPrefs) {
    const match = todaysSlots.find(
      (s) => s.mealType === mealType && s.status !== 'cooked',
    );
    if (match) return match;
  }

  // 3. Locale default (es → lunch, otherwise dinner) — covers users who
  //    changed preferences mid-plan.
  const localeDefault: CanonicalMealType = locale.toLowerCase().startsWith('es')
    ? 'lunch'
    : 'dinner';
  const byLocale = todaysSlots.find(
    (s) => s.mealType === localeDefault && s.status !== 'cooked',
  );
  if (byLocale) return byLocale;

  // 4. Anything not yet cooked.
  const anyUncooked = todaysSlots.find((s) => s.status !== 'cooked');
  if (anyUncooked) return anyUncooked;

  // 5. Everything is cooked → return latest cooked so the all-cooked hero shows.
  return [...todaysSlots].sort(
    (a, b) => b.displayOrder - a.displayOrder,
  )[0] ?? null;
}

// Locale-aware boundary: Mexican dinner starts later than US dinner.
function mealTypeForHour(hour: number, locale: string): CanonicalMealType {
  const dinnerStart = locale.toLowerCase().startsWith('es') ? 17 : 16;
  if (hour < 11) return 'breakfast';
  if (hour < dinnerStart) return 'lunch';
  return 'dinner';
}
```

The selector is pure and deterministic — recomputes on every render of `TodayHero`. `useMealPlan` triggers re-renders on tab focus via React Query's `refetchOnWindowFocus`, and the selector picks up the time-of-day naturally. No explicit timer, no `useFocusEffect`.

**Note on `preferences.primaryMealType`:** This field does not exist on `PreferencesResponse`. The selector uses `preferences.mealTypes` (which does exist, as a user-ordered array). If a future schema adds an explicit primary, swap step 2 to consult it first.

### 4.3 Selector stability

Memoize the selector output by slot ID inside `TodayHero` so downstream `useEffect` hooks don't fire on identity-only changes:

```ts
const slot = useMemo(
  () => selectPrimarySlot(todaysSlots, preferences, locale),
  [todaysSlots, preferences, locale],
);
const slotId = slot?.id ?? null;
useEffect(() => {
  // Effects here see slotId only when it actually changes, not on every render.
}, [slotId]);
```

### 4.4 Helper extraction

Locale → canonical-meal-type mapping currently lives inline in `FirstTimePlanSetupFlow.getMealTypeOptions` (es → `lunch`, en → `dinner`). Extract to `components/planner/utils/primaryMealType.ts` for reuse and refactor `FirstTimePlanSetupFlow` to consume it.

### 4.5 Swap mutation needs invalidation (code bug)

Verified: `useMealPlan.swapMutation` (lines 122–131) has no `onSuccess: invalidatePlan()`. After a successful swap the plan is not refetched, so `TodayHero` would not see the new slot.

```ts
// In useMealPlan.ts
const swapMutation = useMutation({
  mutationFn: async (vars: { slotId: string; reason?: string }) => {
    if (!activePlan) throw new Error('No active plan');
    return mealPlanService.swapMeal({
      mealPlanId: activePlan.planId,
      mealPlanSlotId: vars.slotId,
      reason: vars.reason,
    });
  },
  onSuccess: () => invalidatePlan(), // ← add
});
```

This is a one-line fix in the prep step, not a TodayHero concern, but TodayHero depends on it. Bundle into the prep PR with the helper extractions.

## 5. State variants

Two layers: **MenuScreen orchestrator** (which surface to render) and **TodayHero internal** (how to render the hero when chosen).

### 5.1 MenuScreen orchestrator dispatch

| State | Trigger | Render |
|-------|---------|--------|
| `setupRehydrating` | `setupCompleted === null` | full-screen `ActivityIndicator` |
| `setupActive` | `setupMode !== null` | `FirstTimePlanSetupFlow` |
| `loadingPlan` | `planQuery.fetchStatus === 'fetching' && !planQuery.data` | full-screen `ActivityIndicator` |
| `noPlanFirstTime` | `setupCompleted === false`, no plan | existing `MealPlanEmptyState variant="first-time"` |
| `noPlanReady` | `setupCompleted === true`, no plan, not generating | existing `MealPlanEmptyState variant="ready"` |
| `generating` | `setupCompleted && isGenerating && !hasPlan` | existing generating placeholder |
| `planPending` | `setupCompleted && !isGenerating && !hasPlan && !isLoading` | existing pending placeholder |
| `planLoaded(today)` | active plan exists, `mode === 'today'` | **TodayHero** + week link |
| `planLoaded(week)` | active plan exists, `mode === 'week'` | existing `MealPlanView` + back-to-today header affordance |
| `loadError` | `planQuery.error` exists | inline error card, retry button, no week link (week view has nothing to show either) |

### 5.2 TodayHero internal variants

Render only when MenuScreen dispatches to `planLoaded(today)` and a primary slot resolves:

| Variant | Trigger | Render |
|---------|---------|--------|
| `draftPlanned` | active plan, `plan.shoppingListId == null`, primary slot status `planned` | full hero, "Cambiar" enabled, hint copy: "Aprueba tu menú para empezar a cocinar" with link to week view. **No "Cocinar esto"** — mirrors `MealPlanView`'s `mode === 'active'` cook gating. |
| `activePlanned` | active plan, `plan.shoppingListId != null`, primary slot status `planned` | full hero, "Cocinar esto" + "Cambiar" |
| `cooked` | selector returns a slot with status `cooked`. **By design this only happens in the all-cooked case** — multi-meal days auto-promote to the next uncooked meal (selector skips cooked slots in steps 1–3) | hero photo dimmed with checkmark badge, "Cocinada hoy", text-only "Ver receta otra vez" link, no "Cocinar esto", no "Cambiar". Persists for the rest of the calendar day so an accidental "marked cooked" tap can recover by re-opening the recipe. |
| `skipped` | primary slot status `skipped` (selector tiebreaker step 4) | muted hero, "Cambiar" enabled, no "Cocinar esto" |
| `noUncookedToday` | every slot today is cooked (selector returns latest cooked via step 5) | cooked variant render with subtle "¡Buen trabajo hoy!" footer |
| `noSlotToday` | active plan but no slot for today's `dayIndex` + `plannedDate` (covers stale-plan case too) | "Hoy no tienes nada planeado" message + prominent week link |

`skipped` source ambiguity: the slot doesn't currently distinguish user-skipped from system-skipped (busy-day fallback). For v1 render the same UI; revisit if concierge feedback shows confusion.

### 5.3 Loading skeleton

- Triggers on `planQuery.fetchStatus === 'fetching' && !planQuery.data`, **not** `useMealPlan.isLoading` (which OR's plan + preferences and stays true during prefs-only refetches).
- Locale gating: only required if `LanguageContext` does not provide `language` synchronously from initial state. Verify in implementation; if `language` is sync-available, drop the locale gate.

### 5.4 Hero re-render on time-of-day change

When the clock crosses 11:00, 16:00 (or 17:00 in es), or after a meal is marked cooked, the selector returns a different slot on the next render of `TodayHero`. The hero re-renders with the new slot data — **no transition animation**. State just updates; the photo and CTA swap. Acceptable for v1.

If real-time clock-crossing is a problem (it's only a problem if a user is staring at the screen at the exact minute the boundary crosses), add an interval timer to force re-render every 15 minutes. Not necessary v1.

### 5.5 Pull-to-refresh

- TodayHero's root is a `ScrollView` with `contentContainerStyle={{ flexGrow: 1 }}` — enables `RefreshControl` even when content fits in viewport.
- This is the codebase's first `RefreshControl` usage. RN docs apply.
- Pull triggers `useMealPlan.refetch()`, which currently refetches **only** `planQuery`. Acceptable for v1 (preferences rarely change cross-device). If concierge feedback shows stale-prefs problems, expose `refetchAll()` from the hook.
- Web: `RefreshControl` works on web but feels foreign. Gate behind `Platform.OS !== 'web'`. Web users get TanStack Query's `refetchOnWindowFocus` which fires on tab/window focus.

### 5.6 Stale shopping list after swap

Slots have `shoppingSyncState: 'not_created' | 'current' | 'stale' | 'error'`. After "Cambiar", a picked alternative may flip the slot's state to `stale`. **TodayHero hides this state** — sync happens silently when the user opens the shopping tab. Strategy doc favors not interrupting the daily flow with sync warnings.

## 6. Actions

### "Cocinar esto"
- Extract primary recipe from the slot (mirrors `MealPlanView.handleCook`):
  ```ts
  const primary = slot.components.find((c) => c.isPrimary) ?? slot.components[0];
  if (primary?.recipeId) router.push(`/recipes/${primary.recipeId}`);
  ```
- Path is `/recipes/[id]` (plural, in tabs), not `/recipe/[id]`.
- Cook is **navigation-only**. Mark-as-cooked happens in the cooking-guide completion flow.
- **Future:** if `slot.mergedCookingGuide != null`, the planner may want a slot-level cooking guide route (merged Thermomix steps across components). That route does not exist yet. Trigger to revisit: concierge data shows multi-component slots are common AND users surface cooking-step confusion. Until then, route to the primary recipe and accept that multi-component slots show only the primary's guide.

### "Cambiar"
- Opens `SwapMealSheet` (modal/bottom sheet, shipped by the upcoming swap-UX PR).
- Shows 3 alternatives from the ranking engine.
- Selection → local mutation via `useMealPlan.swapSlot(slotId, reason?)`.
  - **Prerequisite:** `swapMutation` must have `onSuccess: invalidatePlan()` (currently missing — see §4.5).
- On success, hero re-renders with the freshly-selected primary slot. The selector may pick a different slot than the one that was swapped (e.g., if the user swapped lunch but it's now past 4pm, the selector picks dinner instead). The hero always reflects the selector's current pick, not the most-recently-swapped slot.

**Self-imposed constraint:** The swap-UX PR ships swap as a reusable `SwapMealSheet` component, not as inline rows inside the weekly grid only. Both surfaces (weekly grid + TodayHero) consume the same component.

### "Ver mi menú de la semana →"
- Sets `mode = 'week'` via `setMode('week')` (local state in `MenuScreen`).
- No mutation, no fetch. Plan data already loaded.

## 7. i18n keys to add

```ts
planner.today: {
  heading: "Hoy en tu menú",                      // EN: "Today on your menu"
  cookThis: "Cocinar esto",                       // EN: "Cook this"
  change: "Cambiar",                               // EN: "Change"
  cookedToday: "Cocinada hoy",                    // EN: "Cooked today"
  greatJobToday: "¡Buen trabajo hoy!",            // EN: "Nice work today!"
  viewRecipeAgain: "Ver receta otra vez",         // EN: "View recipe again"
  nothingPlanned: "Hoy no tienes nada planeado",  // EN: "Nothing planned for today"
  approveFirstHint: "Aprueba tu menú para empezar a cocinar", // EN: "Approve your menu to start cooking"
  seeWeek: "Ver mi menú de la semana →",          // EN: "See my menu for the week →"
  backToToday: "Volver a hoy",                    // EN: "Back to today"
  loadError: "No pude cargar tu menú",            // EN: "Couldn't load your menu"
  retry: "Reintentar",                             // EN: "Try again"
}
```

`common.retry` does not exist as a non-admin key; adding planner-scoped is simpler than introducing a new common namespace. If the same copy is needed elsewhere later, hoist then.

### Date formatting

Use `date-fns` (already a dependency at v4.1.0, consistent with the rest of the codebase):

```ts
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

const dateLocale = locale.toLowerCase().startsWith('es') ? es : enUS;
const dateLabel = format(new Date(), 'EEEE d MMM', { locale: dateLocale });
// "martes 8 abr" / "Tuesday 8 Apr"
```

Do not introduce `Intl.DateTimeFormat` — codebase does not use it.

## 7a. Accessibility

- **"Cocinar esto" CTA height: 72px minimum** (matches strategy spec). Use existing `Button` size token if available; otherwise specify explicitly.
- **"Cambiar" hit target: 44pt minimum** even though it's text-only. Wrap in a `Pressable` with padded hit area, not a bare `Text` link.
- **Screen reader order:** heading → date → recipe name → meta (portions, time, tool) → primary CTA → secondary action → week link. Photo gets `accessibilityLabel` matching recipe name; do not announce as "image".
- **Cooked state:** announce "Cocinada hoy" before recipe name so screen reader users hear status first.
- **"Ver receta otra vez" (cooked variant):** navigates routes — `accessibilityRole="link"`.
- **"Ver mi menú de la semana →" (week link):** changes view without navigating routes — `accessibilityRole="button"`. Verify on real device that the `→` is not announced as "right arrow" by VoiceOver/TalkBack — if it is, drop the arrow from `accessibilityLabel` while keeping it visually.
- **Focus management on toggle:** when toggling today→week, set focus to the week-mode header (or first day in the day selector). When toggling week→today, set focus to the hero photo.
- **Dynamic type / large-text scaling:** the 72px CTA target uses absolute height for hit-target safety, but inner text label scales with system font scale. Verify hero layout doesn't clip at 1.5×.
- **Reduce Motion:** any photo zoom/parallax on hero respects `useReducedMotion`. Skeleton loader uses opacity pulse, not translation.
- **Color contrast on "Cambiar":** muted text on warm backgrounds can fall below WCAG AA. Verify against `bg-primary-lightest` with `text-text-secondary` — if contrast fails, use `text-text-default` with a smaller size.
- **Wide layouts (M5):** on screens >700px wide (iPad, web), center the hero with `maxWidth: 600`. Side-by-side hero + week-preview is deferred to v2.

## 8. Analytics

No analytics in planner today. Add methods to `services/eventService.ts` matching existing camelCase convention (`logRecipeView`, `logCookStart`):

- `logPlannerTodayView({ variant })` where variant is one of the §5.2 hero variants
- `logPlannerCookPress({ slotId, recipeId })`
- `logPlannerSwapPress({ slotId })`
- `logPlannerSwapComplete({ slotId, newRecipeId })`
- `logPlannerWeekLinkPress()`
- `logPlannerModeChange({ from, to, trigger })` — trigger: `'link' | 'back-button' | 'hardware-back'`
- `logPlannerPullToRefresh()`

`logPlannerModeChange` substitutes for the route-based page-view tracking otherwise lost by the URL-stable design.

**Feature flag:** wire behind `planner_today_hero_v1`. Default off. Concierge cohort gets it on. If the project ships no flag tooling yet, hard-code based on user list (lookup against a server-side allowlist on app start; cache in `AsyncStorage`). Acceptable scaffolding for ≤10 concierge users; replace with proper flag tooling before broader rollout.

## 9. Out of scope

- Mark-as-cooked from the hero (handled in cooking guide).
- Slot-level cooking guide route consuming `mergedCookingGuide` (deferred — see §6 trigger).
- Hero on home tab outside `/menu` (Tonight Card pivot was rejected).
- Tomorrow preview, weekly summary cards.
- Push notifications driving deep-links into the hero.
- Tab badge / unread indicator on Mi Menú tab when today's meal is uncooked.
- Distinguishing user-skipped vs system-skipped slots in render.
- Animated transition when the selector returns a different slot (clock crossing 16:00, etc.). Hero just re-renders with the new data.
- Side-by-side hero + week-preview on wide layouts (centered single-column for v1).

## 10. Open questions

1. **Swap sheet contract:** Resolved by self-imposed constraint in §6. Single reusable `SwapMealSheet` consumed by weekly grid and TodayHero.
2. **Cooked-today persistence:** Resolved — by design only the all-cooked-today variant ever shows the cooked hero (multi-meal days auto-promote to the next uncooked slot). When the cooked hero does show, it persists for the rest of the calendar day.
3. **Time-of-day awareness:** Resolved by §4.2 selector — `mealTypeForHour` picks breakfast (<11), lunch (11–16/17), dinner (≥16/17 depending on locale).
4. **Stale-shopping-list visibility:** Resolved — hidden in TodayHero, surfaced in shopping tab.
5. **Stale-plan handling:** Resolved by §4.1 guard — slots are filtered by `plannedDate === todayLocalISO()`. A plan whose slots don't cover today (e.g., generated 2 weeks ago) collapses to `noSlotToday` rendering.

## 11. Sequencing

1. Ranking-core PR merges.
2. Plan-display + swap-UX PR merges. Ship `SwapMealSheet` as a reusable component (not inline-only); both weekly grid and TodayHero consume it.
3. **Prep PR** (small, low-risk):
   - Extract `todayDayIndex` + new `todayLocalISO` to `components/planner/utils/dayIndex.ts`.
   - Extract `primaryMealType` from `FirstTimePlanSetupFlow` to `components/planner/utils/primaryMealType.ts`.
   - Update `useMealPlan.todaysSlots` to filter by `plannedDate === todayLocalISO()` (stale-plan guard).
   - Add `onSuccess: invalidatePlan()` to `useMealPlan.swapMutation`.
   - All imports updated; no behavior change for existing callers (the stale-plan guard would fix latent bugs but is unlikely to be hit in current usage).
4. Build `selectPrimarySlot` selector + tests (covers all 5 fallback steps, time-of-day boundaries for both locales, multi-meal, all-cooked, empty, stale-plan-empty).
5. Build `TodayHero` + all 6 internal variants + skeleton loader + `RefreshControl` (gated on `Platform.OS !== 'web'`).
6. Refactor `MenuScreen` to:
   - Add `mode` state (`useState<'today' | 'week'>`).
   - Dispatch on the §5.1 orchestrator table.
   - Mount `BackHandler` listener via `useEffect` when `mode === 'week'` (Android only, web/iOS no-op).
   - Render TodayHero or MealPlanView based on mode.
7. Add `planner.today.*` i18n keys (EN + ES).
8. Add analytics events to `eventService.ts` per §8.
9. Wire `planner_today_hero_v1` feature flag. Default off.
10. **Lupita usability check** — operationalized:
    - Hand user device cold-launched, not on Mi Menú tab.
    - Prompt in their language: "It's [lunchtime/dinnertime]. What's on your menu today?"
    - Record: time-to-meal-name (target <10s), tap count to enter cooking guide (target ≤3), any verbal "what does this do?" / "where is X?" / pointing for confirmation = failure, mis-taps noted but not auto-failure.
    - Pass criteria: ≤10s + ≤3 taps + 0 help requests.
    - With N≥2 users, require pass on 2-of-N. With N=1 (the realistic case if one Lupita-segment user is available), a single failure is a redesign trigger (small-N, no statistical claim).
    - Repeat post-cooking: "You finished. What now?" — checks the cooked-state UX.
    - 1+ failure on the small-N test → redesign before concierge.
11. Sofía sanity check — same flow but verify the "weekly view + Hacer mi lista" path is still findable and feels primary on her schedule (Sunday planning).
12. Enable flag for concierge cohort. Watch `logPlannerTodayView` variant distribution. Provisional thresholds: if `noSlotToday` is >20%, the stale-plan guard or selector tiebreaker is wrong; if `draftPlanned` is >30%, the approve-first hint is failing to convert.

## 12. Files this will touch

**Prep PR (step 3):**
- `yyx-app/components/planner/utils/dayIndex.ts` — **new** (`todayDayIndex`, `todayLocalISO`).
- `yyx-app/components/planner/utils/primaryMealType.ts` — **new** (extracted from `FirstTimePlanSetupFlow`).
- `yyx-app/hooks/useMealPlan.ts` — import shared `todayDayIndex`, add `todayLocalISO` filter to `todaysSlots`, add `onSuccess: invalidatePlan` to `swapMutation`.
- `yyx-app/app/(tabs)/menu/index.tsx` — replace local `todayDayIndex` with shared import (no behavior change).
- `yyx-app/components/planner/FirstTimePlanSetupFlow.tsx` — consume extracted `primaryMealType` helper.
- Tests for the new utils.

**TodayHero PR (steps 4–9):**
- `yyx-app/components/planner/TodayHero.tsx` — **new**. All 6 internal variants + skeleton + RefreshControl + memoized selector.
- `yyx-app/components/planner/utils/selectPrimarySlot.ts` — **new**.
- `yyx-app/app/(tabs)/menu/index.tsx` — `mode` state, orchestrator dispatch, BackHandler effect, TodayHero/MealPlanView render switch.
- `yyx-app/services/eventService.ts` — add planner methods listed in §8.
- `yyx-app/i18n/locales/{en,es}/planner.ts` — add `today.*` namespace.
- `yyx-app/components/planner/__tests__/TodayHero.test.tsx` — **new**, all 6 internal variants + a11y assertions (CTA height, screen reader order, role attributes), platform conditionals (web vs native).
- `yyx-app/components/planner/utils/__tests__/selectPrimarySlot.test.ts` — **new**, all 5 fallback steps + locale-aware time-of-day boundaries + multi-meal + all-cooked + empty + stale-plan-empty.
- `yyx-app/app/(tabs)/menu/__tests__/index.test.tsx` — update existing test (or add) to cover mode toggle and BackHandler integration on Android.

No backend changes. No migration. No new edge function. No new context provider, no new `_layout.tsx`.
