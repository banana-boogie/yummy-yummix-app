/**
 * dietarySafety
 *
 * Shared keyword-based filter that removes recipes violating a user's
 * dietary restrictions or allergies. Used by both the sectioned Explore
 * feed and the search-results path so a Lupita with a shellfish allergy
 * never sees shrimp whether she's browsing or searching.
 *
 * This is a best-effort client-side guard. A server-backed allergen RPC
 * is tracked separately. Keywords cover both English and Mexican Spanish
 * since those are our two locale groups.
 */

import type { Recipe } from '@/types/recipe.types';
import type { UserProfile } from '@/types/user';
import type { DietaryRestriction } from '@/types/dietary';

/**
 * Lowercase token set from a recipe's searchable fields used for
 * matching against restriction / diet keywords.
 */
export function recipeKeywords(recipe: Recipe): Set<string> {
  const tokens = new Set<string>();
  const push = (s: string | undefined | null) => {
    if (!s) return;
    s.toLowerCase()
      .split(/[^a-z0-9áéíóúñü]+/i)
      .filter(Boolean)
      .forEach((t) => tokens.add(t.toLowerCase()));
  };
  push(recipe.name);
  push(recipe.description);
  (recipe.tags ?? []).forEach((t) => {
    push(t.name);
    (t.categories ?? []).forEach((c) => push(c));
  });
  (recipe.ingredients ?? []).forEach((ing) => push(ing.name));
  return tokens;
}

/**
 * Keyword lookup for each restriction group. Covers EN + ES-MX tokens
 * since we don't cross-fall-back between languages.
 */
export const RESTRICTION_KEYWORDS: Record<DietaryRestriction, string[]> = {
  none: [],
  nuts: [
    'nut', 'nuts', 'almond', 'almonds', 'walnut', 'walnuts', 'pecan', 'pecans',
    'cashew', 'cashews', 'hazelnut', 'hazelnuts', 'pistachio', 'pistachios',
    'peanut', 'peanuts',
    // ES
    'nuez', 'nueces', 'almendra', 'almendras', 'avellana', 'avellanas',
    'pistache', 'pistaches', 'cacahuate', 'cacahuates', 'cacahuete', 'cacahuetes',
  ],
  dairy: [
    'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'dairy',
    // ES
    'leche', 'queso', 'mantequilla', 'crema', 'yogur', 'lácteo', 'lacteo',
    'lácteos', 'lacteos',
  ],
  eggs: [
    'egg', 'eggs',
    // ES
    'huevo', 'huevos',
  ],
  seafood: [
    'fish', 'shrimp', 'prawn', 'prawns', 'salmon', 'tuna', 'shellfish',
    'seafood', 'crab', 'lobster',
    // ES
    'pescado', 'pescados', 'camarón', 'camaron', 'camarones', 'mariscos',
    'marisco', 'atún', 'atun', 'salmón', 'salmon', 'cangrejo', 'langosta',
  ],
  gluten: [
    'wheat', 'flour', 'bread', 'pasta', 'gluten',
    // ES
    'trigo', 'harina', 'pan', 'pastas',
  ],
  other: [],
};

function violatesRestrictions(
  recipe: Recipe,
  restrictions: DietaryRestriction[],
  otherAllergies: string[],
): boolean {
  if (!restrictions.length && !otherAllergies.length) return false;
  const keywords = recipeKeywords(recipe);
  for (const r of restrictions) {
    if (r === 'none') continue;
    const kws = RESTRICTION_KEYWORDS[r] ?? [];
    if (kws.some((k) => keywords.has(k))) return true;
  }
  for (const raw of otherAllergies) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    if (keywords.has(token)) return true;
  }
  return false;
}

/**
 * Remove recipes that violate the user's dietary restrictions or listed
 * allergies. Returns the input unchanged when the profile has no
 * restrictions.
 */
export function filterByDietarySafety(
  recipes: Recipe[],
  profile: UserProfile | null,
): Recipe[] {
  if (!profile) return recipes;
  const restrictions = profile.dietaryRestrictions ?? [];
  const other = profile.otherAllergy ?? [];
  if (!restrictions.length && !other.length) return recipes;
  return recipes.filter((r) => !violatesRestrictions(r, restrictions, other));
}
