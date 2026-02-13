// ============================================================
// Legacy constants - kept for backwards compatibility
// New code should use database-driven options via preferencesService
// ============================================================

export const DIETARY_RESTRICTIONS = [
  'none',
  'nuts',
  'dairy',
  'eggs',
  'seafood',
  'gluten',
  'other'
] as const;

export type DietaryRestriction = typeof DIETARY_RESTRICTIONS[number];

export const DIET_TYPES = [
  'none',
  'keto',
  'lactoVegetarian',
  'mediterranean', // Deprecated: moved to cuisine_preferences, kept for backwards compatibility
  'ovoVegetarian',
  'paleo',
  'pescatarian',
  'sugarFree',
  'vegan',
  'vegetarian',
  'other'
] as const;

export type DietType = typeof DIET_TYPES[number];

// ============================================================
// New database-driven types
// ============================================================

/**
 * A preference option fetched from the database.
 * Used for food_allergies, diet_types, and cuisine_preferences tables.
 */
export interface PreferenceOption {
  id: string;
  slug: string;
  name: string; // Localized name based on user's language
  iconName?: string;
}

/**
 * Cuisine preference slugs.
 * These are SOFT preferences that inspire recipe generation.
 */
export const CUISINE_PREFERENCES = [
  'mediterranean',
  'italian',
  'mexican',
  'asian',
  'japanese',
  'chinese',
  'thai',
  'indian',
  'middle_eastern',
  'greek',
  'spanish',
  'french',
  'american',
] as const;

export type CuisinePreference = typeof CUISINE_PREFERENCES[number];

// ============================================================
// Icon mapping types
// ============================================================

export type DietaryIcons = {
  [K in DietaryRestriction]: number;
};

export type DietTypeIcons = {
  [K in DietType]: number;
};

export type CuisineIcons = {
  [K in CuisinePreference]: number;
}; 