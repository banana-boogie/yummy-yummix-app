/**
 * Placeholder Images
 *
 * These placeholders are used when actual images are not available.
 * Replace with actual placeholder images from designer.
 *
 * TODO: Replace temporary placeholders with actual designed images
 */

export const PLACEHOLDER_IMAGES = {
  /**
   * Placeholder for ingredient images
   * Used in: CustomRecipeCard, Cooking Guide
   *
   * TODO: Replace with actual ingredient placeholder image
   */
  ingredient: require('@/assets/placeholders/ingredient-placeholder.png'),

  /**
   * Placeholder for recipe images
   * Used in: Recipe cards, Cooking Guide headers
   *
   * TODO: Replace with actual recipe placeholder image
   */
  recipe: require('@/assets/placeholders/recipe-placeholder.png'),
} as const;

/**
 * Type for placeholder image keys
 */
export type PlaceholderType = keyof typeof PLACEHOLDER_IMAGES;
