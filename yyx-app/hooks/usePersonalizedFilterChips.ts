/**
 * usePersonalizedFilterChips
 *
 * Generates up to 5 filter chips for the Explore page based on the user's
 * profile plus the actual catalog coverage in the already-fetched recipe
 * list. Cuisine / diet chips are only shown when the catalog has enough
 * recipes to make the chip useful (≥5).
 */

import { useMemo } from 'react';
import i18n from '@/i18n';
import type { Recipe } from '@/types/recipe.types';
import type { UserProfile } from '@/types/user';
import type { DietaryRestriction } from '@/types/dietary';
import type { FilterChip } from '@/components/recipe/FilterChips';
import { RESTRICTION_KEYWORDS, recipeKeywords } from '@/utils/dietarySafety';

const CUISINE_COUNT_THRESHOLD = 5;

function recipeHasKeyword(recipe: Recipe, keyword: string): boolean {
  const k = keyword.toLowerCase();
  if ((recipe.name ?? '').toLowerCase().includes(k)) return true;
  if ((recipe.tags ?? []).some((t) => t.name.toLowerCase().includes(k))) return true;
  if (
    (recipe.tags ?? []).some((t) =>
      (t.categories ?? []).some((c) => c.toLowerCase().includes(k)),
    )
  ) {
    return true;
  }
  return false;
}

function countRecipesMatching(recipes: Recipe[], keyword: string): number {
  let n = 0;
  for (const r of recipes) {
    if (recipeHasKeyword(r, keyword)) n += 1;
  }
  return n;
}

function chipLabel(key: string, fallback: string): string {
  const translated = i18n.t(`recipes.filters.${key}`);
  // i18n-js returns `[missing "..."]` for missing keys; fall back gracefully.
  return translated.startsWith('[missing') ? fallback : translated;
}

export function usePersonalizedFilterChips(
  recipes: Recipe[],
  userProfile: UserProfile | null,
): FilterChip[] {
  return useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];

    // 1. Always: Quick
    chips.push({
      id: 'quick',
      label: chipLabel('quick', 'Quick'),
      filter: { maxTime: 30 },
    });

    // 2. Up to 2 preferred cuisines with ≥5 recipes in the catalog
    const cuisines = userProfile?.cuisinePreferences ?? [];
    let addedCuisines = 0;
    for (const cuisine of cuisines) {
      if (addedCuisines >= 2) break;
      if (countRecipesMatching(recipes, cuisine) >= CUISINE_COUNT_THRESHOLD) {
        chips.push({
          id: `cuisine_${cuisine}`,
          label: chipLabel(cuisine, cuisine.charAt(0).toUpperCase() + cuisine.slice(1)),
          filter: { cuisine },
        });
        addedCuisines += 1;
      }
    }

    // 3. One dietary chip if the user has a relevant restriction.
    // Filter is "exclude recipes containing the restriction keywords" —
    // matches the dietary-safety filter the page already applies by default,
    // but lets the user toggle it off (or apply it on top of the broader
    // catalog if the safety filter is ever loosened).
    const restrictions = (userProfile?.dietaryRestrictions ?? []).filter(
      (r) => r !== 'none' && r !== 'other',
    ) as Exclude<DietaryRestriction, 'none' | 'other'>[];
    if (restrictions.length > 0) {
      const primaryRestriction = restrictions[0];
      const labelKey = `${primaryRestriction}_free`;
      chips.push({
        id: `diet_${primaryRestriction}`,
        label: chipLabel(labelKey, primaryRestriction),
        filter: { excludeRestriction: primaryRestriction },
      });
    } else {
      // Surface a diet type preference chip as a softer signal
      const dietTypes = userProfile?.dietTypes ?? [];
      const primaryDiet = dietTypes.find((d) => d !== 'none' && d !== 'other');
      if (primaryDiet) {
        chips.push({
          id: `diet_${primaryDiet}`,
          label: chipLabel(primaryDiet, primaryDiet),
          filter: { dietType: primaryDiet },
        });
      }
    }

    // 4. Easy chip — no explicit cooking-level profile field yet, skip.

    // Cap at 5 before returning
    return chips.slice(0, 5);
  }, [recipes, userProfile]);
}

/**
 * Apply a chip filter to the "all_recipes" section of an Explore section
 * list. If the filter produces zero results, the section is dropped
 * entirely so callers don't render a lonely header.
 */
export function applyChipToSections<
  S extends { id: string; recipes: Recipe[] },
>(sections: S[], chip: FilterChip | null): S[] {
  if (!chip) return sections;
  return sections.flatMap((section) => {
    if (section.id !== 'all_recipes') return [section];
    const filtered = applyChipFilter(section.recipes, chip);
    if (filtered.length === 0) return [];
    return [{ ...section, recipes: filtered }];
  });
}

/**
 * Apply a chip filter predicate to a recipe list. Pure client-side
 * filtering — server-side filtering is a follow-up.
 */
export function applyChipFilter(recipes: Recipe[], chip: FilterChip | null): Recipe[] {
  if (!chip) return recipes;
  const { filter } = chip;
  const excludeKeywords = filter.excludeRestriction
    ? RESTRICTION_KEYWORDS[filter.excludeRestriction as keyof typeof RESTRICTION_KEYWORDS] ?? []
    : null;
  return recipes.filter((r) => {
    if (filter.maxTime != null && (r.totalTime == null || r.totalTime > filter.maxTime)) {
      return false;
    }
    if (filter.difficulty && r.difficulty !== filter.difficulty) return false;
    if (filter.cuisine && !recipeHasKeyword(r, filter.cuisine)) return false;
    if (filter.dietType && !recipeHasKeyword(r, filter.dietType)) return false;
    if (filter.mealType && !recipeHasKeyword(r, filter.mealType)) return false;
    if (excludeKeywords && excludeKeywords.length > 0) {
      const tokens = recipeKeywords(r);
      if (excludeKeywords.some((kw) => tokens.has(kw))) return false;
    }
    return true;
  });
}
