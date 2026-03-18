/**
 * Translation limit helpers.
 *
 * Enforces a single global limit across ingredient/useful-item/tag batches.
 */

export interface TranslationLimitAllocation {
  ingredientCount: number;
  kitchenToolCount: number;
  tagCount: number;
  total: number;
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.floor(limit);
}

export function allocateTranslationLimit(
  ingredientCandidates: number,
  kitchenToolCandidates: number,
  tagCandidates: number,
  limit: number,
): TranslationLimitAllocation {
  let remaining = clampLimit(limit);

  const ingredientCount = Math.min(Math.max(ingredientCandidates, 0), remaining);
  remaining -= ingredientCount;

  const kitchenToolCount = Math.min(Math.max(kitchenToolCandidates, 0), remaining);
  remaining -= kitchenToolCount;

  const tagCount = Math.min(Math.max(tagCandidates, 0), remaining);

  return {
    ingredientCount,
    kitchenToolCount,
    tagCount,
    total: ingredientCount + kitchenToolCount + tagCount,
  };
}
