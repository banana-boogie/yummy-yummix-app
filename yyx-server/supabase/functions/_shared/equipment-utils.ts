/**
 * Equipment Utilities
 *
 * Shared helpers for kitchen equipment detection.
 */

/**
 * Check if the user's kitchen equipment includes a Thermomix.
 */
export function hasThermomix(kitchenEquipment: string[]): boolean {
  return kitchenEquipment.some((eq) => eq.toLowerCase().includes("thermomix"));
}
