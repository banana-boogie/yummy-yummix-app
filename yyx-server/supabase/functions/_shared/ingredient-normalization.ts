/**
 * Ingredient Normalization
 *
 * Bilingual ingredient alias resolution using a language-aware cache.
 * Maps EN/ES ingredient names to canonical forms for reliable
 * search, allergen matching, and food safety checks.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getBaseLanguage } from "./locale-utils.ts";

/**
 * Language-aware alias cache.
 * Key format: "${alias_lowercase}::${locale}"
 * Value: canonical ingredient name
 */
let aliasCache: Map<string, string> | null = null;

/**
 * Promise guard to prevent duplicate concurrent DB fetches.
 * When multiple parallel calls to normalizeIngredient() occur,
 * only the first initiates a DB fetch - others await the same promise.
 */
let loadingPromise: Promise<Map<string, string>> | null = null;

/**
 * Load all ingredient aliases from DB into the cache.
 * Uses composite key: alias::locale for locale-aware lookups.
 */
async function loadAliases(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  if (aliasCache) {
    return aliasCache;
  }

  // Prevent duplicate concurrent DB fetches
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const { data, error } = await supabase
      .from("ingredient_aliases")
      .select("canonical, alias, locale");

    if (error) {
      console.error("Failed to load ingredient aliases:", error);
      loadingPromise = null;
      return new Map();
    }

    aliasCache = new Map();
    for (const row of data || []) {
      const key = `${row.alias.toLowerCase()}::${row.locale}`;
      aliasCache.set(key, row.canonical);
    }

    loadingPromise = null;
    console.log(`Loaded ${aliasCache.size} ingredient alias entries`);
    return aliasCache;
  })();

  return loadingPromise;
}

/**
 * Normalize a single ingredient name to its canonical form.
 *
 * Lookup order:
 * 1. Try exact match with specified language: "${input}::${language}"
 * 2. Try English fallback: "${input}::en"
 * 3. Try Spanish fallback: "${input}::es"
 * 4. Return input unchanged (lowercased, trimmed)
 *
 * @param supabase - Supabase client for DB access
 * @param name - Ingredient name to normalize
 * @param language - Preferred language for lookup ('en' or 'es')
 * @returns Canonical ingredient name
 */
export async function normalizeIngredient(
  supabase: SupabaseClient,
  name: string,
  locale: string = "en",
): Promise<string> {
  const aliases = await loadAliases(supabase);
  const lower = name.toLowerCase().trim();
  const baseLang = getBaseLanguage(locale);

  // Try locale-specific match first (using base language since aliases use 'en'/'es')
  const langKey = `${lower}::${baseLang}`;
  if (aliases.has(langKey)) {
    return aliases.get(langKey)!;
  }

  // Try English fallback
  if (baseLang !== "en") {
    const enKey = `${lower}::en`;
    if (aliases.has(enKey)) {
      return aliases.get(enKey)!;
    }
  }

  // Try Spanish fallback
  if (baseLang !== "es") {
    const esKey = `${lower}::es`;
    if (aliases.has(esKey)) {
      return aliases.get(esKey)!;
    }
  }

  // No match found - return lowercased input
  return lower;
}

/**
 * Normalize multiple ingredient names to canonical forms.
 *
 * @param supabase - Supabase client for DB access
 * @param names - Array of ingredient names
 * @param language - Preferred language for lookup
 * @returns Array of canonical ingredient names
 */
export async function normalizeIngredients(
  supabase: SupabaseClient,
  names: string[],
  locale: string = "en",
): Promise<string[]> {
  return Promise.all(
    names.map((name) => normalizeIngredient(supabase, name, locale)),
  );
}

/**
 * Clear the alias cache. Useful for testing or when aliases are updated.
 */
export function clearAliasCache(): void {
  aliasCache = null;
  loadingPromise = null;
}
