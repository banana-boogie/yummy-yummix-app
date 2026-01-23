/**
 * Allergen Filter
 *
 * Rule-based allergen filtering for recipes.
 * Uses database-sourced allergen groups with bilingual support.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { AllergenEntry } from './irmixy-schemas.ts';
import { normalizeIngredient } from './ingredient-normalization.ts';

/**
 * In-memory cache of allergen data
 */
let allergenCache: AllergenEntry[] | null = null;

/**
 * Load allergen groups from database
 */
export async function loadAllergenGroups(
  supabase: SupabaseClient,
): Promise<AllergenEntry[]> {
  if (allergenCache) {
    return allergenCache;
  }

  const { data, error } = await supabase
    .from('allergen_groups')
    .select('category, ingredient_canonical, name_en, name_es');

  if (error) {
    console.error('Failed to load allergen groups:', error);
    return [];
  }

  allergenCache = data as AllergenEntry[];
  console.log(`Loaded ${allergenCache.length} allergen entries`);
  return allergenCache;
}

/**
 * Get allergen map: category -> list of canonical ingredient names
 */
export async function getAllergenMap(
  supabase: SupabaseClient,
): Promise<Map<string, string[]>> {
  const allergens = await loadAllergenGroups(supabase);

  const map = new Map<string, string[]>();
  for (const entry of allergens) {
    const list = map.get(entry.category) || [];
    list.push(entry.ingredientCanonical);
    map.set(entry.category, list);
  }

  return map;
}

/**
 * Filter recipes by user's dietary restrictions (allergen-based)
 *
 * @param recipes Array of recipes with ingredients
 * @param userRestrictions Array of restriction categories (e.g., ['nuts', 'dairy'])
 * @returns Filtered recipes that don't contain restricted allergens
 */
export async function filterByAllergens<
  T extends { id: string; ingredients: Array<{ name: string }> },
>(
  supabase: SupabaseClient,
  recipes: T[],
  userRestrictions: string[],
): Promise<T[]> {
  if (userRestrictions.length === 0) {
    return recipes;
  }

  const allergenMap = await getAllergenMap(supabase);

  return recipes.filter((recipe) => {
    // Normalize all ingredient names for comparison
    const ingredientNames = recipe.ingredients.map((i) => i.name);

    // Check each restriction
    for (const restriction of userRestrictions) {
      const allergens = allergenMap.get(restriction) || [];

      // Check if any recipe ingredient matches an allergen
      for (const ingredient of ingredientNames) {
        const normalizedIngredient = ingredient.toLowerCase();

        // Check if this ingredient contains any allergen
        const containsAllergen = allergens.some((allergen) => {
          return normalizedIngredient.includes(allergen.toLowerCase()) ||
            normalizedIngredient.includes(allergen.replace(/_/g, ' '));
        });

        if (containsAllergen) {
          return false; // Exclude this recipe
        }
      }
    }

    return true; // Recipe passed all allergen checks
  });
}

/**
 * Check if a single ingredient contains any restricted allergens
 *
 * @returns { safe: boolean, allergen?: string, category?: string }
 */
export async function checkIngredientForAllergens(
  supabase: SupabaseClient,
  ingredientName: string,
  userRestrictions: string[],
): Promise<{
  safe: boolean;
  allergen?: string;
  category?: string;
}> {
  if (userRestrictions.length === 0) {
    return { safe: true };
  }

  const allergenMap = await getAllergenMap(supabase);
  const normalized = await normalizeIngredient(supabase, ingredientName);

  for (const restriction of userRestrictions) {
    const allergens = allergenMap.get(restriction) || [];

    for (const allergen of allergens) {
      if (
        normalized.includes(allergen) ||
        normalized.includes(allergen.replace(/_/g, ' '))
      ) {
        return {
          safe: false,
          allergen,
          category: restriction,
        };
      }
    }
  }

  return { safe: true };
}

/**
 * Get user-facing allergen warning in appropriate language
 *
 * @returns Localized warning message
 */
export async function getAllergenWarning(
  supabase: SupabaseClient,
  allergen: string,
  category: string,
  language: 'en' | 'es',
): Promise<string> {
  const allergens = await loadAllergenGroups(supabase);

  const entry = allergens.find(
    (a) =>
      a.ingredientCanonical === allergen ||
      a.ingredientCanonical.replace(/_/g, ' ') === allergen,
  );

  if (!entry) {
    return language === 'es'
      ? `Contiene ${allergen}`
      : `Contains ${allergen}`;
  }

  const allergenName = language === 'es' ? entry.nameEs : entry.nameEn;
  const categoryName = category;

  return language === 'es'
    ? `Advertencia: Contiene ${allergenName} (${categoryName})`
    : `Warning: Contains ${allergenName} (${categoryName})`;
}

/**
 * Clear allergen cache (useful for tests or reloading)
 */
export function clearAllergenCache(): void {
  allergenCache = null;
}
