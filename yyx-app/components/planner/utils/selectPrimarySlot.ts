/**
 * Selects the "primary" slot to feature in TodayHero.
 *
 * Pure, deterministic. The 5-step fallback is documented in
 * `docs/planner/hoy-en-tu-menu-plan.md` §4.2.
 *
 *   1. Time-of-day preference (locale-aware boundary).
 *   2. First user-preferred meal type that is not yet cooked.
 *   3. Locale default (`es*` → `lunch`, otherwise `dinner`) — covers users who
 *      changed preferences mid-plan.
 *   4. Anything not yet cooked.
 *   5. Latest cooked slot — only reached when every slot today is cooked.
 */

import type {
  CanonicalMealType,
  MealPlanSlotResponse,
  PreferencesResponse,
} from '@/types/mealPlan';

export function selectPrimarySlot(
  todaysSlots: MealPlanSlotResponse[],
  preferences: PreferencesResponse | null,
  locale: string,
  now: Date = new Date(),
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

  // 3. Locale default.
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

  // 5. Everything is cooked → return latest cooked so the all-cooked hero
  //    shows.
  return [...todaysSlots].sort((a, b) => b.displayOrder - a.displayOrder)[0] ??
    null;
}

/**
 * Locale-aware meal-type-for-hour. Mexican dinner ("cena") starts later than
 * US dinner — split the boundary at 17:00 for `es*` and 16:00 elsewhere.
 *
 * Boundaries are inclusive of the start hour: 11:00 enters lunch, 17:00 enters
 * dinner (es) / 16:00 enters dinner (en).
 */
export function mealTypeForHour(
  hour: number,
  locale: string,
): CanonicalMealType {
  const dinnerStart = locale.toLowerCase().startsWith('es') ? 17 : 16;
  if (hour < 11) return 'breakfast';
  if (hour < dinnerStart) return 'lunch';
  return 'dinner';
}
