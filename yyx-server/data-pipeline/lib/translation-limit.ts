/**
 * Translation limit helpers.
 *
 * Enforces a single global limit across ingredient/useful-item/tag batches.
 */

export interface TranslationLimitAllocation {
  ingredientCount: number;
  usefulItemCount: number;
  tagCount: number;
  total: number;
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.floor(limit);
}

export function allocateTranslationLimit(
  ingredientCandidates: number,
  usefulItemCandidates: number,
  tagCandidates: number,
  limit: number,
): TranslationLimitAllocation {
  let remaining = clampLimit(limit);

  const ingredientCount = Math.min(Math.max(ingredientCandidates, 0), remaining);
  remaining -= ingredientCount;

  const usefulItemCount = Math.min(Math.max(usefulItemCandidates, 0), remaining);
  remaining -= usefulItemCount;

  const tagCount = Math.min(Math.max(tagCandidates, 0), remaining);

  return {
    ingredientCount,
    usefulItemCount,
    tagCount,
    total: ingredientCount + usefulItemCount + tagCount,
  };
}
