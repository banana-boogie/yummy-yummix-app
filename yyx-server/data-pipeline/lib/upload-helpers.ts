/**
 * Upload Helpers
 *
 * Pure functions extracted from upload-images.ts for testability.
 */

/** Extract a display name from a filename: strip .png, replace _ with space, capitalize first */
export function extractIngredientName(filename: string): string {
  const name = filename
    .replace(/\.png$/i, '')
    .replace(/_/g, ' ')
    .trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}
