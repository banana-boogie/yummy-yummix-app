/**
 * Allergen Filter
 *
 * Rule-based allergen filtering for recipes.
 * Uses database-sourced allergen groups with bilingual support
 * and word-boundary matching to avoid false positives.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { AllergenEntry } from "./irmixy-schemas.ts";
import { normalizeIngredient } from "./ingredient-normalization.ts";
import { getBaseLanguage } from "./locale-utils.ts";

/**
 * In-memory cache of allergen data
 */
let allergenCache: AllergenEntry[] | null = null;

/**
 * Promise guard to prevent duplicate concurrent DB fetches.
 * When multiple parallel calls to loadAllergenGroups() occur,
 * only the first initiates a DB fetch - others await the same promise.
 */
let loadingPromise: Promise<AllergenEntry[]> | null = null;

/**
 * Load allergen groups from database
 */
export async function loadAllergenGroups(
  supabase: SupabaseClient,
): Promise<AllergenEntry[]> {
  if (allergenCache) {
    return allergenCache;
  }

  // Prevent duplicate concurrent DB fetches
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const { data, error } = await supabase
      .from("allergen_groups")
      .select("category, ingredient_canonical, name_en, name_es");

    if (error) {
      console.error("Failed to load allergen groups:", error);
      loadingPromise = null;
      return [];
    }

    // Map the old name_en/name_es columns to locale-keyed names
    allergenCache = (data || []).map(
      (row: {
        category: string;
        ingredient_canonical: string;
        name_en: string;
        name_es: string;
      }) => ({
        category: row.category,
        ingredient_canonical: row.ingredient_canonical,
        names: {
          en: row.name_en,
          es: row.name_es,
        },
      }),
    );
    loadingPromise = null;
    console.log(`Loaded ${allergenCache.length} allergen entries`);
    return allergenCache;
  })();

  return loadingPromise;
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
export function matchesAllergen(
  normalizedIngredient: string,
  allergen: string,
): boolean {
  // Escape regex special characters in the allergen name
  const escaped = allergen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Replace underscores with flexible separator pattern for matching
  const pattern = escaped.replace(/_/g, "[\\s_-]");
  // Word boundary: start/end of string OR whitespace/separator characters
  const regex = new RegExp(`(^|[\\s,_-])${pattern}([\\s,_-]|$)`, "i");
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
  T extends {
    id: string;
    ingredientNames: string[];
  },
>(
  supabase: SupabaseClient,
  recipes: T[],
  userRestrictions: string[],
  locale: string = "en",
): Promise<T[]> {
  if (userRestrictions.length === 0) {
    return recipes;
  }

  const allergenMap = await getAllergenMap(supabase);
  if (allergenMap.size === 0) {
    console.error(
      "Allergen map is empty; failing safe (returning no recipes for restricted user).",
    );
    return [];
  }

  // Pre-normalize all unique ingredient names in parallel
  const allNames = [
    ...new Set(recipes.flatMap((r) => r.ingredientNames).filter(Boolean)),
  ];
  const normalizedEntries = await Promise.all(
    allNames.map(async (name) =>
      [
        name,
        await normalizeIngredient(supabase, name, locale),
      ] as const
    ),
  );
  const normalizedMap = new Map(normalizedEntries);

  const results: T[] = [];
  for (const recipe of recipes) {
    let safe = true;

    for (const ingredientName of recipe.ingredientNames) {
      if (!ingredientName) continue;

      const normalized = normalizedMap.get(ingredientName) ?? ingredientName;

      for (const restriction of userRestrictions) {
        const allergens = allergenMap.get(restriction) || [];

        for (const allergen of allergens) {
          if (
            normalized === allergen || matchesAllergen(normalized, allergen)
          ) {
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
  locale: string = "en",
): Promise<{
  safe: boolean;
  allergen?: string;
  category?: string;
  systemUnavailable?: boolean;
}> {
  if (userRestrictions.length === 0) {
    return { safe: true };
  }

  const allergenMap = await getAllergenMap(supabase);
  if (allergenMap.size === 0) {
    // Fail-safe: if we cannot verify allergens, block generation for restricted users.
    console.error(
      "Allergen map is empty; failing safe (cannot verify restricted ingredient).",
    );
    return {
      safe: false,
      category: "system_unavailable",
      systemUnavailable: true,
    };
  }
  const normalized = await normalizeIngredient(
    supabase,
    ingredientName,
    locale,
  );

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
  locale: string,
): Promise<string> {
  const allergens = await loadAllergenGroups(supabase);
  const baseLang = getBaseLanguage(locale);

  const entry = allergens.find(
    (a) => a.ingredient_canonical === allergen,
  );

  if (!entry) {
    return baseLang === "es"
      ? `Contiene ${allergen.replace(/_/g, " ")}`
      : `Contains ${allergen.replace(/_/g, " ")}`;
  }

  const allergenName = entry.names[baseLang] || entry.names["en"] ||
    allergen.replace(/_/g, " ");

  return baseLang === "es"
    ? `Advertencia: Contiene ${allergenName} (${category})`
    : `Warning: Contains ${allergenName} (${category})`;
}

/**
 * Get the localized name for an allergen entry.
 */
export function getLocalizedAllergenName(
  allergenEntries: AllergenEntry[],
  allergen: string,
  locale: string,
): string {
  const baseLang = getBaseLanguage(locale);
  const entry = allergenEntries.find(
    (a) => a.ingredient_canonical === allergen,
  );
  if (!entry) return allergen.replace(/_/g, " ");
  return entry.names[baseLang] || entry.names["en"] ||
    allergen.replace(/_/g, " ");
}

/**
 * Clear allergen cache (useful for tests or reloading)
 */
export function clearAllergenCache(): void {
  allergenCache = null;
  loadingPromise = null;
}
