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
  'mediterranean',
  'ovoVegetarian',
  'paleo',
  'pescatarian',
  'sugarFree',
  'vegan',
  'vegetarian',
  'other'
] as const;

export type DietType = typeof DIET_TYPES[number];

// Icon mapping types
export type DietaryIcons = {
  [K in DietaryRestriction]: number;
};

export type DietTypeIcons = {
  [K in DietType]: number;
}; 