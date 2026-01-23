/**
 * Ingredient Normalization
 *
 * Provides bilingual ingredient alias resolution for reliable search,
 * allergen matching, and food safety checks.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface IngredientAlias {
  canonical: string;
  alias: string;
  language: string;
}

/**
 * In-memory cache of ingredient aliases
 * Loaded once at startup for fast lookups
 */
let aliasCache: Map<string, string> | null = null;

/**
 * Load ingredient aliases from database and cache them
 */
export async function loadIngredientAliases(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  if (aliasCache) {
    return aliasCache;
  }

  const { data, error } = await supabase
    .from('ingredient_aliases')
    .select('canonical, alias');

  if (error) {
    console.error('Failed to load ingredient aliases:', error);
    return new Map();
  }

  aliasCache = new Map(
    data.map((row: IngredientAlias) => [
      row.alias.toLowerCase(),
      row.canonical,
    ]),
  );

  console.log(`Loaded ${aliasCache.size} ingredient aliases`);
  return aliasCache;
}

/**
 * Normalize an ingredient name to its canonical form
 *
 * Examples:
 * - "bell pepper" → "bell_pepper"
 * - "pimiento" → "bell_pepper"
 * - "cilantro" → "coriander"
 */
export async function normalizeIngredient(
  supabase: SupabaseClient,
  input: string,
): Promise<string> {
  const aliases = await loadIngredientAliases(supabase);
  const lower = input.toLowerCase().trim();

  return aliases.get(lower) || lower;
}

/**
 * Normalize multiple ingredients at once
 */
export async function normalizeIngredients(
  supabase: SupabaseClient,
  inputs: string[],
): Promise<string[]> {
  const aliases = await loadIngredientAliases(supabase);

  return inputs.map((input) => {
    const lower = input.toLowerCase().trim();
    return aliases.get(lower) || lower;
  });
}

/**
 * Clear the ingredient alias cache (useful for tests or reloading)
 */
export function clearIngredientCache(): void {
  aliasCache = null;
}

/**
 * Get all aliases for a canonical ingredient (reverse lookup)
 * Useful for generating search queries
 */
export async function getAliasesForIngredient(
  supabase: SupabaseClient,
  canonical: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('ingredient_aliases')
    .select('alias')
    .eq('canonical', canonical);

  if (error || !data) {
    return [];
  }

  return data.map((row: { alias: string }) => row.alias);
}
