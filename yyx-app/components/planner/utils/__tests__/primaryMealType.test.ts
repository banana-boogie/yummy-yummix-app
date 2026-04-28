import {
  primaryMealTypeForLocale,
  primaryMealTypeForUser,
} from '@/components/planner/utils/primaryMealType';
import type { PreferencesResponse } from '@/types/mealPlan';

function buildPreferences(
  overrides: Partial<PreferencesResponse> = {},
): PreferencesResponse {
  return {
    mealTypes: [],
    busyDays: [],
    activeDayIndexes: [0, 1, 2, 3, 4],
    defaultMaxWeeknightMinutes: 30,
    preferLeftoversForLunch: false,
    preferredEatTimes: {},
    ...overrides,
  };
}

describe('primaryMealTypeForLocale', () => {
  it('returns lunch for es', () => {
    expect(primaryMealTypeForLocale('es')).toBe('lunch');
  });

  it('returns lunch for es-MX', () => {
    expect(primaryMealTypeForLocale('es-MX')).toBe('lunch');
  });

  it('returns lunch for ES (case-insensitive)', () => {
    expect(primaryMealTypeForLocale('ES')).toBe('lunch');
  });

  it('returns dinner for en', () => {
    expect(primaryMealTypeForLocale('en')).toBe('dinner');
  });

  it('returns dinner for en-US', () => {
    expect(primaryMealTypeForLocale('en-US')).toBe('dinner');
  });

  it('returns dinner for unrelated locales', () => {
    expect(primaryMealTypeForLocale('fr')).toBe('dinner');
    expect(primaryMealTypeForLocale('de')).toBe('dinner');
  });
});

describe('primaryMealTypeForUser', () => {
  it('prefers the first user-configured meal type over locale default', () => {
    const prefs = buildPreferences({ mealTypes: ['breakfast', 'lunch'] });
    expect(primaryMealTypeForUser(prefs, 'es-MX')).toBe('breakfast');
    expect(primaryMealTypeForUser(prefs, 'en-US')).toBe('breakfast');
  });

  it('falls back to locale default when preferences are null', () => {
    expect(primaryMealTypeForUser(null, 'es')).toBe('lunch');
    expect(primaryMealTypeForUser(null, 'en')).toBe('dinner');
  });

  it('falls back to locale default when mealTypes is empty', () => {
    const prefs = buildPreferences({ mealTypes: [] });
    expect(primaryMealTypeForUser(prefs, 'es')).toBe('lunch');
    expect(primaryMealTypeForUser(prefs, 'en')).toBe('dinner');
  });
});
