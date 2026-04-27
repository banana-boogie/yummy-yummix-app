/**
 * usePersonalizedSections Tests
 */

import { renderHook } from '@testing-library/react-native';
import { usePersonalizedSections } from '../usePersonalizedSections';
import { recipeFactory } from '@/test/factories';
import { RecipeDifficulty } from '@/types/recipe.types';
import type { UserProfile } from '@/types/user';
import type { MealPlan } from '@/types/mealPlan';
import { MeasurementSystem } from '@/types/user';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

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

describe('usePersonalizedSections', () => {
  it('returns no sections when no recipes (cold start)', () => {
    const { result } = renderHook(() =>
      usePersonalizedSections({ recipes: [], userProfile: null }),
    );
    expect(result.current).toEqual([]);
  });

  it('builds for_you, quick_easy and all_recipes sections when recipes exist', () => {
    const many = Array.from({ length: 15 }, () =>
      recipeFactory.create({
        totalTime: 20,
        difficulty: RecipeDifficulty.EASY,
      }),
    );

    const { result } = renderHook(() =>
      usePersonalizedSections({
        recipes: many,
        userProfile: makeProfile(),
      }),
    );

    const ids = result.current.map((s) => s.id);
    expect(ids).toContain('for_you');
    expect(ids).toContain('quick_easy');
    expect(ids).toContain('all_recipes');
    expect(ids[0]).toBe('for_you');
    expect(ids[ids.length - 1]).toBe('all_recipes');
  });

  it('filters out recipes that violate restrictions', () => {
    const peanutRecipe = recipeFactory.create({
      name: 'Peanut Noodles',
      totalTime: 20,
      difficulty: RecipeDifficulty.EASY,
      ingredients: [],
      tags: [],
    });
    const safeRecipe = recipeFactory.create({
      name: 'Tomato Soup',
      totalTime: 20,
      difficulty: RecipeDifficulty.EASY,
      ingredients: [],
      tags: [],
    });

    const { result } = renderHook(() =>
      usePersonalizedSections({
        recipes: [peanutRecipe, safeRecipe],
        userProfile: makeProfile({ dietaryRestrictions: ['nuts'] }),
      }),
    );

    const allSection = result.current.find((s) => s.id === 'all_recipes');
    expect(allSection).toBeDefined();
    const ids = allSection!.recipes.map((r) => r.id);
    expect(ids).toContain(safeRecipe.id);
    expect(ids).not.toContain(peanutRecipe.id);
  });

  it('does not show the same recipe in both for_you and quick_easy', () => {
    const recipe = recipeFactory.create({
      totalTime: 15,
      difficulty: RecipeDifficulty.EASY,
    });

    const { result } = renderHook(() =>
      usePersonalizedSections({
        recipes: [recipe],
        userProfile: makeProfile(),
      }),
    );

    const forYou = result.current.find((s) => s.id === 'for_you');
    const quick = result.current.find((s) => s.id === 'quick_easy');

    // recipe lands in for_you first; quick_easy should skip it
    expect(forYou?.recipes.some((r) => r.id === recipe.id)).toBe(true);
    expect(quick?.recipes.some((r) => r.id === recipe.id)).toBeFalsy();
  });

  it('includes todays_meal section when an active plan has an upcoming slot', () => {
    const recipe = recipeFactory.create();
    const today = new Date().toISOString().slice(0, 10);
    const plan: MealPlan = {
      planId: 'p1',
      weekStart: today,
      locale: 'en',
      requestedDayIndexes: [0],
      requestedMealTypes: ['dinner'],
      slots: [
        {
          id: 'slot-1',
          plannedDate: today,
          dayIndex: 0,
          mealType: 'dinner',
          displayMealLabel: 'Dinner',
          displayOrder: 0,
          status: 'planned',
          components: [
            {
              id: 'comp-1',
              componentRole: 'main',
              sourceKind: 'recipe',
              recipeId: recipe.id,
              title: recipe.name,
              imageUrl: null,
              totalTimeMinutes: 30,
              difficulty: 'easy',
              portions: 4,
              isPrimary: true,
              displayOrder: 0,
            },
          ],
        },
      ],
    };

    const { result } = renderHook(() =>
      usePersonalizedSections({
        recipes: [recipe],
        userProfile: makeProfile(),
        activePlan: plan,
      }),
    );

    const ids = result.current.map((s) => s.id);
    expect(ids[0]).toBe('todays_meal');
  });

  it('hides todays_meal when the only planned slot is in the future', () => {
    const recipe = recipeFactory.create();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);
    const plan: MealPlan = {
      planId: 'p1',
      weekStart: tomorrowIso,
      locale: 'en',
      requestedDayIndexes: [0],
      requestedMealTypes: ['dinner'],
      slots: [
        {
          id: 'slot-1',
          plannedDate: tomorrowIso,
          dayIndex: 0,
          mealType: 'dinner',
          displayMealLabel: 'Dinner',
          displayOrder: 0,
          status: 'planned',
          components: [
            {
              id: 'comp-1',
              componentRole: 'main',
              sourceKind: 'recipe',
              recipeId: recipe.id,
              title: recipe.name,
              imageUrl: null,
              totalTimeMinutes: 30,
              difficulty: 'easy',
              portions: 4,
              isPrimary: true,
              displayOrder: 0,
            },
          ],
        },
      ],
    };

    const { result } = renderHook(() =>
      usePersonalizedSections({
        recipes: [recipe],
        userProfile: makeProfile(),
        activePlan: plan,
      }),
    );

    expect(result.current.map((s) => s.id)).not.toContain('todays_meal');
  });
});
