/**
 * preferencesNormalization Tests
 *
 * Regression tests for migrating legacy diet preferences to canonical tag slugs.
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
    expect(result.otherDiet).toEqual([]);
  });

  it('does not duplicate mediterranean in cuisinePreferences', () => {
    const result = normalizeDietAndCuisinePreferences(
      ['mediterranean', 'vegan'],
      ['mediterranean', 'thai']
    );

    expect(result.dietTypes).toEqual(['vegan']);
    expect(result.cuisinePreferences).toEqual(['mediterranean', 'thai']);
    expect(result.otherDiet).toEqual([]);
  });

  it('keeps preferences unchanged when no legacy data exists', () => {
    const result = normalizeDietAndCuisinePreferences(
      ['vegan', 'keto'],
      ['italian', 'greek']
    );

    expect(result.dietTypes).toEqual(['vegan', 'keto']);
    expect(result.cuisinePreferences).toEqual(['italian', 'greek']);
    expect(result.otherDiet).toEqual([]);
  });

  it('maps legacy vegetarian variants and dedupes after mapping', () => {
    const result = normalizeDietAndCuisinePreferences(
      ['lactoVegetarian', 'ovoVegetarian', 'vegetarian'],
      []
    );

    expect(result.dietTypes).toEqual(['vegetarian']);
  });

  it('maps legacy sugarFree to low_sugar', () => {
    const result = normalizeDietAndCuisinePreferences(['sugarFree'], []);

    expect(result.dietTypes).toEqual(['low_sugar']);
  });

  it('removes none and other sentinels, clears otherDiet, and treats empty result as valid', () => {
    const result = normalizeDietAndCuisinePreferences(
      ['none', 'other'],
      ['mexican'],
      ['whole30']
    );

    expect(result.dietTypes).toEqual([]);
    expect(result.cuisinePreferences).toEqual(['mexican']);
    expect(result.otherDiet).toEqual([]);
  });
});
