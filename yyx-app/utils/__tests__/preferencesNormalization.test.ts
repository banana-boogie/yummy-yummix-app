/**
 * preferencesNormalization Tests
 *
 * Regression tests for migrating legacy "mediterranean" from dietTypes to cuisinePreferences.
 */

import { normalizeDietAndCuisinePreferences } from '@/utils/preferencesNormalization';

describe('normalizeDietAndCuisinePreferences', () => {
  it('moves legacy mediterranean from dietTypes to cuisinePreferences', () => {
    const result = normalizeDietAndCuisinePreferences(
      ['mediterranean', 'vegan'],
      ['mexican']
    );

    expect(result.dietTypes).toEqual(['vegan']);
    expect(result.cuisinePreferences).toEqual(['mexican', 'mediterranean']);
  });

  it('does not duplicate mediterranean in cuisinePreferences', () => {
    const result = normalizeDietAndCuisinePreferences(
      ['mediterranean', 'vegan'],
      ['mediterranean', 'thai']
    );

    expect(result.dietTypes).toEqual(['vegan']);
    expect(result.cuisinePreferences).toEqual(['mediterranean', 'thai']);
  });

  it('keeps preferences unchanged when no legacy data exists', () => {
    const result = normalizeDietAndCuisinePreferences(
      ['vegan', 'keto'],
      ['italian', 'greek']
    );

    expect(result.dietTypes).toEqual(['vegan', 'keto']);
    expect(result.cuisinePreferences).toEqual(['italian', 'greek']);
  });
});
