import { CUISINE_PREFERENCES, CuisinePreference, DIET_TYPES, DietType } from '@/types/dietary';

interface NormalizedPreferences {
  dietTypes: DietType[];
  cuisinePreferences: CuisinePreference[];
  otherDiet: string[];
}

/**
 * Legacy migration helper for persisted pre-rebuild diet preferences.
 */
export function normalizeDietAndCuisinePreferences(
  dietTypes: string[] = [],
  cuisinePreferences: string[] = [],
  otherDiet: string[] = [],
): NormalizedPreferences {
  const uniqueCuisinePreferences = Array.from(
    new Set(cuisinePreferences.filter(isCuisinePreference)),
  );
  const normalizedDietTypes: DietType[] = [];
  let normalizedCuisinePreferences = uniqueCuisinePreferences;
  let shouldClearOtherDiet = false;

  for (const dietType of dietTypes) {
    if (dietType === 'none') {
      continue;
    }

    if (dietType === 'other') {
      shouldClearOtherDiet = true;
      continue;
    }

    if (dietType === 'mediterranean') {
      if (!normalizedCuisinePreferences.includes('mediterranean')) {
        normalizedCuisinePreferences = [...normalizedCuisinePreferences, 'mediterranean'];
      }
      continue;
    }

    const mappedDietType = mapLegacyDietType(dietType);
    if (mappedDietType && !normalizedDietTypes.includes(mappedDietType)) {
      normalizedDietTypes.push(mappedDietType);
    }
  }

  return {
    dietTypes: normalizedDietTypes,
    cuisinePreferences: normalizedCuisinePreferences,
    otherDiet: shouldClearOtherDiet ? [] : otherDiet,
  };
}

function mapLegacyDietType(dietType: string): DietType | null {
  if (isDietType(dietType)) return dietType;

  switch (dietType) {
    case 'lactoVegetarian':
    case 'ovoVegetarian':
      return 'vegetarian';
    case 'sugarFree':
      return 'low_sugar';
    default:
      return null;
  }
}

function isDietType(value: string): value is DietType {
  return (DIET_TYPES as readonly string[]).includes(value);
}

function isCuisinePreference(value: string): value is CuisinePreference {
  return (CUISINE_PREFERENCES as readonly string[]).includes(value);
}
