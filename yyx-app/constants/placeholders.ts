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
   * Placeholder for recipe images — reuses ingredient placeholder.
   * Recipe hero images collapse when missing rather than showing a placeholder.
   */
  recipe: require('@/assets/placeholders/ingredient-placeholder.png'),

  /**
   * Placeholder for kitchen tool images
   * Used in: Kitchen tool cards, Cooking Guide mise en place
   *
   * TODO: Replace with actual kitchen tool placeholder image
   */
  kitchenTool: require('@/assets/placeholders/kitchen-tool-placeholder.png'),
} as const;

/**
 * Type for placeholder image keys
 */
export type PlaceholderType = keyof typeof PLACEHOLDER_IMAGES;
