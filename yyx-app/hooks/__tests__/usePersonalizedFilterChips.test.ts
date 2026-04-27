/**
 * usePersonalizedFilterChips — applyChipToSections tests
 *
 * Focused on the "empty All Recipes after chip filter -> hide section"
 * behavior. Keeps the render-time UX clean so Lupita doesn't see an
 * orphan "All Recipes" header with nothing under it.
 */

import { applyChipToSections, applyChipFilter } from '../usePersonalizedFilterChips';
import { recipeFactory } from '@/test/factories';
import { RecipeDifficulty } from '@/types/recipe.types';
import type { FilterChip } from '@/components/recipe/FilterChips';

const quickChip: FilterChip = {
  id: 'quick',
  label: 'Quick',
  filter: { maxTime: 30 },
};

function section(id: string, recipes: ReturnType<typeof recipeFactory.create>[]) {
  return { id, title: id, recipes, layout: 'grid' as const };
}

describe('applyChipToSections', () => {
  it('returns input unchanged when no chip is selected', () => {
    const sections = [section('all_recipes', [recipeFactory.create()])];
    expect(applyChipToSections(sections, null)).toEqual(sections);
  });

  it('narrows the all_recipes section when chip matches some recipes', () => {
    const quick = recipeFactory.create({ totalTime: 20, difficulty: RecipeDifficulty.EASY });
    const slow = recipeFactory.create({ totalTime: 90, difficulty: RecipeDifficulty.HARD });
    const sections = [section('all_recipes', [quick, slow])];
    const result = applyChipToSections(sections, quickChip);
    expect(result).toHaveLength(1);
    expect(result[0].recipes.map((r) => r.id)).toEqual([quick.id]);
  });

  it('drops all_recipes entirely when chip filter empties it', () => {
    const slow = recipeFactory.create({ totalTime: 90 });
    const sections = [
      section('for_you', [recipeFactory.create()]),
      section('all_recipes', [slow]),
    ];
    const result = applyChipToSections(sections, quickChip);
    expect(result.map((s) => s.id)).toEqual(['for_you']);
  });

  it('leaves non-all_recipes sections untouched', () => {
    const slow = recipeFactory.create({ totalTime: 90 });
    const forYou = section('for_you', [slow]);
    const sections = [forYou, section('all_recipes', [])];
    const result = applyChipToSections(sections, quickChip);
    // for_you is preserved as-is even though its recipe wouldn't pass the chip
    expect(result.find((s) => s.id === 'for_you')?.recipes).toEqual([slow]);
  });
});

describe('applyChipFilter — excludeRestriction', () => {
  const glutenFreeChip: FilterChip = {
    id: 'diet_gluten',
    label: 'Gluten-Free',
    filter: { excludeRestriction: 'gluten' },
  };

  it('removes recipes whose name contains a restricted keyword', () => {
    // Override ingredients/tags to keep the test deterministic — the factory's
    // random ingredients can include "flour" and trigger the gluten exclusion.
    const breadRecipe = recipeFactory.create({
      name: 'Sourdough Bread',
      ingredients: [],
      tags: [],
    });
    const soupRecipe = recipeFactory.create({
      name: 'Tomato Soup',
      ingredients: [],
      tags: [],
    });
    const result = applyChipFilter([breadRecipe, soupRecipe], glutenFreeChip);
    expect(result.map((r) => r.id)).toEqual([soupRecipe.id]);
  });

  it('removes recipes whose ingredients contain a restricted keyword (Spanish)', () => {
    const seafoodChip: FilterChip = {
      id: 'diet_seafood',
      label: 'Sin Mariscos',
      filter: { excludeRestriction: 'seafood' },
    };
    const camaronRecipe = recipeFactory.create({
      name: 'Aguachile',
      ingredients: [
        // camarón is in RESTRICTION_KEYWORDS.seafood
        { id: 'i1', name: 'camarón', amount: 200, unit: 'g' },
      ],
      tags: [],
    });
    const veg = recipeFactory.create({
      name: 'Ensalada',
      ingredients: [],
      tags: [],
    });
    const result = applyChipFilter([camaronRecipe, veg], seafoodChip);
    expect(result.map((r) => r.id)).toEqual([veg.id]);
  });
});
