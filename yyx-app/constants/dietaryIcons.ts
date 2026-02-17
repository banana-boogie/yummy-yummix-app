import { DietaryIcons, DietTypeIcons, CuisineIcons } from '@/types/dietary';

export const DIETARY_RESTRICTION_ICONS: DietaryIcons = {
  none: require('@/assets/images/dietary/common/thumbs-up.png'),
  nuts: require('@/assets/images/dietary/restrictions/nut-allergy.png'),
  dairy: require('@/assets/images/dietary/restrictions/dairy-allergy.png'),
  eggs: require('@/assets/images/dietary/restrictions/egg-allergy.png'),
  seafood: require('@/assets/images/dietary/restrictions/seafood-allergy.png'),
  gluten: require('@/assets/images/dietary/restrictions/gluten-allergy.png'),
  other: require('@/assets/images/dietary/common/plus.png'),
} as const;

export const DIET_TYPE_ICONS: DietTypeIcons = {
  none: require('@/assets/images/dietary/common/thumbs-up.png'),
  keto: require('@/assets/images/dietary/types/keto-diet.png'),
  lactoVegetarian: require('@/assets/images/dietary/types/lacto-vegetarian-diet.png'),
  mediterranean: require('@/assets/images/dietary/types/mediterranean-diet.png'), // Kept for backwards compatibility
  ovoVegetarian: require('@/assets/images/dietary/types/ovo-vegetarian-diet.png'),
  paleo: require('@/assets/images/dietary/types/paleo-diet.png'),
  pescatarian: require('@/assets/images/dietary/types/pescatarian-diet.png'),
  sugarFree: require('@/assets/images/dietary/types/sugar-free-diet.png'),
  vegan: require('@/assets/images/dietary/types/vegan-diet.png'),
  vegetarian: require('@/assets/images/dietary/types/vegetarian-diet.png'),
  other: require('@/assets/images/dietary/common/plus.png'),
} as const;

// Cuisine icons - for cooking style preferences
// Note: Uses mediterranean icon from types folder, plus placeholder for new cuisines
// TODO: Add proper cuisine-specific icons to assets/images/dietary/cuisines/
export const CUISINE_ICONS: CuisineIcons = {
  mediterranean: require('@/assets/images/dietary/types/mediterranean-diet.png'),
  italian: require('@/assets/images/dietary/cuisines/italian.png'),
  mexican: require('@/assets/images/dietary/cuisines/mexican.png'),
  asian: require('@/assets/images/dietary/cuisines/asian.png'),
  japanese: require('@/assets/images/dietary/cuisines/japanese.png'),
  chinese: require('@/assets/images/dietary/cuisines/chinese.png'),
  thai: require('@/assets/images/dietary/cuisines/thai.png'),
  indian: require('@/assets/images/dietary/cuisines/indian.png'),
  middle_eastern: require('@/assets/images/dietary/cuisines/middle-eastern.png'),
  greek: require('@/assets/images/dietary/cuisines/greek.png'),
  spanish: require('@/assets/images/dietary/cuisines/spanish.png'),
  french: require('@/assets/images/dietary/cuisines/french.png'),
  american: require('@/assets/images/dietary/cuisines/american.png'),
} as const;

// Safe icon getters
export const getDietaryRestrictionIcon = (restriction: string): number | undefined => {
  return DIETARY_RESTRICTION_ICONS[restriction as keyof typeof DIETARY_RESTRICTION_ICONS];
};

export const getDietTypeIcon = (dietType: string): number | undefined => {
  return DIET_TYPE_ICONS[dietType as keyof typeof DIET_TYPE_ICONS];
};

export const getCuisineIcon = (cuisine: string): number | undefined => {
  return CUISINE_ICONS[cuisine as keyof typeof CUISINE_ICONS];
};

/**
 * Get icon for any preference option by slug.
 * Looks up across all icon mappings (restrictions, diets, cuisines).
 * Falls back to thumbs-up if not found.
 */
export const getPreferenceIcon = (slug: string): number => {
  return (
    getDietaryRestrictionIcon(slug) ??
    getDietTypeIcon(slug) ??
    getCuisineIcon(slug) ??
    DIETARY_RESTRICTION_ICONS.none
  );
}; 