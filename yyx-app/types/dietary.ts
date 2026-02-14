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

export type DietaryIcons = {
  [K in DietaryRestriction]: number;
};

export type DietTypeIcons = {
  [K in DietType]: number;
};

export type CuisineIcons = {
  [K in CuisinePreference]: number;
}; 