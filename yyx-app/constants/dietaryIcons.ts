import { DietaryIcons, DietTypeIcons } from '@/types/dietary';

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
  mediterranean: require('@/assets/images/dietary/types/mediterranean-diet.png'),
  ovoVegetarian: require('@/assets/images/dietary/types/ovo-vegetarian-diet.png'),
  paleo: require('@/assets/images/dietary/types/paleo-diet.png'),
  pescatarian: require('@/assets/images/dietary/types/pescatarian-diet.png'),
  sugarFree: require('@/assets/images/dietary/types/sugar-free-diet.png'),
  vegan: require('@/assets/images/dietary/types/vegan-diet.png'),
  vegetarian: require('@/assets/images/dietary/types/vegetarian-diet.png'),
  other: require('@/assets/images/dietary/common/plus.png'),
} as const;

// Safe icon getters
export const getDietaryRestrictionIcon = (restriction: string): number | undefined => {
  return DIETARY_RESTRICTION_ICONS[restriction as keyof typeof DIETARY_RESTRICTION_ICONS];
};

export const getDietTypeIcon = (dietType: string): number | undefined => {
  return DIET_TYPE_ICONS[dietType as keyof typeof DIET_TYPE_ICONS];
}; 