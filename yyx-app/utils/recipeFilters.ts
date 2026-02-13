import { Recipe } from '@/types/recipe.types';
import { UserProfile } from '@/types/user';

/**
 * Filter recipes with short total cook time (quick weeknight dinners).
 */
export function filterQuick(recipes: Recipe[], maxMinutes: number): Recipe[] {
  return recipes
    .filter(r => r.totalTime != null && r.totalTime <= maxMinutes)
    .slice(0, 10);
}

/**
 * Filter recipes matching user's dietary preferences (diet types + tags).
 * Falls back to first 10 recipes if no diet preferences set.
 */
export function filterByDiet(recipes: Recipe[], userProfile: UserProfile | null): Recipe[] {
  const dietTypes = userProfile?.dietTypes ?? [];
  if (dietTypes.length === 0) return recipes.slice(0, 10);

  const dietNames = new Set(dietTypes.map(d => d.toLowerCase()));

  return recipes
    .filter(r => {
      if (!r.tags?.length) return false;
      return r.tags.some(tag =>
        dietNames.has(tag.name.toLowerCase()) ||
        (tag.categories ?? []).some(cat => dietNames.has(cat.toLowerCase()))
      );
    })
    .slice(0, 10);
}

/**
 * Filter recipes suitable for families (4+ portions).
 */
export function filterFamily(recipes: Recipe[], minPortions: number): Recipe[] {
  return recipes
    .filter(r => r.portions != null && r.portions >= minPortions)
    .slice(0, 10);
}

/**
 * Filter recently added recipes (within N days).
 */
export function filterRecent(recipes: Recipe[], days: number): Recipe[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return recipes
    .filter(r => new Date(r.createdAt) >= cutoffDate)
    .slice(0, 10);
}
