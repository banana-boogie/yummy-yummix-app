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

/**
 * Check if the user's kitchen equipment includes an Air Fryer.
 */
export function hasAirFryer(kitchenEquipment: string[]): boolean {
  return kitchenEquipment.some((eq) => {
    const lower = eq.toLowerCase();
    return lower.includes("air fryer") || lower.includes("air_fryer") ||
      lower.includes("airfryer") || lower.includes("freidora de aire");
  });
}
