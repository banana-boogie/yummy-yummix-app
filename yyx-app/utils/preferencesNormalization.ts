import { CuisinePreference, DietType, LEGACY_DIET_TYPE_MEDITERRANEAN } from '@/types/dietary';

interface NormalizedPreferences {
  dietTypes: DietType[];
  cuisinePreferences: CuisinePreference[];
}

/**
 * Legacy migration helper:
 * "mediterranean" used to live in dietTypes and now belongs to cuisinePreferences.
 */
export function normalizeDietAndCuisinePreferences(
  dietTypes: DietType[] = [],
  cuisinePreferences: CuisinePreference[] = []
): NormalizedPreferences {
  const uniqueDietTypes = Array.from(new Set(dietTypes));
  const uniqueCuisinePreferences = Array.from(new Set(cuisinePreferences));
  const hasLegacyMediterranean = uniqueDietTypes.includes(LEGACY_DIET_TYPE_MEDITERRANEAN);

  const normalizedDietTypes = uniqueDietTypes.filter(
    (dietType) => dietType !== LEGACY_DIET_TYPE_MEDITERRANEAN
  );

  const normalizedCuisinePreferences: CuisinePreference[] =
    hasLegacyMediterranean && !uniqueCuisinePreferences.includes('mediterranean')
      ? [...uniqueCuisinePreferences, 'mediterranean' as CuisinePreference]
      : uniqueCuisinePreferences;

  return {
    dietTypes: normalizedDietTypes,
    cuisinePreferences: normalizedCuisinePreferences,
  };
}
