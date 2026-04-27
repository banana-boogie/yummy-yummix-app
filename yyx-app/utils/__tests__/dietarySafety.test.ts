/**
 * dietarySafety tests
 *
 * Covers both English and Spanish restricted-ingredient tokens so a Lupita
 * on an es-MX device with a mariscos (shellfish) allergy is protected.
 */

import { filterByDietarySafety } from '../dietarySafety';
import { recipeFactory } from '@/test/factories';
import type { UserProfile } from '@/types/user';
import { MeasurementSystem } from '@/types/user';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    email: 'a@b.c',
    name: 'Test',
    username: 'test',
    biography: null,
    dietaryRestrictions: [],
    dietTypes: [],
    cuisinePreferences: [],
    measurementSystem: MeasurementSystem.METRIC,
    locale: 'en',
    profileImageUrl: null,
    onboardingComplete: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('filterByDietarySafety', () => {
  function mk(name: string) {
    return recipeFactory.create({ name, ingredients: [], tags: [] });
  }

  it('returns the input unchanged when no restrictions are set', () => {
    const recipes = [mk('Shrimp Tacos')];
    expect(filterByDietarySafety(recipes, makeProfile())).toEqual(recipes);
  });

  it('returns the input unchanged when profile is null', () => {
    const recipes = [mk('Shrimp Tacos')];
    expect(filterByDietarySafety(recipes, null)).toEqual(recipes);
  });

  it('filters English shellfish keywords', () => {
    const shrimp = mk('Shrimp Tacos');
    const safe = mk('Tomato Soup');
    const result = filterByDietarySafety(
      [shrimp, safe],
      makeProfile({ dietaryRestrictions: ['seafood'] }),
    );
    expect(result.map((r) => r.id)).toEqual([safe.id]);
  });

  it('filters Spanish shellfish keywords (camarones, mariscos)', () => {
    const camarones = mk('Tacos de Camarones');
    const mariscos = mk('Sopa de Mariscos');
    const safe = mk('Sopa de Tomate');
    const result = filterByDietarySafety(
      [camarones, mariscos, safe],
      makeProfile({ dietaryRestrictions: ['seafood'] }),
    );
    expect(result.map((r) => r.id)).toEqual([safe.id]);
  });

  it('filters Spanish peanut keyword (cacahuate)', () => {
    const cacahuate = mk('Salsa de Cacahuate');
    const safe = mk('Sopa de Tomate');
    const result = filterByDietarySafety(
      [cacahuate, safe],
      makeProfile({ dietaryRestrictions: ['nuts'] }),
    );
    expect(result.map((r) => r.id)).toEqual([safe.id]);
  });

  it('filters Spanish dairy keyword (lácteos)', () => {
    const queso = mk('Enchiladas con Queso');
    const safe = mk('Frijoles');
    const result = filterByDietarySafety(
      [queso, safe],
      makeProfile({ dietaryRestrictions: ['dairy'] }),
    );
    expect(result.map((r) => r.id)).toEqual([safe.id]);
  });

  it('filters Spanish egg keyword (huevo)', () => {
    const huevos = mk('Huevos Rancheros');
    const safe = mk('Frijoles');
    const result = filterByDietarySafety(
      [huevos, safe],
      makeProfile({ dietaryRestrictions: ['eggs'] }),
    );
    expect(result.map((r) => r.id)).toEqual([safe.id]);
  });

  it('filters user-supplied otherAllergy tokens', () => {
    const kiwi = mk('Kiwi Salad');
    const safe = mk('Tomato Soup');
    const result = filterByDietarySafety(
      [kiwi, safe],
      makeProfile({ otherAllergy: ['kiwi'] }),
    );
    expect(result.map((r) => r.id)).toEqual([safe.id]);
  });
});
