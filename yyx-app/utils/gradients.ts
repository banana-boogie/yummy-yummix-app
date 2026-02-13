/**
 * Gradient utility for cookbook covers
 *
 * Provides deterministic gradient color generation based on cookbook ID
 * to ensure consistent visual identity across the app.
 */

export const COOKBOOK_GRADIENTS: [string, string][] = [
  ['#FF9A9E', '#FECFEF'], // Pink sunset
  ['#a18cd1', '#fbc2eb'], // Purple dream
  ['#fa709a', '#fee140'], // Orange crush
  ['#ff9a9e', '#fecfef'], // Coral wave
  ['#f6d365', '#fda085'], // Golden hour
  ['#84fab0', '#8fd3f4'], // Mint breeze
  ['#a1c4fd', '#c2e9fb'], // Sky blue
  ['#cfd9df', '#e2ebf0'], // Silver mist
];

/**
 * Get a consistent gradient for a cookbook based on its ID
 *
 * @param cookbookId - The cookbook's unique identifier
 * @returns A tuple of two hex color codes [startColor, endColor]
 *
 * @example
 * const [startColor, endColor] = getGradientForCookbook('abc-123');
 * // Returns: ['#FF9A9E', '#FECFEF']
 */
export function getGradientForCookbook(cookbookId: string): [string, string] {
  if (!cookbookId) {
    return COOKBOOK_GRADIENTS[0];
  }

  // Generate deterministic index based on first and last character codes
  const charCode = cookbookId.charCodeAt(0) + cookbookId.charCodeAt(cookbookId.length - 1);
  const index = charCode % COOKBOOK_GRADIENTS.length;

  return COOKBOOK_GRADIENTS[index];
}
