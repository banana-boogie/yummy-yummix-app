/**
 * usePersonalizedFilterChips — applyChipToSections tests
 *
 * Focused on the "empty All Recipes after chip filter -> hide section"
 * behavior. Keeps the render-time UX clean so Lupita doesn't see an
 * orphan "All Recipes" header with nothing under it.
 */

import { applyChipToSections } from '../usePersonalizedFilterChips';
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
