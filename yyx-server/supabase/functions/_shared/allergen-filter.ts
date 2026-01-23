/**
 * Allergen Filter
 *
 * Rule-based allergen filtering for recipes.
 * Uses database-sourced allergen groups with bilingual support
 * and word-boundary matching to avoid false positives.
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
    list.push(entry.ingredient_canonical);
    map.set(entry.category, list);
  }

  return map;
}

/**
 * Check if a normalized ingredient matches an allergen using word-boundary matching.
 * Prevents false positives like "egg" matching "eggplant".
 */
function matchesAllergen(normalizedIngredient: string, allergen: string): boolean {
  // Escape regex special characters in the allergen name
  const escaped = allergen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Replace underscores with flexible separator pattern for matching
  const pattern = escaped.replace(/_/g, '[\\s_-]');
  // Word boundary: start/end of string OR whitespace/separator characters
  const regex = new RegExp(`(^|[\\s,_-])${pattern}([\\s,_-]|$)`, 'i');
  return regex.test(normalizedIngredient);
}

/**
 * Filter recipes by user's dietary restrictions (allergen-based).
 * Uses normalization + word-boundary matching for reliable detection.
 *
 * @param supabase - Supabase client
 * @param recipes - Array of recipes with bilingual ingredients
 * @param userRestrictions - Array of restriction categories (e.g., ['nuts', 'dairy'])
 * @param language - User's language for normalization
 * @returns Filtered recipes that don't contain restricted allergens
 */
export async function filterByAllergens<
  T extends { id: string; ingredients: Array<{ name_en: string; name_es: string }> },
>(
  supabase: SupabaseClient,
  recipes: T[],
  userRestrictions: string[],
  language: 'en' | 'es' = 'en',
): Promise<T[]> {
  if (userRestrictions.length === 0) {
    return recipes;
  }

  const allergenMap = await getAllergenMap(supabase);

  const results: T[] = [];
  for (const recipe of recipes) {
    let safe = true;

    for (const ingredient of recipe.ingredients) {
      // Use the appropriate language name for normalization
      const ingredientName = language === 'es' ? ingredient.name_es : ingredient.name_en;
      if (!ingredientName) continue;

      const normalized = await normalizeIngredient(supabase, ingredientName, language);

      for (const restriction of userRestrictions) {
        const allergens = allergenMap.get(restriction) || [];

        for (const allergen of allergens) {
          // Check if normalized ingredient matches the allergen
          if (normalized === allergen || matchesAllergen(normalized, allergen)) {
            safe = false;
            break;
          }
        }
        if (!safe) break;
      }
      if (!safe) break;
    }

    if (safe) {
      results.push(recipe);
    }
  }

  return results;
}

/**
 * Check if a single ingredient contains any restricted allergens.
 *
 * @returns { safe: boolean, allergen?: string, category?: string }
 */
export async function checkIngredientForAllergens(
  supabase: SupabaseClient,
  ingredientName: string,
  userRestrictions: string[],
  language: 'en' | 'es' = 'en',
): Promise<{
  safe: boolean;
  allergen?: string;
  category?: string;
}> {
  if (userRestrictions.length === 0) {
    return { safe: true };
  }

  const allergenMap = await getAllergenMap(supabase);
  const normalized = await normalizeIngredient(supabase, ingredientName, language);

  for (const restriction of userRestrictions) {
    const allergens = allergenMap.get(restriction) || [];

    for (const allergen of allergens) {
      if (normalized === allergen || matchesAllergen(normalized, allergen)) {
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
 * Get user-facing allergen warning in appropriate language.
 */
export async function getAllergenWarning(
  supabase: SupabaseClient,
  allergen: string,
  category: string,
  language: 'en' | 'es',
): Promise<string> {
  const allergens = await loadAllergenGroups(supabase);

  const entry = allergens.find(
    (a) => a.ingredient_canonical === allergen,
  );

  if (!entry) {
    return language === 'es'
      ? `Contiene ${allergen.replace(/_/g, ' ')}`
      : `Contains ${allergen.replace(/_/g, ' ')}`;
  }

  const allergenName = language === 'es' ? entry.name_es : entry.name_en;

  return language === 'es'
    ? `Advertencia: Contiene ${allergenName} (${category})`
    : `Warning: Contains ${allergenName} (${category})`;
}

/**
 * Clear allergen cache (useful for tests or reloading)
 */
export function clearAllergenCache(): void {
  allergenCache = null;
}
