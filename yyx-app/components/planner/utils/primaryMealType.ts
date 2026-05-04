/**
 * Locale → canonical meal-type mapping for the planner UI.
 *
 * Used to pick a sensible default "primary" meal type when the user has not
 * yet expressed a preference. The mapping intentionally lives outside the
 * setup flow so other planner surfaces (e.g. TodayHero) can reuse it.
 */

import type { CanonicalMealType, PreferencesResponse } from '@/types/mealPlan';

/**
 * Resolve the locale-default canonical meal type.
 *
 * Spanish-speaking users center their day around `lunch` ("comida"); other
 * locales fall back to `dinner`.
 */
export function primaryMealTypeForLocale(locale: string): CanonicalMealType {
  return locale.toLowerCase().startsWith('es') ? 'lunch' : 'dinner';
}

/**
 * Resolve the user's "primary" canonical meal type.
 *
 * Resolution order:
 *   1. `preferences.mealTypes[0]` if present (user-ordered preference list).
 *   2. Locale default (`es*` → `lunch`, otherwise `dinner`).
 *
 * Note: `preferences.primaryMealType` does not exist in the current schema.
 * The day-level "which slot is primary today" decision lives in
 * `selectPrimarySlot` (separate util, shipped with TodayHero).
 */
export function primaryMealTypeForUser(
  preferences: PreferencesResponse | null,
  locale: string,
): CanonicalMealType {
  const userFirst = preferences?.mealTypes?.[0];
  if (userFirst) return userFirst;
  return primaryMealTypeForLocale(locale);
}
